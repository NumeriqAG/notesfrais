(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_DELETE_CONFIRM_V1')) return html;

    // Ce patch est charge en DERNIER, apres notesfrais-mike-en.js : ses chaines
    // ne passent donc pas par les paires de traduction et sont ecrites ici dans
    // les deux langues, comme le fait deja notesfrais-meal-context.js.
    // Les deux canaux utilisateur portent la meme interface anglaise : gater la
    // langue sur le canal faisait rendre /test en francais dans une UI anglaise.
    const EN = true;
    const t = {
      title:    EN ? 'Delete this expense?'                : 'Supprimer ce frais ?',
      plain:    EN ? 'This cannot be undone.'              : 'Cette action est définitive.',
      withDoc:  EN ? 'The receipt will be permanently deleted too.'
                   : 'Le justificatif sera lui aussi supprimé définitivement.',
      cancel:   EN ? 'Cancel'                              : 'Annuler',
      confirm:  EN ? 'Delete'                              : 'Supprimer',
      busy:     EN ? 'Deleting...'                         : 'Suppression...',
      done:     EN ? '🗑 Expense deleted'        : '🗑 Frais supprimé',
      unknown:  EN ? 'Expense'                             : 'Frais'
    };

    // 1. Etat de la demande de suppression.
    const stateAnchor = 'const [viewer,setViewer]=useState(null);';
    if(!html.includes(stateAnchor)) throw new Error('delete-confirm: ancre d etat introuvable');
    html = html.replace(
      stateAnchor,
      stateAnchor + '\n  const [pendingDelete,setPendingDelete]=useState(null);\n  const [deletingExpense,setDeletingExpense]=useState(false);'
    );

    // 2. deleteExpense ne supprime plus : il demande confirmation. Tous les
    //    appelants (liste utilisateur, tableau finance) passent par la sans
    //    modification, y compris ceux qu on ajoutera plus tard.
    const handlerRe = /const deleteExpense=useCallback\(async\(id,receiptPath\)=>\{try\{await deleteById\(id,receiptPath\);setExpenses\(p=>p\.filter\(e=>e\.id!==id\)\);notify\([^)]*\);\}catch\(e\)\{notify\([^)]*\);\}\},\[\]\);/;
    if(!handlerRe.test(html)) throw new Error('delete-confirm: deleteExpense introuvable');
    html = html.replace(handlerRe, String.raw`const NOTESFRAIS_DELETE_CONFIRM_V1=true;
  const performDeleteExpense=useCallback(async(id,receiptPath)=>{
    setDeletingExpense(true);
    try{
      await deleteById(id,receiptPath);
      setExpenses(p=>p.filter(e=>e.id!==id));
      setPendingDelete(null);
      notify('${t.done}');
    }catch(e){
      notify('❌ '+(e.message||e));
    }finally{
      setDeletingExpense(false);
    }
  },[]);
  const deleteExpense=useCallback((id,receiptPath)=>{setPendingDelete({id,receiptPath});},[]);`);

    // 3. La boite de confirmation. z-index au-dessus de la barre de navigation
    //    fixe (4210) et de la modale d ajout forcee par test-modal-fix (5000).
    const modalAnchor = '{showUBS&&<UBSModal onClose={()=>setShowUBS(false)} onImport={handleUBS}/>}';
    if(!html.includes(modalAnchor)) throw new Error('delete-confirm: ancre de modale introuvable');
    const modal = String.raw`{pendingDelete&&(()=>{
        const target=expenses.find(x=>x.id===pendingDelete.id)||{};
        const hasReceipt=!!pendingDelete.receiptPath;
        const close=()=>{if(!deletingExpense)setPendingDelete(null);};
        return <div data-nf-delete-confirm="true" onClick={close} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',zIndex:5200,padding:isMobile?0:16}}>
          <div onClick={ev=>ev.stopPropagation()} style={{background:'#fff',borderRadius:isMobile?'20px 20px 0 0':18,width:'100%',maxWidth:isMobile?'100%':420,padding:isMobile?'20px 18px':'24px',paddingBottom:isMobile?'calc(20px + env(safe-area-inset-bottom))':24,boxShadow:'0 20px 60px rgba(0,0,0,0.28)'}}>
            <div style={{fontSize:17,fontWeight:700,marginBottom:12}}>${t.title}</div>
            <div style={{background:'var(--s2)',borderRadius:12,padding:'12px 14px',marginBottom:12}}>
              <div style={{fontWeight:600,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{target.merchant||'${t.unknown}'}</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,marginTop:4}}>
                <span style={{fontSize:12,color:'var(--t3)'}}>{target.date?fd(target.date):''}</span>
                <span style={{fontFamily:'DM Mono',fontWeight:700,fontSize:14}}>CHF {fmt(target.amountCHF||target.amount)}</span>
              </div>
            </div>
            <div style={{fontSize:13,lineHeight:1.5,marginBottom:18,color:hasReceipt?'var(--red)':'var(--t2)'}}>{hasReceipt?'${t.withDoc}':'${t.plain}'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <button onClick={close} disabled={deletingExpense} style={{...bS,justifyContent:'center',padding:'12px 16px',fontSize:14}}>${t.cancel}</button>
              <button onClick={()=>performDeleteExpense(pendingDelete.id,pendingDelete.receiptPath)} disabled={deletingExpense} style={{...bP,justifyContent:'center',padding:'12px 16px',fontSize:14,background:'var(--red)',opacity:deletingExpense?0.6:1}}>{deletingExpense?'${t.busy}':'${t.confirm}'}</button>
            </div>
          </div>
        </div>;
      })()}
      `;
    html = html.replace(modalAnchor, modal + modalAnchor);

    return html;
  };
})();
