(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_MONTH_REVIEW_V1')) return html;

    // Circuit de validation au niveau du MOIS (choix de Thomas, nov. 2026) :
    // la finance approuve un mois soumis, le renvoie a l'utilisateur (ce qui le
    // rouvre) ou le marque rembourse. L'etat vit cote serveur dans la table
    // month_reviews, servie par /api/month-review.
    //
    // Charge APRES english-final.js : les chaines ne passent par aucune paire
    // de traduction, elles sont ecrites ici directement en anglais (les deux
    // canaux portent la meme interface anglaise) et les cibles sont copiees du
    // HTML final (node tools/check-patches.js mike).
    //
    // Chaque cible manquante leve une erreur : un replace() sans effet ferait
    // disparaitre la fonctionnalite sans un mot (CLAUDE.md §1, panne n°1).
    const rep = (label, target, replacement) => {
      if(!html.includes(target)) throw new Error('month-review: cible introuvable ('+label+')');
      html = html.replace(target, replacement);
    };

    // 1. Store partage + composants, avant App.
    rep('App', 'function App(){', `const NOTESFRAIS_MONTH_REVIEW_V1=true;
const nfMonthReviewStore={data:{},listeners:new Set(),pending:null};
function nfMonthReviewEmit(){const data=nfMonthReviewStore.data;nfMonthReviewStore.listeners.forEach(fn=>fn(data));}
function nfMonthReviewLoad(){
  if(nfMonthReviewStore.pending)return nfMonthReviewStore.pending;
  const year=String(typeof NOTESFRAIS_YEAR!=='undefined'?NOTESFRAIS_YEAR:new Date().getFullYear());
  const params=new URLSearchParams({from:year+'-01',to:year+'-12'});
  if(window.notesFraisRole==='finance')params.set('channel',NOTESFRAIS_CHANNEL==='test'?'test':'mike');
  nfMonthReviewStore.pending=notesFraisApi('/api/month-review?'+params.toString())
    .then(out=>{const map={};(out&&out.data||[]).forEach(r=>{if(r&&r.month)map[r.month]=r;});nfMonthReviewStore.data=map;nfMonthReviewEmit();})
    .catch(()=>{})
    .finally(()=>{nfMonthReviewStore.pending=null;});
  return nfMonthReviewStore.pending;
}
function nfMonthReviewPut(month,row){const map={...nfMonthReviewStore.data};if(row)map[month]=row;else delete map[month];nfMonthReviewStore.data=map;nfMonthReviewEmit();}
function useNfMonthReviews(refreshKey){
  const [data,setData]=useState(nfMonthReviewStore.data);
  useEffect(()=>{nfMonthReviewStore.listeners.add(setData);setData(nfMonthReviewStore.data);return()=>{nfMonthReviewStore.listeners.delete(setData);};},[]);
  useEffect(()=>{if(window.notesFraisRole)nfMonthReviewLoad();},[refreshKey]);
  return data;
}
// open | submitted | approved | reimbursed | sent_back
function nfMonthReviewState(review,submitted){
  const status=review&&review.status;
  if(!submitted)return status==='sent_back'?'sent_back':'open';
  if(status==='approved'||status==='reimbursed')return status;
  return 'submitted';
}
const NF_MONTH_REVIEW_META={
  open:{label:'In progress',bg:'var(--al)',color:'var(--accent)',border:'#C7D5FF'},
  submitted:{label:'Awaiting review',bg:'var(--aml)',color:'var(--amber)',border:'#F0D391'},
  approved:{label:'Approved',bg:'var(--gl)',color:'var(--green)',border:'#BDEAD9'},
  reimbursed:{label:'Reimbursed',bg:'var(--gl)',color:'var(--green)',border:'#BDEAD9'},
  sent_back:{label:'Sent back',bg:'var(--rl)',color:'var(--red)',border:'#F3C6C6'}
};
function nfMonthReviewDay(review){return review&&review.decided_at?fd(String(review.decided_at).slice(0,10)):'';}
function NfMonthReviewPill({state}){
  const meta=NF_MONTH_REVIEW_META[state]||NF_MONTH_REVIEW_META.open;
  return <span data-nf-month-review={state} style={{background:meta.bg,color:meta.color,border:'0.5px solid '+meta.border,borderRadius:999,padding:'4px 9px',fontSize:11,fontWeight:900,whiteSpace:'nowrap'}}>{meta.label}</span>;
}
function NfDashboardReviewPill({month,status}){
  const reviews=useNfMonthReviews('dashboard');
  const state=nfMonthReviewState(reviews[month],status==='submitted');
  if(state==='open'||state==='submitted')return null;
  return <NfMonthReviewPill state={state}/>;
}
function nfUserMonthBadge(reviews,month){
  const state=nfMonthReviewState(reviews[month],true);
  return state==='approved'?'Approved':state==='reimbursed'?'Reimbursed':'Submitted';
}
function NfUserMonthReviewBanner({review,submitted,ML}){
  const state=nfMonthReviewState(review,submitted);
  const day=nfMonthReviewDay(review);
  if(state==='sent_back')return <div data-nf-month-review-banner="sent_back" style={{background:'var(--rl)',border:'0.5px solid #F3C6C6',color:'var(--red)',borderRadius:14,padding:'12px 14px',marginBottom:14}}>
    <div style={{fontWeight:900,fontSize:14}}>{'Finance sent '+ML+' back'+(day?' on '+day:'')}</div>
    {review.note&&<div style={{fontSize:13,color:'var(--text)',marginTop:6,whiteSpace:'pre-wrap',lineHeight:1.45}}>{review.note}</div>}
    <div style={{fontSize:12,marginTop:6,opacity:.85}}>The month is open again. Make the changes, then submit it again.</div>
  </div>;
  if(state==='approved'||state==='reimbursed')return <div data-nf-month-review-banner={state} style={{background:'var(--gl)',border:'0.5px solid #BDEAD9',color:'var(--green)',borderRadius:14,padding:'12px 14px',marginBottom:14}}>
    <div style={{fontWeight:900,fontSize:14}}>{(state==='reimbursed'?'Reimbursed':'Approved by finance')+(day?' on '+day:'')}</div>
    {review.note&&<div style={{fontSize:13,color:'var(--text)',marginTop:6,whiteSpace:'pre-wrap',lineHeight:1.45}}>{review.note}</div>}
  </div>;
  return null;
}
function NfFinanceMonthDecision({month,ML,mE,setExpenses,isMobile}){
  const reviews=useNfMonthReviews(month);
  const review=reviews[month]||null;
  const submitted=mE.length>0&&mE.every(e=>(e.submissionStatus||'pending')==='submitted');
  const state=nfMonthReviewState(review,submitted);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [sendingBack,setSendingBack]=useState(false);
  const [reason,setReason]=useState('');
  useEffect(()=>{setSendingBack(false);setReason('');setError('');},[month]);
  if(state==='open')return null;
  const channel=NOTESFRAIS_CHANNEL==='test'?'test':'mike';
  const run=async(action,note)=>{
    setBusy(action);setError('');
    try{
      const out=await notesFraisApi('/api/month-review',{method:'POST',body:JSON.stringify({month,channel,action,note:note||''})});
      nfMonthReviewPut(month,out.review||null);
      if(action==='send_back'&&setExpenses){
        setExpenses(prev=>prev.map(e=>String(e.date||'').startsWith(month)&&e.submissionStatus==='submitted'?{...e,submissionStatus:'pending',submittedAt:null}:e));
      }
      setSendingBack(false);setReason('');
    }catch(err){
      setError(err.message||String(err));
    }finally{
      setBusy('');
    }
  };
  const day=nfMonthReviewDay(review);
  const title={submitted:'Waiting for your decision',approved:'Approved'+(day?' on '+day:''),reimbursed:'Reimbursed'+(day?' on '+day:''),sent_back:'Sent back to the user'+(day?' on '+day:'')}[state];
  const hint={submitted:'Approve the month, or send it back so the expenses can be fixed.',approved:'Mark it reimbursed once the payment is made.',reimbursed:'This month is closed.',sent_back:'The month is open again. It comes back here once it is submitted again.'}[state];
  const small={...bS,padding:'9px 12px',fontSize:13,justifyContent:'center'};
  const main={...bP,padding:'9px 14px',fontSize:13,justifyContent:'center'};
  const off=v=>({opacity:busy&&busy!==v?0.5:1});
  return <div data-nf-month-decision={state} style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:isMobile?14:16,marginBottom:14}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row'}}>
      <div style={{minWidth:0}}>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span style={{fontSize:15,fontWeight:900}}>{'Decision for '+ML}</span><NfMonthReviewPill state={state}/></div>
        <div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{title+' · '+hint}</div>
        {review&&review.note&&<div style={{fontSize:12,color:'var(--t2)',marginTop:6,whiteSpace:'pre-wrap'}}>{'Note: '+review.note}</div>}
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {state==='submitted'&&<button type="button" disabled={!!busy} onClick={()=>run('approve')} style={{...main,...off('approve')}}>{busy==='approve'?'Approving...':'Approve month'}</button>}
        {state==='approved'&&<button type="button" disabled={!!busy} onClick={()=>run('reimburse')} style={{...main,...off('reimburse')}}>{busy==='reimburse'?'Saving...':'Mark reimbursed'}</button>}
        {(state==='submitted'||state==='approved')&&!sendingBack&&<button type="button" disabled={!!busy} onClick={()=>{setSendingBack(true);setError('');}} style={{...small,color:'var(--red)',borderColor:'#F3C6C6',...off('send_back')}}>Send back to user</button>}
        {(state==='approved'||state==='reimbursed')&&<button type="button" disabled={!!busy} onClick={()=>run('undo')} style={{...small,...off('undo')}}>{busy==='undo'?'Undoing...':state==='reimbursed'?'Undo reimbursed':'Undo approval'}</button>}
      </div>
    </div>
    {sendingBack&&<div data-nf-send-back-form="true" style={{marginTop:12,display:'grid',gap:8}}>
      <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>What needs to change? The user sees this note.<textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} placeholder="Missing receipt for..., wrong card on..." style={{...inp,fontSize:isMobile?16:13,resize:'vertical'}}/></label>
      <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}><button type="button" disabled={!!busy} onClick={()=>{setSendingBack(false);setReason('');}} style={small}>Cancel</button><button type="button" disabled={!!busy||!reason.trim()} onClick={()=>run('send_back',reason.trim())} style={{...main,background:'var(--red)',borderColor:'var(--red)',opacity:(!!busy||!reason.trim())?0.55:1}}>{busy==='send_back'?'Sending back...':'Send back and reopen the month'}</button></div>
    </div>}
    {error&&<div style={{marginTop:10,background:'var(--rl)',color:'var(--red)',borderRadius:10,padding:10,fontSize:12,fontWeight:800}}>{error}</div>}
  </div>;
}
function App(){`);

    // 2. App : l'utilisateur lit l'etat du mois, recharge a chaque changement
    //    de mois ou de statut de soumission (soumettre efface un renvoi).
    const statusLine = "  const submissionStatus=periodMode==='month'?getSubmissionStatusForMonth(month,mE):'pending';";
    rep('App submissionStatus', statusLine, statusLine + "\n  const nfMonthReviews=useNfMonthReviews(month+'|'+submissionStatus);");

    // 3. Mike : libelle de la pastille du recapitulatif mensuel.
    rep('badge utilisateur',
      "{submissionStatus==='submitted'?'Submitted':offlineCount>0?",
      "{submissionStatus==='submitted'?nfUserMonthBadge(nfMonthReviews,month):offlineCount>0?");

    // 4. Mike : bandeau de decision (renvoi avec motif, approbation, remboursement).
    rep('bandeau utilisateur',
      '<div className="nfm-sum-head">',
      '<NfUserMonthReviewBanner review={nfMonthReviews[month]||null} submitted={submissionStatus===\'submitted\'} ML={ML}/><div className="nfm-sum-head">');

    // 5. Finance : bloc de decision au-dessus des indicateurs de la revue du mois.
    rep('finance decision',
      "\n    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:14}}>",
      "\n    {periodMode==='month'&&<NfFinanceMonthDecision month={month} ML={ML} mE={mE} setExpenses={setExpenses} isMobile={isMobile}/>}\n    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:14}}>");

    // 6. Finance : pastille de decision a cote du statut de chaque mois du dashboard.
    rep('dashboard',
      "{meta.label}</span></div>",
      "{meta.label}</span><NfDashboardReviewPill month={r.v} status={r.status}/></div>");

    return html;
  };
})();
