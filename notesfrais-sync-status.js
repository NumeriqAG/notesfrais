(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('notesfrais-sync-status')) return html;

    const syncStatusScript = `<script id="notesfrais-sync-status">(function(){
const DB='notesfrais-offline-v1';
const STORE='expenses';
function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function offlineCount(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).count();
    req.onsuccess=()=>resolve(req.result||0);
    req.onerror=()=>reject(req.error);
  });
}
function ensureStyle(){
  if(document.getElementById('sync-status-style'))return;
  const style=document.createElement('style');
  style.id='sync-status-style';
  style.textContent='@media(max-width:859px){#sync-status-chip{left:14px;right:14px;bottom:calc(148px + env(safe-area-inset-bottom));top:auto;justify-content:flex-start}}#sync-status-chip{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2450;display:flex;align-items:center;gap:10px;border-radius:999px;padding:10px 14px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:12px;font-weight:800;letter-spacing:.01em;box-shadow:0 12px 34px rgba(26,26,26,.14);border:1px solid rgba(255,255,255,.7);backdrop-filter:blur(14px);transition:opacity .18s ease,transform .18s ease}#sync-status-chip .dot{width:9px;height:9px;border-radius:999px;flex:0 0 auto}#sync-status-chip.safe{background:rgba(225,245,238,.96);color:#0F6E56}#sync-status-chip.safe .dot{background:#0F6E56}#sync-status-chip.waiting{background:rgba(250,238,218,.98);color:#9A5A00}#sync-status-chip.waiting .dot{background:#FF9F1A;box-shadow:0 0 0 5px rgba(255,159,26,.18)}#sync-status-chip.offline{background:rgba(252,235,235,.98);color:#A32D2D}#sync-status-chip.offline .dot{background:#A32D2D}';
  document.head.appendChild(style);
}
function ensureChip(){
  ensureStyle();
  let chip=document.getElementById('sync-status-chip');
  if(chip)return chip;
  chip=document.createElement('div');
  chip.id='sync-status-chip';
  chip.innerHTML='<span class="dot"></span><span class="text"></span>';
  document.body.appendChild(chip);
  return chip;
}
async function render(){
  const chip=ensureChip();
  const count=await offlineCount().catch(()=>0);
  const text=chip.querySelector('.text');
  chip.classList.remove('safe','waiting','offline');
  if(count>0){
    chip.classList.add('waiting');
    text.textContent='Saved on this device - '+count+' waiting to sync';
    chip.style.opacity='1';
    return;
  }
  if(!navigator.onLine){
    chip.classList.add('offline');
    text.textContent='Offline - ready to save locally';
    chip.style.opacity='1';
    return;
  }
  chip.classList.add('safe');
  text.textContent='Synced safely';
  chip.style.opacity='1';
}
window.addEventListener('online',()=>setTimeout(render,250));
window.addEventListener('offline',render);
window.addEventListener('notesfrais-offline-queued',()=>setTimeout(render,250));
window.addEventListener('focus',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
setInterval(render,4000);
setTimeout(render,400);
})();<\/script>`;

    return html.replace('</body>', syncStatusScript + '</body>');
  };
})();
