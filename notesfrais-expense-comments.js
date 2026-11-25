(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_EXPENSE_COMMENTS_V1')) return html;

    // Commentaires finance <-> employe sur un frais, et badge « To fix ».
    // Route serveur : api/expense-comments.js. Les commentaires arrivent avec
    // chaque ligne de /api/expenses (colonnes comments, review_status).
    //
    // Charge en DERNIER, apres toutes les traductions : les chaines sont donc
    // ecrites directement en anglais (les deux canaux ont la meme UI anglaise)
    // et les cibles sont copiees depuis le HTML final.
    const component = String.raw`
const NOTESFRAIS_EXPENSE_COMMENTS_V1=true;
function nfCommentsOf(e){return Array.isArray(e&&e.comments)?e.comments:[];}
function nfIsFinanceView(){return window.notesFraisRole==='finance';}
function nfCommentAuthor(c){
  const mine=(c.role==='finance')===nfIsFinanceView();
  if(mine)return 'You';
  if(c.role==='finance')return 'Finance';
  const local=String(c.email||'').split('@')[0];
  return local?local.charAt(0).toUpperCase()+local.slice(1):'Employee';
}
function nfCommentTime(at){
  try{return new Date(at).toLocaleString(typeof NOTESFRAIS_LOCALE_V1==='string'?NOTESFRAIS_LOCALE_V1:'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
  catch(_){return '';}
}
function nfAwaitingMe(e){
  const list=nfCommentsOf(e).filter(c=>c.kind!=='status');
  const last=list[list.length-1];
  return !!last&&((last.role==='finance')!==nfIsFinanceView());
}
function NfReviewChips({expense}){
  const count=nfCommentsOf(expense).filter(c=>c.kind!=='status').length;
  const toFix=expense.reviewStatus==='to_fix';
  if(!toFix&&!count)return null;
  const waiting=nfAwaitingMe(expense);
  return <span className="nf-review-chips" style={{display:'inline-flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
    {toFix&&<span data-nf-to-fix="true" style={{fontSize:10,fontWeight:900,background:'#FDECEC',color:'#C62828',borderRadius:999,padding:'3px 8px',letterSpacing:'0.02em'}}>To fix</span>}
    {count>0&&<span data-nf-comment-count="true" title={waiting?'New reply':'Comments'} style={{fontSize:10,fontWeight:800,background:waiting?'var(--accent)':'var(--s2)',color:waiting?'#fff':'var(--t2)',borderRadius:999,padding:'3px 8px'}}>💬 {count}</span>}
  </span>;
}
function NfCommentsButton({expense,onUpdated,compact}){
  const [open,setOpen]=useState(false);
  const count=nfCommentsOf(expense).filter(c=>c.kind!=='status').length;
  const label=compact?('💬'+(count?' '+count:'')):(count?'Comments ('+count+')':'Comment');
  return <>
    <button type="button" data-nf-comments-open="true" onClick={ev=>{ev.stopPropagation();setOpen(true);}} title="Comments" style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,fontWeight:800,padding:4,whiteSpace:'nowrap'}}>{label}</button>
    {open&&ReactDOM.createPortal(<NfCommentsSheet expense={expense} onClose={()=>setOpen(false)} onUpdated={onUpdated}/>,document.body)}
  </>;
}
function NfCommentsSheet({expense,onClose,onUpdated}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const isFinance=nfIsFinanceView();
  const [text,setText]=useState('');
  const [flag,setFlag]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const endRef=useRef(null);
  const list=nfCommentsOf(expense);
  const toFix=expense.reviewStatus==='to_fix';
  useEffect(()=>{if(endRef.current&&endRef.current.scrollIntoView)endRef.current.scrollIntoView({block:'end'});},[list.length]);
  const post=async(reviewStatus)=>{
    const body=text.trim();
    const payload={expense_id:expense.id,body};
    if(reviewStatus)payload.review_status=reviewStatus;
    else if(isFinance&&flag&&!toFix)payload.review_status='to_fix';
    if(!body&&!payload.review_status)return;
    setBusy(true);setError('');
    try{
      const out=await notesFraisApi('/api/expense-comments',{method:'POST',body:JSON.stringify(payload)});
      const row=out.data||{};
      onUpdated&&onUpdated({...expense,comments:Array.isArray(row.comments)?row.comments:list,reviewStatus:row.review_status||expense.reviewStatus||'ok'});
      if(body)setText('');
      setFlag(false);
    }catch(err){
      setError(err.status===404?'This expense is not synced yet. Try again once it is online.':(err.message||String(err)));
    }finally{setBusy(false);}
  };
  const stop=ev=>ev.stopPropagation();
  return <div data-nf-comments-sheet="true" onClick={onClose} style={{position:'fixed',inset:0,zIndex:6400,background:'rgba(10,16,32,0.48)',display:'flex',alignItems:isMobile?'stretch':'center',justifyContent:'center',padding:isMobile?0:20}}>
    <div className="nf-comments-panel" onClick={stop} style={{background:'#f2f2f7',width:isMobile?'100%':520,height:isMobile?'100dvh':'min(640px, calc(100dvh - 40px))',borderRadius:isMobile?0:18,display:'grid',gridTemplateRows:'auto auto minmax(0,1fr) auto',overflow:'hidden',boxShadow:'0 24px 80px rgba(10,16,32,0.24)'}}>
      <div style={{position:'relative',padding:isMobile?'calc(12px + env(safe-area-inset-top)) 64px 12px 16px':'16px 64px 14px 18px',background:'rgba(249,249,249,.96)',borderBottom:'.5px solid rgba(60,60,67,.22)'}}>
        <div style={{fontSize:isMobile?20:18,fontWeight:900,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{expense.merchant||'Expense'}</div>
        <div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{fd(expense.date)} · CHF {fmt(expense.amountCHF||expense.amount)}</div>
        <button type="button" onClick={onClose} aria-label="Close comments" style={{position:'absolute',top:isMobile?'calc(12px + env(safe-area-inset-top))':14,right:14,width:40,height:40,border:0,borderRadius:'50%',background:'#e5e5ea',color:'#3c3c43',fontSize:22,lineHeight:1,cursor:'pointer'}}>×</button>
      </div>
      {toFix?<div data-nf-to-fix-banner="true" style={{background:'#FDECEC',color:'#9B1C1C',fontSize:13,fontWeight:700,padding:'10px 16px',lineHeight:1.35}}>{isFinance?'You asked for a correction on this expense.':'Finance asked for a correction. Edit the expense, then reply here to say it is done.'}</div>:<div/>}
      <div style={{overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
        {list.length===0&&<div style={{margin:'auto',textAlign:'center',color:'var(--t3)',fontSize:13,maxWidth:300,lineHeight:1.4}}>No comments yet.<br/>{isFinance?'Ask a question or request a correction.':'Finance can ask you questions about this expense here.'}</div>}
        {list.map(c=>{
          if(c.kind==='status')return <div key={c.id} style={{alignSelf:'center',fontSize:11,color:'var(--t3)',textAlign:'center'}}>{nfCommentAuthor(c)} {c.review_status==='to_fix'?'marked this expense To fix':'marked this expense as resolved'} · {nfCommentTime(c.at)}</div>;
          const mine=(c.role==='finance')===isFinance;
          return <div key={c.id} data-nf-comment="true" style={{alignSelf:mine?'flex-end':'flex-start',maxWidth:'82%'}}>
            <div style={{background:mine?'var(--accent)':'#fff',color:mine?'#fff':'var(--text)',borderRadius:16,borderBottomRightRadius:mine?4:16,borderBottomLeftRadius:mine?16:4,padding:'9px 12px',fontSize:14,lineHeight:1.4,whiteSpace:'pre-wrap',wordBreak:'break-word',boxShadow:mine?'none':'0 1px 2px rgba(0,0,0,.06)'}}>{c.body}</div>
            <div style={{fontSize:10,color:'var(--t3)',marginTop:3,textAlign:mine?'right':'left'}}>{nfCommentAuthor(c)} · {nfCommentTime(c.at)}</div>
          </div>;
        })}
        <div ref={endRef}/>
      </div>
      <div style={{background:'rgba(249,249,249,.97)',borderTop:'.5px solid rgba(60,60,67,.22)',padding:isMobile?'10px 12px calc(10px + env(safe-area-inset-bottom))':'12px 16px',display:'grid',gap:8}}>
        {error&&<div style={{background:'var(--rl)',color:'var(--red)',borderRadius:10,padding:'8px 10px',fontSize:12,fontWeight:700}}>{error}</div>}
        {isFinance&&!toFix&&<label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,fontWeight:700,color:'var(--t2)'}}><input type="checkbox" checked={flag} onChange={ev=>setFlag(ev.target.checked)} style={{width:18,height:18}}/>Mark as To fix (the employee can edit it even in a closed month)</label>}
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <textarea data-nf-comment-input="true" value={text} onChange={ev=>setText(ev.target.value)} rows={2} maxLength={2000} placeholder={isFinance?'Write to the employee...':'Reply to finance...'} style={{...inp,flex:1,fontSize:16,resize:'none',minHeight:48,borderRadius:12,background:'#fff'}}/>
          <button type="button" data-nf-comment-send="true" disabled={busy||(!text.trim()&&!(isFinance&&flag&&!toFix))} onClick={()=>post()} style={{...bP,justifyContent:'center',minHeight:48,opacity:(busy||(!text.trim()&&!(isFinance&&flag&&!toFix)))?0.55:1}}>{busy?'...':'Send'}</button>
        </div>
        {isFinance&&toFix&&<button type="button" data-nf-resolve="true" disabled={busy} onClick={()=>post('ok')} style={{...bS,justifyContent:'center',color:'var(--green)'}}>Mark as resolved{text.trim()?' and send':''}</button>}
      </div>
    </div>
  </div>;
}
`;

    function must(target, replacement, label){
      // Pas de throw : une exception ici rendrait toute l'app inutilisable.
      // test-patches.js verifie chaque insertion par un marqueur REQUIRED.
      if(!html.includes(target)){ if(typeof console!=='undefined')console.warn('expense-comments: cible introuvable ('+label+')'); return; }
      html = html.replace(target, replacement);
    }

    must('function App(){', component + '\nfunction App(){', 'App');

    // 1. Les lignes lues de l'API portent les commentaires et le statut.
    must("submittedAt:r.submitted_at||null};}",
      "submittedAt:r.submitted_at||null,comments:Array.isArray(r.comments)?r.comments:[],reviewStatus:r.review_status||'ok'};}",
      'nr');

    // 2. Carte de frais employe : pastilles sous le commercant...
    must("{e.ubsRow&&<div style={{fontSize:11,color:'var(--green)',marginTop:3}}>↳ UBS: {e.ubsRow.label}</div>}",
      "{e.ubsRow&&<div style={{fontSize:11,color:'var(--green)',marginTop:3}}>↳ UBS: {e.ubsRow.label}</div>}{(e.reviewStatus==='to_fix'||nfCommentsOf(e).length>0)&&<div className=\"nf-review-wrap\" style={{marginTop:5}}><NfReviewChips expense={e}/></div>}",
      'carte employe : pastilles');

    // ... bouton de commentaires, et edition rouverte sur un frais « To fix »
    // d'un mois soumis (le serveur l'autorise, cf. api/expenses.js).
    const closed = "{e.submissionStatus==='submitted'?<span style={{fontSize:11,fontWeight:800,color:'var(--t3)',background:'var(--s2)',padding:'6px 9px',borderRadius:999}}>Closed</span>";
    must(closed,
      "<NfCommentsButton expense={e} compact={isMobile} onUpdated={upd=>setExpenses(prev=>prev.map(item=>String(item.id)===String(upd.id)?{...item,comments:upd.comments,reviewStatus:upd.reviewStatus}:item))}/>"
      + "{e.submissionStatus==='submitted'&&e.reviewStatus==='to_fix'?<button type=\"button\" data-nf-fix-edit=\"true\" onClick={()=>setEditingExpense(e)} style={{background:'none',border:'none',cursor:'pointer',color:'#C62828',fontSize:13,fontWeight:800,padding:4}} title=\"Edit\">{isMobile?'✏️':'Fix'}</button>:"
      + closed.slice(1),
      'carte employe : actions');

    // 3. Tableau finance : pastilles a cote des anomalies, bouton Comments.
    must("{rowIssues.length===0?<span",
      "<NfReviewChips expense={e}/>{rowIssues.length===0&&e.reviewStatus!=='to_fix'?<span",
      'finance : pastilles');
    must("<ReceiptThumbs expense={e} setViewer={setViewer}/><button onClick={()=>setEditing(e)}",
      "<ReceiptThumbs expense={e} setViewer={setViewer}/><NfCommentsButton expense={e} onUpdated={saveEdited}/><button onClick={()=>setEditing(e)}",
      'finance : bouton');

    // La refonte mobile masque le 3e enfant de la zone info (ligne UBS) et
    // habille en feuille du bas tout overlay fixe porte sur <body> : les deux
    // regles attrapaient nos elements.
    const style = '<style id="notesfrais-expense-comments-v1">'
      + 'body.nf-ios-mike .nf-ios-expense-info>div.nf-review-wrap:nth-child(n){display:block!important;margin-top:6px!important}'
      + 'body.nf-ios-mike>div[data-nf-comments-sheet][data-nf-comments-sheet]>div.nf-comments-panel{padding:0!important;box-shadow:none!important}'
      + '@media(max-width:859px){body.nf-ios-mike>div[data-nf-comments-sheet][data-nf-comments-sheet]>div.nf-comments-panel{border-radius:0!important}}'
      + '</style>';
    html = html.replace('</head>', style + '</head>');
    return html;
  };
})();
