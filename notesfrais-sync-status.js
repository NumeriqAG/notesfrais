(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('notesfrais-sync-status')) return html;

    const syncStatusScript = `<script id="notesfrais-sync-status">(function(){
const DB='notesfrais-offline-v1';
const STORE='expenses';
const CHANNEL=window.NOTESFRAIS_CHANNEL||'mike';
const IS_MIKE=CHANNEL==='mike';
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
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=>resolve((req.result||[]).filter(item=>(item.channel||'mike')===CHANNEL).length);
    req.onerror=()=>reject(req.error);
  });
}
function findSupabaseLine(){
  const spans=[...document.querySelectorAll('span')];
  const label=spans.find(span=>/Supabase connect|Erreur connexion|Connection error|Hors ligne|Offline|synchronis|sync/i.test(span.textContent||''));
  if(!label)return null;
  const row=label.parentElement;
  const dot=row&&[...row.children].find(el=>el.tagName==='SPAN'&&el !== label);
  return {row,label,dot};
}
function applyStatus(label,dot,color,text){
  if(dot)dot.style.background=color;
  label.style.color=color;
  label.textContent=text;
}
async function render(){
  const title=(document.querySelector('h1')?.textContent||'').trim();
  if(/^Code d|^Access code/.test(title))return;
  const line=findSupabaseLine();
  if(!line)return;
  const root=getComputedStyle(document.documentElement);
  const green=root.getPropertyValue('--green').trim()||'#0F6E56';
  const amber=root.getPropertyValue('--amber').trim()||'#BA7517';
  const red=root.getPropertyValue('--red').trim()||'#A32D2D';
  const count=await offlineCount().catch(()=>0);
  if(count>0){
    applyStatus(line.label,line.dot,amber,IS_MIKE?'Supabase connected - '+count+' to sync':'Supabase connecté - '+count+' à synchroniser');
    return;
  }
  if(!navigator.onLine){
    applyStatus(line.label,line.dot,red,IS_MIKE?'Offline - local save ready':'Hors ligne - sauvegarde locale prête');
    return;
  }
  applyStatus(line.label,line.dot,green,IS_MIKE?'Supabase connected - synced':'Supabase connecté - synchronisé');
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
