(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_TEST_TAG')) return html;

    html = html.replace(
      "const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);",
      `const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const NOTESFRAIS_CHANNEL=window.NOTESFRAIS_CHANNEL||'main';
const NOTESFRAIS_TEST_TAG='[NF:test]';
function hasTestTag(note){return String(note||'').includes(NOTESFRAIS_TEST_TAG);}
function channelNoteForSave(note){
  const clean=String(note||'').replace(NOTESFRAIS_TEST_TAG,'').trim();
  if(NOTESFRAIS_CHANNEL==='test')return (NOTESFRAIS_TEST_TAG+(clean?'\\n'+clean:'')).trim();
  return clean;
}
function channelNoteForRead(note){return String(note||'').replace(NOTESFRAIS_TEST_TAG,'').trim();}
function belongsToNotesFraisChannel(row){
  const taggedTest=hasTestTag(row&&row.note);
  if(NOTESFRAIS_CHANNEL==='test')return taggedTest;
  if(NOTESFRAIS_CHANNEL==='mike')return !taggedTest;
  return true;
}`
    );

    html = html.replace(
      "return data.map(nr);",
      "return data.filter(belongsToNotesFraisChannel).map(nr);"
    );

    html = html.replace(
      "note:e.note||''",
      "note:channelNoteForSave(e.note)"
    );

    html = html.replace(
      "note:r.note||''",
      "note:channelNoteForRead(r.note||'')"
    );

    html = html.replace(
      "tx.objectStore(OFFLINE_STORE).add({id:Date.now()+'_'+Math.random().toString(36).slice(2),expense,file:await fileToOffline(file),createdAt:new Date().toISOString()});",
      "tx.objectStore(OFFLINE_STORE).add({id:Date.now()+'_'+Math.random().toString(36).slice(2),channel:NOTESFRAIS_CHANNEL,expense,file:await fileToOffline(file),createdAt:new Date().toISOString()});"
    );

    html = html.replace(
      "return items.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));",
      "return items.filter(item=>(item.channel||'mike')===NOTESFRAIS_CHANNEL).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));"
    );

    return html;
  };
})();
