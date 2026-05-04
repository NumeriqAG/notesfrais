(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_PERIOD_INSIDE_TABS_TEST_V2')) return html;

    html = html.replace(
      "const MONTHS=[{v:'2026-01',l:'Janvier 2026'},{v:'2026-02',l:'Février 2026'},{v:'2026-03',l:'Mars 2026'},{v:'2026-04',l:'Avril 2026'},{v:'2026-05',l:'Mai 2026'},{v:'2026-06',l:'Juin 2026'}];",
      "const MONTHS=[{v:'2026-01',l:'Janvier 2026'},{v:'2026-02',l:'Février 2026'},{v:'2026-03',l:'Mars 2026'},{v:'2026-04',l:'Avril 2026'},{v:'2026-05',l:'Mai 2026'},{v:'2026-06',l:'Juin 2026'},{v:'2026-07',l:'Juillet 2026'},{v:'2026-08',l:'Août 2026'},{v:'2026-09',l:'Septembre 2026'},{v:'2026-10',l:'Octobre 2026'},{v:'2026-11',l:'Novembre 2026'},{v:'2026-12',l:'Décembre 2026'}];"
    );

    const style = `<style id="notesfrais-test-period-inside-tabs-style">
      [data-period-selector="true"]{display:none!important;}
      [data-period-selector="true"] + div{display:none!important;}
    </style>`;
    html = html.replace('</head>', style + '\n</head>');

    const component = String.raw`
const NOTESFRAIS_PERIOD_INSIDE_TABS_TEST_V2=true;
function monthIndex(value){return MONTHS.findIndex(m=>m.v===value);}
function normalizePeriodRange(from,to){
  const fi=monthIndex(from),ti=monthIndex(to);
  if(fi<0||ti<0)return{from:MONTHS[0].v,to:MONTHS[MONTHS.length-1].v};
  return fi<=ti?{from,to}:{from:to,to:from};
}
function periodLabelFor(mode,month,from,to){
  if(mode==='year')return 'Toute l\u2019annee 2026';
  if(mode==='range'){
    const r=normalizePeriodRange(from,to);
    const a=MONTHS.find(m=>m.v===r.from)?.l||r.from;
    const b=MONTHS.find(m=>m.v===r.to)?.l||r.to;
    return a===b?a:a+' → '+b;
  }
  return MONTHS.find(m=>m.v===month)?.l||month;
}
function PeriodInsideTabs({periodMode,setPeriodMode,month,setMonth,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const selectStyle={...inp,background:'#fff',border:'0.5px solid var(--border)',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'10px 12px'};
  const modeBtn=(id,label)=><button onClick={()=>setPeriodMode(id)} style={{border:periodMode===id?'1.5px solid var(--accent)':'0.5px solid var(--border)',background:periodMode===id?'var(--al)':'#fff',color:periodMode===id?'var(--accent)':'var(--t2)',borderRadius:999,padding:'8px 12px',fontSize:12,fontWeight:800,cursor:'pointer'}}>{label}</button>;
  return <div style={{display:'grid',gap:9,minWidth:isMobile?'100%':360}}>
    <div style={{display:'flex',gap:7,flexWrap:'wrap',justifyContent:isMobile?'stretch':'flex-end'}}>
      {modeBtn('month','Mois')}
      {modeBtn('range','Plage')}
      {modeBtn('year','Toute l\u2019annee')}
    </div>
    {periodMode==='month'&&<select value={month} onChange={e=>{setMonth(e.target.value);setPeriodFrom(e.target.value);setPeriodTo(e.target.value);}} style={selectStyle}>
      {MONTHS.map(m=><option key={m.v} value={m.v}>{monthCounts[m.v]>0?m.l+' ('+monthCounts[m.v]+')':m.l}</option>)}
    </select>}
    {periodMode==='range'&&<div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:8}}>
      <select value={periodFrom} onChange={e=>{setPeriodFrom(e.target.value);setMonth(e.target.value);}} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>De {m.l}</option>)}</select>
      <select value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>à {m.l}</option>)}</select>
    </div>}
    {periodMode==='year'&&<div style={{...selectStyle,color:'var(--accent)',fontWeight:800,textAlign:isMobile?'left':'right'}}>Toute l\u2019annee 2026 · {Object.values(monthCounts||{}).reduce((s,n)=>s+Number(n||0),0)} frais</div>}
  </div>;
}
function PeriodHeader({title,subtitle,periodMode,setPeriodMode,month,setMonth,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexDirection:(typeof window!=='undefined'&&window.innerWidth<860)?'column':'row',marginBottom:20}}>
    <div style={{minWidth:0}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{title}</h1>{subtitle&&<div style={{fontSize:13,color:'var(--t3)'}}>{subtitle}</div>}</div>
    <PeriodInsideTabs periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>
  </div>;
}
`;

    html = html.replace('function App(){', component + '\nfunction App(){');

    html = html.replace(
      "const [month,setMonth]=useState(()=>getDefaultNotesFraisMonth());",
      "const [month,setMonth]=useState(()=>getDefaultNotesFraisMonth());\n  const [periodMode,setPeriodMode]=useState('month');\n  const [periodFrom,setPeriodFrom]=useState(()=>getDefaultNotesFraisMonth());\n  const [periodTo,setPeriodTo]=useState(()=>getDefaultNotesFraisMonth());"
    );

    html = html.replace(
      "const mE=useMemo(()=>expenses.filter(e=>e.date?.startsWith(month)),[expenses,month]);",
      "const periodRange=periodMode==='year'?{from:MONTHS[0].v,to:MONTHS[MONTHS.length-1].v}:periodMode==='range'?normalizePeriodRange(periodFrom,periodTo):{from:month,to:month};\n  const periodStart=periodRange.from+'-01';\n  const periodEnd=lastDayOfMonth(periodRange.to);\n  const mE=useMemo(()=>expenses.filter(e=>e.date&&e.date>=periodStart&&e.date<=periodEnd),[expenses,periodStart,periodEnd]);"
    );

    html = html.replace(
      "const ML=MONTHS.find(m2=>m2.v===month)?.l||month;",
      "const ML=periodLabelFor(periodMode,month,periodFrom,periodTo);"
    );

    html = html.replace(
      "const submissionStatus=getSubmissionStatusForMonth(month,mE);",
      "const submissionStatus=periodMode==='month'?getSubmissionStatusForMonth(month,mE):'pending';"
    );

    html = html.replace(
      "if(mE.length===0||syncing||submissionStatus==='submitted')return;",
      "if(periodMode!=='month'||mE.length===0||syncing||submissionStatus==='submitted')return;"
    );

    html = html.replace(
      "<div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{ML}</h1><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>",
      "<div style={{marginBottom:24}}><PeriodHeader title={ML} subtitle={null} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>"
    );

    html = html.replace(
      "{tab==='history'&&<div style={{maxWidth:isMobile?'100%':800}}><div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Historique</h1><div style={{fontSize:13,color:'var(--t3)'}}>{ML} · {fil.length} frais · {fil.filter(e=>e.receiptPath||e.receiptUrl).length} avec justificatif</div></div>",
      "{tab==='history'&&<div style={{maxWidth:isMobile?'100%':800}}><PeriodHeader title={'Historique'} subtitle={ML+' · '+fil.length+' frais · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' avec justificatif'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>"
    );

    html = html.replace(
      "{tab==='recon'&&<div style={{maxWidth:isMobile?'100%':680}}><div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Relevé UBS</h1><div style={{fontSize:13,color:'var(--t3)'}}>Réconciliation automatique</div></div>",
      "{tab==='recon'&&<div style={{maxWidth:isMobile?'100%':680}}><PeriodHeader title={'Relevé UBS'} subtitle={'Réconciliation automatique · '+ML} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>"
    );

    html = html.replace(
      "<button disabled={mE.length===0||syncing||submissionStatus==='submitted'} onClick={submitCurrentMonth}",
      "<button disabled={periodMode!=='month'||mE.length===0||syncing||submissionStatus==='submitted'} onClick={submitCurrentMonth}"
    );

    html = html.replace(
      "opacity:(mE.length===0||syncing||submissionStatus==='submitted')?0.55:1",
      "opacity:(periodMode!=='month'||mE.length===0||syncing||submissionStatus==='submitted')?0.55:1"
    );

    html = html.replace(
      "{submissionStatus==='submitted'?'Déjà soumis':syncing?'Soumission...':'Confirmer la soumission'}</button>",
      "{periodMode!=='month'?'Choisir un mois précis':submissionStatus==='submitted'?'Déjà soumis':syncing?'Soumission...':'Confirmer la soumission'}</button>"
    );

    return html;
  };
})();
