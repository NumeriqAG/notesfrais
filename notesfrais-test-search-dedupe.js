(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_SEARCH_DEDUPE_DONE')) return html;
    html = html.replace('</script>', '<!-- NOTESFRAIS_SEARCH_DEDUPE_DONE --></script>');

    const searchBlock = `<div style={{marginBottom:12}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un reÃ§u, montant, commerÃ§ant..." style={{...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'9px 12px'}}/></div>`;
    const searchBlockUtf = `<div style={{marginBottom:12}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un reçu, montant, commerçant..." style={{...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'9px 12px'}}/></div>`;

    while(html.includes(searchBlock + searchBlock)) html = html.replace(searchBlock + searchBlock, searchBlock);
    while(html.includes(searchBlockUtf + searchBlockUtf)) html = html.replace(searchBlockUtf + searchBlockUtf, searchBlockUtf);

    html = html.replace(
      /(<div style=\{\{marginBottom:12\}\}><input value=\{search\} onChange=\{e=>setSearch\(e\.target\.value\)\} placeholder="Rechercher[^>]+><\/div>)\s*\1/g,
      '$1'
    );

    return html;
  };
})();
