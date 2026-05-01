(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_STORAGE_CHANNEL_PATHS')) return html;

    html = html.replace(
      "async function uploadReceipt(file){\n  const ext=file.name.split('.').pop();\n  const name=Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;\n  const{error}=await sb.storage.from('receipts').upload(name,file,{contentType:file.type});\n  if(error)throw error;\n  return{path:name,name:file.name};\n}",
      `const NOTESFRAIS_STORAGE_CHANNEL_PATHS=true;
function notesFraisStorageChannel(){
  return String(window.NOTESFRAIS_CHANNEL||'mike').replace(/[^a-z0-9_-]/gi,'')||'mike';
}
async function uploadReceipt(file){
  const ext=file.name.split('.').pop();
  const filename=Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
  const name=notesFraisStorageChannel()+'/'+filename;
  const{error}=await sb.storage.from('receipts').upload(name,file,{contentType:file.type});
  if(error)throw error;
  return{path:name,name:file.name};
}`
    );

    return html;
  };
})();
