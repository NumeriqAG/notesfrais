(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_HISTORY_ANNUAL_PATCH_V2_DONE')) return html;
    html = html.replace('</script>', '<!-- NOTESFRAIS_HISTORY_ANNUAL_PATCH_V2_DONE --></script>');

    html = html.replace(
      `const fil=useMemo(()=>mE.filter(e=>filterCat==='all'||e.category===filterCat).filter(e=>{const q=search.trim().toLowerCase();if(!q)return true;return [e.merchant,e.note,e.category,e.amountCHF,e.amount,e.receiptName].join(' ').toLowerCase().includes(q);}),[mE,filterCat,search]);`,
      `const fil=useMemo(()=>expenses.filter(e=>filterCat==='all'||e.category===filterCat).filter(e=>{const q=search.trim().toLowerCase();if(!q)return true;return [e.merchant,e.note,e.category,e.amountCHF,e.amount,e.receiptName].join(' ').toLowerCase().includes(q);}),[expenses,filterCat,search]);`
    );

    html = html.replace(
      `<div style={{padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`,
      `<div data-period-selector="true" style={{display:tab==='history'?'none':'block',padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`
    );
    html = html.replace(
      `<div style={{display:tab==='history'?'none':'block',padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`,
      `<div data-period-selector="true" style={{display:tab==='history'?'none':'block',padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`
    );

    html = html.replace(
      `<div style={{fontSize:13,color:'var(--t3)'}}>{ML} · {fil.length} frais · {fil.filter(e=>e.receiptPath||e.receiptUrl).length} avec justificatif</div>`,
      `<div style={{fontSize:13,color:'var(--t3)'}}>Annee 2026 · {fil.length} frais · {fil.filter(e=>e.receiptPath||e.receiptUrl).length} avec justificatif</div>`
    );

    html = html.replace(`Aucun frais pour ce mois`, `Aucun frais saisi`);

    if(!html.includes('function hardHideHistoryPeriodSelector')){
      html = html.replace(
        `ReactDOM.render(<React.StrictMode><App/></React.StrictMode>,document.getElementById('root'));`,
        `function hardHideHistoryPeriodSelector(){
  const isHistory=/Historique\\s+Annee 2026|Historique\\s+Année 2026/.test(document.body.innerText||'');
  document.querySelectorAll('[data-period-selector]').forEach(el=>{el.style.display=isHistory?'none':'';});
  if(isHistory){
    document.querySelectorAll('select').forEach(sel=>{
      const hasMonths=[...sel.options].some(o=>/Janvier 2026|Fevrier 2026|Février 2026|Mars 2026/.test(o.textContent));
      if(hasMonths){
        let node=sel;
        for(let i=0;i<3&&node;i++,node=node.parentElement){node.style.display='none';}
      }
    });
  }
}
setInterval(hardHideHistoryPeriodSelector,500);
ReactDOM.render(<React.StrictMode><App/></React.StrictMode>,document.getElementById('root'));`
      );
    }

    return html;
  };
})();
