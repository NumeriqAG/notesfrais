(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('queueOfflineExpense(')) return html;

    const offlineHelpers = String.raw`
/* OFFLINE QUEUE */
const OFFLINE_DB='notesfrais-offline-v1';
const OFFLINE_STORE='expenses';
function openOfflineDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(OFFLINE_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(OFFLINE_STORE))db.createObjectStore(OFFLINE_STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function fileToOffline(file){
  if(!file)return null;
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
  return{name:file.name,type:file.type,lastModified:file.lastModified,data};
}
function offlineToFile(saved){
  if(!saved)return null;
  const parts=String(saved.data).split(',');
  const meta=parts[0]||'',body=parts[1]||'';
  const mime=(meta.match(/data:(.*?);base64/)||[])[1]||saved.type||'application/octet-stream';
  const bin=atob(body);
  const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return new File([bytes],saved.name||'justificatif',{type:mime,lastModified:saved.lastModified||Date.now()});
}
async function queueOfflineExpense(expense,file){
  const db=await openOfflineDb();
  const tx=db.transaction(OFFLINE_STORE,'readwrite');
  tx.objectStore(OFFLINE_STORE).add({id:Date.now()+'_'+Math.random().toString(36).slice(2),expense,file:await fileToOffline(file),createdAt:new Date().toISOString()});
  await txDone(tx);
}
async function getOfflineExpenses(){
  const db=await openOfflineDb();
  const tx=db.transaction(OFFLINE_STORE,'readonly');
  const req=tx.objectStore(OFFLINE_STORE).getAll();
  const items=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
  await txDone(tx);
  return items.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));
}
async function deleteOfflineExpense(id){
  const db=await openOfflineDb();
  const tx=db.transaction(OFFLINE_STORE,'readwrite');
  tx.objectStore(OFFLINE_STORE).delete(id);
  await txDone(tx);
}
async function getOfflineCount(){return (await getOfflineExpenses()).length;}
async function syncOfflineExpenses(onSaved){
  if(!navigator.onLine)return 0;
  const items=await getOfflineExpenses();
  let synced=0;
  for(const item of items){
    let expense={...item.expense};
    const file=offlineToFile(item.file);
    if(file){
      const uploaded=await uploadReceipt(file);
      expense={...expense,receiptPath:uploaded.path,receiptName:uploaded.name||expense.receiptName||file.name};
    }
    const saved=await insertExpense(expense);
    await deleteOfflineExpense(item.id);
    synced++;
    if(onSaved)onSaved(saved);
  }
  return synced;
}
`;
    html = html.replace('/* UBS PARSER */', offlineHelpers + '\n/* UBS PARSER */');

    html = html.replace(
      `    }catch(e){setErr('Erreur upload: '+e.message);}finally{setUploading(false);}`,
      `    }catch(e){
      try{
        await queueOfflineExpense({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptName:file?file.name:null},file);
        window.dispatchEvent(new Event('notesfrais-offline-queued'));
        onClose();
      }catch(qe){setErr('Erreur upload: '+e.message+'. Sauvegarde hors ligne impossible: '+qe.message);}
    }finally{setUploading(false);}`
    );

    html = html.replace(
      `  const [viewer,setViewer]=useState(null);`,
      `  const [viewer,setViewer]=useState(null);
  const [offlineCount,setOfflineCount]=useState(0);`
    );

    html = html.replace(
      `  useEffect(()=>{const onResize=()=>setViewportWidth(window.innerWidth);onResize();window.addEventListener('resize',onResize);return()=>window.removeEventListener('resize',onResize);},[]);`,
      `  useEffect(()=>{const onResize=()=>setViewportWidth(window.innerWidth);onResize();window.addEventListener('resize',onResize);return()=>window.removeEventListener('resize',onResize);},[]);
  useEffect(()=>{
    let alive=true;
    const refresh=async()=>{try{const c=await getOfflineCount();if(alive)setOfflineCount(c);}catch(e){}};
    const sync=async()=>{
      if(!navigator.onLine)return refresh();
      try{
        const n=await syncOfflineExpenses(saved=>{if(alive)setExpenses(p=>p.some(e=>e.id===saved.id)?p:[saved,...p]);});
        if(n>0)notify('✅ '+n+' frais synchronisé'+(n>1?'s':''));
      }catch(e){}
      await refresh();
    };
    window.addEventListener('online',sync);
    window.addEventListener('notesfrais-offline-queued',()=>{refresh();notify('📴 Frais gardé sur cet iPhone. Sync dès retour internet.');});
    refresh();sync();
    return()=>{alive=false;window.removeEventListener('online',sync);};
  },[]);`
    );

    html = html.replace(
      `{dbError&&<div style={{background:'var(--rl)',borderRadius:12,padding:16,marginBottom:20,fontSize:13,color:'var(--red)',maxWidth:600}}><div style={{fontWeight:600,marginBottom:4}}>❌ Erreur Supabase</div><div style={{marginBottom:8}}>{dbError}</div><button onClick={loadData} style={{...bS,color:'var(--red)',borderColor:'#F09595',fontSize:12}}>🔄 Réessayer</button></div>}`,
      `{dbError&&<div style={{background:'var(--rl)',borderRadius:12,padding:16,marginBottom:20,fontSize:13,color:'var(--red)',maxWidth:600}}><div style={{fontWeight:600,marginBottom:4}}>❌ Erreur Supabase</div><div style={{marginBottom:8}}>{dbError}</div><button onClick={loadData} style={{...bS,color:'var(--red)',borderColor:'#F09595',fontSize:12}}>🔄 Réessayer</button></div>}
        {offlineCount>0&&<div style={{background:'var(--aml)',borderRadius:12,padding:14,marginBottom:20,fontSize:13,color:'var(--amber)',maxWidth:600,border:'0.5px solid #E6C07A'}}><div style={{fontWeight:700,marginBottom:3}}>📴 {offlineCount} frais en attente de synchronisation</div><div>Ils sont gardés sur cet iPhone et partiront automatiquement dès que la connexion revient.</div></div>}`
    );

    return html;
  };
})();
