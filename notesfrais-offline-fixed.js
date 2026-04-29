(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('const savedFile=await fileToOffline(file);')) return html;

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

    html = html.replace(
      `return items.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));`,
      `return items.filter(item=>(item.channel||'mike')===(window.NOTESFRAIS_CHANNEL||'main')).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));`
    );

    return html;
  };
})();
