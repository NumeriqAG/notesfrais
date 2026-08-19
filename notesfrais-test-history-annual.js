(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_PERIOD_SELECTOR_STATS_ONLY_DONE')) return html;
    html = html.replace('</script>', '<!-- NOTESFRAIS_PERIOD_SELECTOR_STATS_ONLY_DONE --></script>');

    // The global month selector remains useful for Accueil/Frais/UBS.
    // Hide it only on Statistiques, because that tab has its own annual/month filter.
    html = html.replace(
      `<div style={{padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`,
      `<div data-period-selector="true" style={{display:tab==='stats'?'none':'block',padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`
    );
    html = html.replace(
      `<div data-period-selector="true" style={{display:tab==='history'?'none':'block',padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`,
      `<div data-period-selector="true" style={{display:tab==='stats'?'none':'block',padding:isMobile?'0 12px 10px':'0 12px 12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>PÉRIODE</div>`
    );

    // Restore Frais/Historique as a monthly view driven by the global month selector.
    html = html.replace(
      `const fil=useMemo(()=>expenses.filter(e=>filterCat==='all'||e.category===filterCat).filter(e=>{const q=search.trim().toLowerCase();if(!q)return true;return [e.merchant,e.note,e.category,e.amountCHF,e.amount,e.receiptName].join(' ').toLowerCase().includes(q);}),[expenses,filterCat,search]);`,
      `const fil=useMemo(()=>mE.filter(e=>filterCat==='all'||e.category===filterCat).filter(e=>{const q=search.trim().toLowerCase();if(!q)return true;return [e.merchant,e.note,e.category,e.amountCHF,e.amount,e.receiptName].join(' ').toLowerCase().includes(q);}),[mE,filterCat,search]);`
    );
    html = html.replace(
      `<div style={{fontSize:13,color:'var(--t3)'}}>Annee 2026 · {fil.length} frais · {fil.filter(e=>e.receiptPath||e.receiptUrl).length} avec justificatif</div>`,
      `<div style={{fontSize:13,color:'var(--t3)'}}>{ML} · {fil.length} frais · {fil.filter(e=>e.receiptPath||e.receiptUrl).length} avec justificatif</div>`
    );
    html = html.replace(`Aucun frais saisi`, `Aucun frais pour ce mois`);

    // Remove the previous hard-hide interval if it was injected by an older cached patch.
    html = html.replace(/function hardHideHistoryPeriodSelector\(\)\{[\s\S]*?setInterval\(hardHideHistoryPeriodSelector,500\);\n/, '');

    if(false&&!html.includes('function hardHideStatsPeriodSelector')){
      html = html.replace(
        `ReactDOM.render(<React.StrictMode><App/></React.StrictMode>,document.getElementById('root'));`,
        `function hardHideStatsPeriodSelector(){
  const isStats=/Statistiques\\s+Annee 2026|Statistiques\\s+Année 2026|annuel par defaut/.test(document.body.innerText||'');
  document.querySelectorAll('[data-period-selector]').forEach(el=>{el.style.display=isStats?'none':'';});
}
setInterval(hardHideStatsPeriodSelector,500);
ReactDOM.render(<React.StrictMode><App/></React.StrictMode>,document.getElementById('root'));`
      );
    }

    return html;
  };
})();
