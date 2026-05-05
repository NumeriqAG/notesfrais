(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_STORAGE_CHANNEL_PATHS_V2')) return html;

    html = html.replace(
      "async function uploadReceipt(file){\n  const ext=file.name.split('.').pop();\n  const name=Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;\n  const{error}=await sb.storage.from('receipts').upload(name,file,{contentType:file.type});\n  if(error)throw error;\n  return{path:name,name:file.name};\n}",
      `const NOTESFRAIS_STORAGE_CHANNEL_PATHS_V2=true;
function notesFraisStorageChannel(){
  const profile=window.notesFraisProfile||null;
  const role=window.notesFraisRole||null;
  const profileChannel=profile&&typeof profile.app_channel==='string'&&profile.app_channel?profile.app_channel:null;
  const routeChannel=window.NOTESFRAIS_CHANNEL||'mike';
  const channel=(role==='user'&&profileChannel)?profileChannel:routeChannel;
  return String(channel||'mike').replace(/[^a-z0-9_-]/gi,'')||'mike';
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

    html = html.replace(
      "const NOTESFRAIS_STORAGE_CHANNEL_PATHS=true;\nfunction notesFraisStorageChannel(){\n  return String(window.NOTESFRAIS_CHANNEL||'mike').replace(/[^a-z0-9_-]/gi,'')||'mike';\n}\nasync function uploadReceipt(file){\n  const ext=file.name.split('.').pop();\n  const filename=Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;\n  const name=notesFraisStorageChannel()+'/'+filename;\n  const{error}=await sb.storage.from('receipts').upload(name,file,{contentType:file.type});\n  if(error)throw error;\n  return{path:name,name:file.name};\n}",
      `const NOTESFRAIS_STORAGE_CHANNEL_PATHS_V2=true;
function notesFraisStorageChannel(){
  const profile=window.notesFraisProfile||null;
  const role=window.notesFraisRole||null;
  const profileChannel=profile&&typeof profile.app_channel==='string'&&profile.app_channel?profile.app_channel:null;
  const routeChannel=window.NOTESFRAIS_CHANNEL||'mike';
  const channel=(role==='user'&&profileChannel)?profileChannel:routeChannel;
  return String(channel||'mike').replace(/[^a-z0-9_-]/gi,'')||'mike';
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
