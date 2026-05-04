(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_SUBMISSION_BADGE_TEST_V4')) return html;

    const helpers = String.raw`
const NOTESFRAIS_SUBMISSION_BADGE_TEST_V4=true;
function getCurrentSubmissionMonthKey(){
  const now=new Date();
  return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
}
function getSubmissionStatusForMonth(month,items){
  const list=Array.isArray(items)?items:[];
  if(list.length>0&&list.every(e=>(e.submissionStatus||'pending')==='submitted'))return 'submitted';
  return month<getCurrentSubmissionMonthKey()?'to_submit':'pending';
}
function getSubmissionStatusBadge(status){
  if(status==='submitted')return{label:'Soumis',hint:'envoye a la finance',bg:'var(--gl)',color:'var(--green)',border:'#BDEAD9'};
  if(status==='to_submit')return{label:'A soumettre',hint:'mois termine',bg:'var(--aml)',color:'var(--amber)',border:'#F0D391'};
  return{label:'En cours',hint:'saisie en cours',bg:'var(--al)',color:'var(--accent)',border:'#C7D5FF'};
}
`;

    html = html.replace('function App(){', helpers + '\nfunction App(){');

    html = html.replace(
      "receiptName:r.receipt_name||null};}",
      "receiptName:r.receipt_name||null,submissionStatus:r.submission_status||'pending',submittedAt:r.submitted_at||null};}"
    );

    html = html.replace(
      "const pct=mE.length>0?Math.round(rec.length/mE.length*100):0;",
      String.raw`const pct=mE.length>0?Math.round(rec.length/mE.length*100):0;
  const submissionStatus=getSubmissionStatusForMonth(month,mE);
  const submissionBadge=getSubmissionStatusBadge(submissionStatus);
  const submitCurrentMonth=async()=>{
    if(mE.length===0||syncing||submissionStatus==='submitted')return;
    setSyncing(true);
    try{
      const submittedAt=new Date().toISOString();
      const{error}=await sb.from('expenses')
        .update({submission_status:'submitted',submitted_at:submittedAt})
        .gte('date',month+'-01')
        .lte('date',lastDayOfMonth(month))
        .eq('app_channel',currentNotesFraisChannel());
      if(error)throw error;
      setExpenses(prev=>prev.map(exp=>exp.date&&exp.date.startsWith(month)?{...exp,submissionStatus:'submitted',submittedAt}:exp));
      setShowSubmitSummary(false);
      setSubmitted(true);
      notify('📨 Frais soumis a la finance');
      setTimeout(()=>setSubmitted(false),3000);
    }catch(e){
      notify('❌ Soumission impossible: '+(e.message||e));
    }finally{
      setSyncing(false);
    }
  };`
    );

    html = html.replace(
      "<div style={{fontSize:13,color:'var(--t3)'}}>Tableau de bord des frais professionnels</div>",
      "<div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><div style={{fontSize:13,color:'var(--t3)'}}>Tableau de bord des frais professionnels</div></div><div style={{display:'inline-flex',alignItems:'center',gap:7,background:submissionBadge.bg,color:submissionBadge.color,border:'0.5px solid '+submissionBadge.border,borderRadius:999,padding:'7px 11px',fontSize:12,fontWeight:800,whiteSpace:'nowrap'}}><span>{submissionBadge.label}</span><span style={{fontWeight:500,opacity:0.75}}>· {submissionBadge.hint}</span></div></div>"
    );

    html = html.replace(
      "<button disabled={mE.length===0} onClick={()=>{setShowSubmitSummary(false);setSubmitted(true);notify('📧 Frais soumis au service RH !');setTimeout(()=>setSubmitted(false),3000);}} style={{...bP,justifyContent:'center',opacity:mE.length===0?0.55:1}}>Confirmer la soumission</button>",
      "<button disabled={mE.length===0||syncing||submissionStatus==='submitted'} onClick={submitCurrentMonth} style={{...bP,justifyContent:'center',opacity:(mE.length===0||syncing||submissionStatus==='submitted')?0.55:1}}>{submissionStatus==='submitted'?'Déjà soumis':syncing?'Soumission...':'Confirmer la soumission'}</button>"
    );

    return html;
  };
})();
