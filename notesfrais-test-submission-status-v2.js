(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_SUBMISSION_STATUS_TEST_V2')) return html;

    const helpers = String.raw`
const NOTESFRAIS_SUBMISSION_STATUS_TEST_V2=true;
function getCurrentNotesFraisMonthKey(){
  const now=new Date();
  return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
}
function getMonthSubmissionStatus(month,items){
  const list=items||[];
  if(list.length>0&&list.every(e=>e.submissionStatus==='submitted'))return 'submitted';
  return month<getCurrentNotesFraisMonthKey()?'to_submit':'pending';
}
function submissionStatusMeta(status){
  if(status==='submitted')return{label:'Soumis',hint:'Envoye a la finance',bg:'var(--gl)',color:'var(--green)',icon:'✓'};
  if(status==='to_submit')return{label:'A soumettre',hint:'Mois termine, en attente d envoi',bg:'var(--aml)',color:'var(--amber)',icon:'!'};
  return{label:'En cours',hint:'Mike complete encore ce mois',bg:'var(--al)',color:'var(--accent)',icon:'•'};
}
`;

    html = html.replace('function App(){', helpers + '\nfunction App(){');

    html = html.replace(
      "receiptName:r.receipt_name||null};}",
      "receiptName:r.receipt_name||null,submissionStatus:r.submission_status||'pending',submittedAt:r.submitted_at||null};}"
    );

    html = html.replace(
      "const pct=mE.length>0?Math.round(rec.length/mE.length*100):0;",
      "const pct=mE.length>0?Math.round(rec.length/mE.length*100):0;\n  const monthSubmissionStatus=getMonthSubmissionStatus(month,mE);\n  const monthSubmissionMeta=submissionStatusMeta(monthSubmissionStatus);"
    );

    html = html.replace(
      "const deleteExpense=useCallback(async(id,receiptPath)=>{try{await deleteById(id,receiptPath);setExpenses(p=>p.filter(e=>e.id!==id));notify('🗑 Frais supprimé');}catch(e){notify('❌ Erreur: '+e.message);}},[]);",
      String.raw`const deleteExpense=useCallback(async(id,receiptPath)=>{try{await deleteById(id,receiptPath);setExpenses(p=>p.filter(e=>e.id!==id));notify('🗑 Frais supprimé');}catch(e){notify('❌ Erreur: '+e.message);}},[]);
  const submitMonth=useCallback(async()=>{
    if(mE.length===0)return;
    setSyncing(true);
    try{
      const submittedAt=new Date().toISOString();
      const{error}=await sb.from('expenses')
        .update({submission_status:'submitted',submitted_at:submittedAt})
        .gte('date',month+'-01')
        .lte('date',lastDayOfMonth(month))
        .eq('app_channel',currentNotesFraisChannel());
      if(error)throw error;
      setExpenses(p=>p.map(e=>e.date&&e.date.startsWith(month)?{...e,submissionStatus:'submitted',submittedAt}:e));
      setShowSubmitSummary(false);
      setSubmitted(true);
      notify('📨 Frais soumis au département finance !');
      setTimeout(()=>setSubmitted(false),3000);
    }catch(e){notify('❌ Erreur soumission: '+(e.message||e));}
    finally{setSyncing(false);}
  },[month,mE.length]);`
    );

    html = html.replace(
      "<div style={{fontSize:13,color:'var(--t3)'}}>Tableau de bord des frais professionnels</div>",
      "<div style={{fontSize:13,color:'var(--t3)'}}>Tableau de bord des frais professionnels</div>{monthSubmissionMeta&&<div style={{display:'inline-flex',alignItems:'center',gap:7,marginTop:10,background:monthSubmissionMeta.bg,color:monthSubmissionMeta.color,borderRadius:999,padding:'7px 11px',fontSize:12,fontWeight:800}}><span>{monthSubmissionMeta.icon}</span><span>{monthSubmissionMeta.label}</span><span style={{fontWeight:500,opacity:0.78}}>· {monthSubmissionMeta.hint}</span></div>}"
    );

    html = html.replace(
      "<button disabled={mE.length===0} onClick={()=>{setShowSubmitSummary(false);setSubmitted(true);notify('📧 Frais soumis au service RH !');setTimeout(()=>setSubmitted(false),3000);}} style={{...bP,justifyContent:'center',opacity:mE.length===0?0.55:1}}>Confirmer la soumission</button>",
      "<button disabled={mE.length===0||monthSubmissionStatus==='submitted'} onClick={submitMonth} style={{...bP,justifyContent:'center',opacity:(mE.length===0||monthSubmissionStatus==='submitted')?0.55:1}}>{monthSubmissionStatus==='submitted'?'Déjà soumis':'Confirmer la soumission'}</button>"
    );

    html = html.replace(
      "<button onClick={()=>setShowSubmitSummary(true)} style={{...bP,width:isMobile?'100%':'auto',justifyContent:'center',padding:'14px 24px',background:submitted?'var(--green)':'var(--accent)',transition:'background 0.3s',fontSize:14}}>{submitted?'✓ Frais soumis !':'📤 Soumettre les frais du mois'}</button>",
      "<button disabled={mE.length===0||monthSubmissionStatus==='submitted'} onClick={()=>setShowSubmitSummary(true)} style={{...bP,width:isMobile?'100%':'auto',justifyContent:'center',padding:'14px 24px',background:submitted||monthSubmissionStatus==='submitted'?'var(--green)':'var(--accent)',transition:'background 0.3s',fontSize:14,opacity:(mE.length===0||monthSubmissionStatus==='submitted')?0.7:1}}>{monthSubmissionStatus==='submitted'?'✓ Frais déjà soumis':submitted?'✓ Frais soumis !':'📤 Soumettre les frais du mois'}</button>"
    );

    return html;
  };
})();
