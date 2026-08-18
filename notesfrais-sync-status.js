(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('notesfrais-sync-status')) return html;

    const syncStatusScript = `<script id="notesfrais-sync-status">(function(){
const DB='notesfrais-offline-v1';
const STORE='expenses';
const DRAFT_KEY='notesfrais:add-draft:v1';
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
async function offlineItems(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readonly');
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=>resolve((req.result||[]).filter(item=>(item.channel||'mike')===CHANNEL));
    req.onerror=()=>reject(req.error);
  });
}
async function offlineCount(){return (await offlineItems()).length;}
async function clearOfflineItems(){
  const db=await openDb();
  const items=await offlineItems();
  await Promise.all(items.map(item=>new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    const req=tx.objectStore(STORE).delete(item.id);
    req.onsuccess=()=>resolve();
    req.onerror=()=>reject(req.error);
  })));
}
function readDraft(){
  try{
    const raw=localStorage.getItem(DRAFT_KEY);
    if(!raw)return null;
    const draft=JSON.parse(raw);
    if(!draft||!draft.form)return null;
    const form=draft.form;
    const today=new Date().toISOString().split('T')[0];
    const meaningful=[
      form.merchant,
      form.amount,
      form.tva,
      form.note,
      form.mealWith,
      form.paymentCard,
      form.card
    ].some(value=>String(value||'').trim())
      || (form.date&&form.date!==today)
      || (form.category&&form.category!=='repas');
    if(!meaningful){localStorage.removeItem(DRAFT_KEY);return null;}
    return draft;
  }catch(e){return null;}
}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch(e){}}
function findStatusLine(){
  const spans=[...document.querySelectorAll('span')];
  const label=spans.find(span=>/NotesFrais connect|Supabase connect|Erreur connexion|Connection error|Hors ligne|Offline|synchronis|sync/i.test(span.textContent||''));
  if(!label)return null;
  const row=label.parentElement;
  const dot=row&&[...row.children].find(el=>el.tagName==='SPAN'&&el!==label);
  return {row,label,dot};
}
function applyStatus(label,dot,color,text){
  if(dot)dot.style.background=color;
  label.style.color=color;
  label.textContent=text;
}
function escapeHtml(value){
  return String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function formatDraftDate(ts){
  if(!ts)return '';
  try{return new Date(Number(ts)).toLocaleString('fr-CH',{dateStyle:'short',timeStyle:'short'});}catch(e){return '';}
}
function draftRows(draft){
  const form=draft&&draft.form?draft.form:{};
  const rows=[
    ['Merchant',form.merchant],
    ['Date',form.date],
    ['Amount',form.amount?('CHF '+form.amount):''],
    ['VAT',form.tva?('CHF '+form.tva):''],
    ['Category',form.category],
    ['Note',form.note],
    ['Saved',formatDraftDate(draft&&draft.ts)]
  ].filter(row=>String(row[1]||'').trim());
  if(rows.length===0)return '<div style="font-size:13px;color:#9E9892">Empty draft.</div>';
  return rows.map(row=>'<div style="display:grid;grid-template-columns:92px 1fr;gap:10px;padding:8px 0;border-bottom:1px solid #EDEBE6"><div style="font-size:11px;color:#9E9892;text-transform:uppercase;letter-spacing:.04em">'+escapeHtml(row[0])+'</div><div style="font-size:13px;color:#1A1A1A;white-space:pre-wrap;word-break:break-word">'+escapeHtml(row[1])+'</div></div>').join('');
}
function openDraftEditor(){
  const candidates=[...document.querySelectorAll('button')];
  const btn=candidates.find(b=>/Scan receipt|Add expense|Ajouter un frais|Scanner/i.test(b.textContent||''));
  if(btn)btn.click();
}
function showDraftModal(draft){
  const old=document.getElementById('notesfrais-draft-modal');
  if(old)old.remove();
  const modal=document.createElement('div');
  modal.id='notesfrais-draft-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:6200;background:rgba(0,0,0,.52);display:flex;align-items:center;justify-content:center;padding:14px;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  modal.innerHTML='<div role="dialog" aria-modal="true" style="width:min(440px,100%);max-height:calc(100dvh - 28px);overflow:auto;background:#fff;border-radius:18px;box-shadow:0 22px 70px rgba(0,0,0,.26);padding:18px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px"><div><div style="font-weight:900;font-size:17px;color:#1A1A1A">Draft expense</div><div style="font-size:12px;color:#6B6560;margin-top:3px">Saved only on this device.</div></div><button type="button" data-draft-close style="border:0;background:transparent;color:#6B6560;font-size:24px;line-height:1;cursor:pointer">x</button></div><div style="border:1px solid #EDEBE6;border-radius:14px;padding:4px 12px;margin-bottom:14px">'+draftRows(draft)+'</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button type="button" data-draft-resume style="border:0;background:#2D5BE3;color:#fff;border-radius:12px;padding:11px 10px;font-weight:800;font-size:13px">Resume draft</button><button type="button" data-draft-delete style="border:1px solid #F0D391;background:#FAEEDA;color:#BA7517;border-radius:12px;padding:11px 10px;font-weight:800;font-size:13px">Delete draft</button></div></div>';
  document.body.appendChild(modal);
  modal.querySelector('[data-draft-close]').onclick=()=>modal.remove();
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.querySelector('[data-draft-resume]').onclick=()=>{modal.remove();openDraftEditor();};
  modal.querySelector('[data-draft-delete]').onclick=()=>{if(!confirm('Delete this draft?'))return;clearDraft();modal.remove();render();};
}
function renderLocalQueuePanel(count,draft){
  const existing=document.getElementById('notesfrais-local-queue');
  const modalOpen=[...document.querySelectorAll('[role="dialog"],[aria-modal="true"]')].some(el=>el.offsetParent!==null);
  const financeRole=window.notesFraisRole==='finance'||/\\bFinance\\b/.test((document.querySelector('[style*="border-radius: 999"]')||{}).textContent||'');
  const compactMike=IS_MIKE&&!financeRole&&window.innerWidth<860;
  if(modalOpen){if(existing)existing.remove();return;}
  if(count===0&&!draft){if(existing)existing.remove();return;}
  let panel=existing;
  if(!panel){
    panel=document.createElement('div');
    panel.id='notesfrais-local-queue';
    document.body.appendChild(panel);
  }
  if(compactMike){
    panel.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:4300;min-height:46px;background:rgba(28,28,30,.94);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:0;border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:7px 8px 7px 12px;display:flex;align-items:center;gap:8px;color:#fff;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
    const summary=count>0?(count+' waiting to sync'):'Draft saved';
    panel.innerHTML='<div style="min-width:0;flex:1;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+summary+'</div>'
      +(draft?'<button type="button" data-local-draft style="border:0;background:#fff;color:#111;border-radius:9px;padding:7px 10px;font-weight:750;font-size:12px">Resume</button>':'')
      +(count>0?'<button type="button" data-local-sync style="border:0;background:#0A84FF;color:#fff;border-radius:9px;padding:7px 10px;font-weight:750;font-size:12px">Sync</button>':'')
      +'<button type="button" data-local-close aria-label="Dismiss" style="width:30px;height:30px;border:0;background:transparent;color:#fff;font-size:20px;line-height:1;cursor:pointer">×</button>';
    panel.querySelector('[data-local-close]').onclick=()=>panel.remove();
    const compactDraft=panel.querySelector('[data-local-draft]');
    if(compactDraft)compactDraft.onclick=()=>showDraftModal(readDraft());
    const compactSync=panel.querySelector('[data-local-sync]');
    if(compactSync)compactSync.onclick=()=>window.location.reload();
    return;
  }
  panel.style.cssText=financeRole
    ? 'position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:1800;width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #F0D391;border-radius:14px;box-shadow:0 10px 30px rgba(26,26,26,.16);padding:10px;display:grid;gap:8px;color:#1A1A1A;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'
    : 'position:fixed;left:14px;right:14px;bottom:calc(188px + env(safe-area-inset-bottom));z-index:4300;background:#fff;border:1px solid #F0D391;border-radius:16px;box-shadow:0 14px 38px rgba(26,26,26,.18);padding:12px;display:grid;gap:10px;color:#1A1A1A;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif';
  const draftForm=draft&&draft.form?draft.form:{};
  const bits=[];
  if(count>0)bits.push(count+' pending sync');
  if(draft)bits.push('1 draft');
  const draftLabel=draft?String(draftForm.merchant||draftForm.amount||'draft'):'';
  panel.innerHTML='<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-weight:800;font-size:13px;color:#BA7517">Local queue</div><div style="font-size:12px;color:#6B6560;margin-top:2px">'+bits.join(' + ')+'</div>'+(draft?'<div style="font-size:11px;color:#9E9892;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Draft: '+escapeHtml(draftLabel)+'</div>':'')+'</div><button type="button" data-local-close style="border:0;background:transparent;font-size:18px;line-height:1;cursor:pointer;color:#6B6560">x</button></div><div style="display:grid;grid-template-columns:'+((draft&&count>0&&!financeRole)?'1fr 1fr 1fr':'1fr 1fr')+';gap:8px">'+(draft?'<button type="button" data-local-draft style="border:0;background:#111;color:#fff;border-radius:12px;padding:'+(financeRole?'8px':'10px')+';font-weight:800;font-size:12px">View draft</button>':'')+'<button type="button" data-local-sync style="border:0;background:#2D5BE3;color:#fff;border-radius:12px;padding:'+(financeRole?'8px':'10px')+';font-weight:800;font-size:12px">Refresh / sync</button><button type="button" data-local-clear style="border:1px solid #F0D391;background:#FAEEDA;color:#BA7517;border-radius:12px;padding:'+(financeRole?'8px':'10px')+';font-weight:800;font-size:12px">Clear local</button></div>';
  panel.querySelector('[data-local-close]').onclick=()=>panel.remove();
  const draftButton=panel.querySelector('[data-local-draft]');
  if(draftButton)draftButton.onclick=()=>showDraftModal(readDraft());
  panel.querySelector('[data-local-sync]').onclick=()=>window.location.reload();
  panel.querySelector('[data-local-clear]').onclick=async()=>{
    if(!confirm('Clear local pending sync and draft on this device?'))return;
    await clearOfflineItems().catch(()=>{});
    clearDraft();
    window.dispatchEvent(new Event('notesfrais-offline-queued'));
    render();
  };
}
async function render(){
  const title=(document.querySelector('h1')?.textContent||'').trim();
  if(/^Code d|^Access code/.test(title))return;
  const count=await offlineCount().catch(()=>0);
  const draft=readDraft();
  renderLocalQueuePanel(count,draft);
  const line=findStatusLine();
  if(!line)return;
  const root=getComputedStyle(document.documentElement);
  const green=root.getPropertyValue('--green').trim()||'#0F6E56';
  const amber=root.getPropertyValue('--amber').trim()||'#BA7517';
  const red=root.getPropertyValue('--red').trim()||'#A32D2D';
  if(count>0){
    applyStatus(line.label,line.dot,amber,IS_MIKE?'NotesFrais connected - '+count+' to sync':'NotesFrais connected - '+count+' to sync');
    return;
  }
  if(!navigator.onLine){
    applyStatus(line.label,line.dot,red,IS_MIKE?'Offline - local save ready':'Offline - local save ready');
    return;
  }
  applyStatus(line.label,line.dot,green,IS_MIKE?'NotesFrais connected - synced':'NotesFrais connected - synced');
}
window.addEventListener('online',()=>setTimeout(render,250));
window.addEventListener('offline',render);
window.addEventListener('notesfrais-offline-queued',()=>setTimeout(render,250));
window.addEventListener('storage',render);
window.addEventListener('focus',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});
setInterval(render,4000);
setTimeout(render,400);
})();<\/script>`;

    return html.replace('</body>', syncStatusScript + '</body>');
  };
})();
