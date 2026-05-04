(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_SUBMISSION_BADGE_TEST_SAFE_V3')) return html;

    const helpers = String.raw`
const NOTESFRAIS_SUBMISSION_BADGE_TEST_SAFE_V3=true;
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
      "const pct=mE.length>0?Math.round(rec.length/mE.length*100):0;\n  const submissionBadge=getSubmissionStatusBadge(getSubmissionStatusForMonth(month,mE));"
    );

    html = html.replace(
      "<div style={{fontSize:13,color:'var(--t3)'}}>Tableau de bord des frais professionnels</div>",
      "<div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><div style={{fontSize:13,color:'var(--t3)'}}>Tableau de bord des frais professionnels</div></div><div style={{display:'inline-flex',alignItems:'center',gap:7,background:submissionBadge.bg,color:submissionBadge.color,border:'0.5px solid '+submissionBadge.border,borderRadius:999,padding:'7px 11px',fontSize:12,fontWeight:800,whiteSpace:'nowrap'}}><span>{submissionBadge.label}</span><span style={{fontWeight:500,opacity:0.75}}>· {submissionBadge.hint}</span></div></div>"
    );

    return html;
  };
})();
