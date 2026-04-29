(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;

    if(!html.includes('const savedFile=await fileToOffline(file);')){
      html = html.replace(
        `async function queueOfflineExpense(expense,file){
  const db=await openOfflineDb();
  const tx=db.transaction(OFFLINE_STORE,'readwrite');
  tx.objectStore(OFFLINE_STORE).add({id:Date.now()+'_'+Math.random().toString(36).slice(2),expense,file:await fileToOffline(file),createdAt:new Date().toISOString()});
  await txDone(tx);
}`,
        `async function queueOfflineExpense(expense,file){
  const savedFile=await fileToOffline(file);
  const db=await openOfflineDb();
  const tx=db.transaction(OFFLINE_STORE,'readwrite');
  tx.objectStore(OFFLINE_STORE).add({id:Date.now()+'_'+Math.random().toString(36).slice(2),channel:window.NOTESFRAIS_CHANNEL||'main',expense,file:savedFile,createdAt:new Date().toISOString()});
  await txDone(tx);
}`
      );
    }

    if(!html.includes('NOTESFRAIS_FETCH_TIMEOUT_MS')){
      html = html.replace(
        `function lastDayOfMonth(month){`,
        `const NOTESFRAIS_FETCH_TIMEOUT_MS=6500;
async function fetchExpensesWithTimeout(month){
  if(typeof navigator!=='undefined'&&!navigator.onLine){
    throw new Error('Mode hors ligne - les donnees locales restent disponibles.');
  }
  let timer;
  try{
    return await Promise.race([
      fetchExpenses(month),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Connexion trop lente - ouverture en mode local.')),NOTESFRAIS_FETCH_TIMEOUT_MS);})
    ]);
  }finally{
    clearTimeout(timer);
  }
}
function lastDayOfMonth(month){`
      );

      html = html.replace(
        `const loadData=useCallback(async()=>{setLoading(true);setDbError(null);try{const d=await fetchExpenses(month);setExpenses(d);}catch(e){setDbError(e.message);}finally{setLoading(false);}},[month]);`,
        `const loadData=useCallback(async()=>{
    setLoading(true);setDbError(null);
    let timedOut=false;
    const bootTimer=setTimeout(()=>{
      timedOut=true;
      setDbError('Mode local - connexion indisponible. Les frais saisis hors ligne restent sur cet appareil.');
      setLoading(false);
    },NOTESFRAIS_FETCH_TIMEOUT_MS+1000);
    try{
      const d=await fetchExpensesWithTimeout(month);
      if(!timedOut)setExpenses(d);
    }catch(e){
      setDbError(e.message);
    }finally{
      clearTimeout(bootTimer);
      setLoading(false);
    }
  },[month]);`
      );

      html = html.replace(
        `const d=await fetchExpenses(month);setExpenses(d);`,
        `const d=await fetchExpensesWithTimeout(month);setExpenses(d);`
      );
    }

    html = html.replace(
      `return items.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));`,
      `return items.filter(item=>(item.channel||'mike')===(window.NOTESFRAIS_CHANNEL||'main')).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));`
    );

    return html;
  };
})();
