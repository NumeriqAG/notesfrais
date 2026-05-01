(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_CHANNEL_ISOLATION_V3')) return html;

    html = html.replace(
      "const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);",
      String.raw`const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const NOTESFRAIS_CHANNEL_ISOLATION_V3=true;
const NOTESFRAIS_CHANNEL=window.NOTESFRAIS_CHANNEL||'main';
const NOTESFRAIS_TEST_TAG='[NF:test]';
const NOTESFRAIS_META_RE=/\[NF:meta:([A-Za-z0-9_-]+)\]/g;
function nfBase64Encode(value){
  try{return btoa(unescape(encodeURIComponent(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  catch(e){return '';}
}
function nfBase64Decode(value){
  try{
    const clean=String(value||'').replace(/-/g,'+').replace(/_/g,'/');
    const pad=clean.length%4?'='.repeat(4-clean.length%4):'';
    return decodeURIComponent(escape(atob(clean+pad)));
  }catch(e){return '';}
}
function buildChannelMeta(channel){
  const encoded=nfBase64Encode(JSON.stringify({channel:channel,v:3}));
  return encoded?'[NF:meta:'+encoded+']':'';
}
function readChannelMeta(note){
  const text=String(note||'');
  NOTESFRAIS_META_RE.lastIndex=0;
  let match;
  while((match=NOTESFRAIS_META_RE.exec(text))){
    try{
      const meta=JSON.parse(nfBase64Decode(match[1]));
      if(meta&&typeof meta.channel==='string')return meta;
    }catch(e){}
  }
  return null;
}
function stripChannelMarkers(note){
  return String(note||'').replace(NOTESFRAIS_META_RE,'').replace(NOTESFRAIS_TEST_TAG,'').trim();
}
function hasTestTag(note){return String(note||'').includes(NOTESFRAIS_TEST_TAG);}
function channelForRow(row){
  const note=String(row&&row.note||'');
  const meta=readChannelMeta(note);
  if(meta&&meta.channel)return meta.channel;
  if(hasTestTag(note))return 'test';
  return 'mike';
}
function channelNoteForSave(note){
  const clean=stripChannelMarkers(note);
  if(NOTESFRAIS_CHANNEL==='test'||NOTESFRAIS_CHANNEL==='mike'){
    const meta=buildChannelMeta(NOTESFRAIS_CHANNEL);
    const legacy=NOTESFRAIS_CHANNEL==='test'?NOTESFRAIS_TEST_TAG:'';
    return [meta,legacy,clean].filter(Boolean).join('\n').trim();
  }
  return clean;
}
function channelNoteForRead(note){return stripChannelMarkers(note);}
function belongsToNotesFraisChannel(row){
  const rowChannel=channelForRow(row);
  if(NOTESFRAIS_CHANNEL==='test')return rowChannel==='test';
  if(NOTESFRAIS_CHANNEL==='mike')return rowChannel==='mike';
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
      "tx.objectStore(OFFLINE_STORE).add({id:Date.now()+'_'+Math.random().toString(36).slice(2),channel:NOTESFRAIS_CHANNEL,expense:file?expense:expense,file:await fileToOffline(file),createdAt:new Date().toISOString()});"
    );

    html = html.replace(
      "return items.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));",
      "return items.filter(item=>(item.channel||'mike')===NOTESFRAIS_CHANNEL).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));"
    );

    return html;
  };
})();
