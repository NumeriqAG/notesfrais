(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_PERIOD_INSIDE_TABS_TEST_V1')) return html;

    const style = `<style id="notesfrais-test-period-inside-tabs-style">
      [data-period-selector="true"]{display:none!important;}
      [data-period-selector="true"] + div{display:none!important;}
    </style>`;
    html = html.replace('</head>', style + '\n</head>');

    const component = String.raw`
const NOTESFRAIS_PERIOD_INSIDE_TABS_TEST_V1=true;
function PeriodInsideTabs({month,setMonth,monthCounts,compact=false}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const selected=MONTHS.find(m=>m.v===month);
  if(isMobile||compact){
    return <select value={month} onChange={e=>setMonth(e.target.value)} style={{...inp,width:isMobile?'100%':220,fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'10px 12px',background:'#fff',border:'0.5px solid var(--border)'}}>
      {MONTHS.map(m=><option key={m.v} value={m.v}>{monthCounts[m.v]>0?m.l+' ('+monthCounts[m.v]+')':m.l}</option>)}
    </select>;
  }
  return <div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>
    {MONTHS.map(m=><button key={m.v} onClick={()=>setMonth(m.v)} style={{border:month===m.v?'1.5px solid var(--accent)':'0.5px solid var(--border)',background:month===m.v?'var(--al)':'#fff',color:month===m.v?'var(--accent)':'var(--t2)',borderRadius:999,padding:'8px 11px',fontSize:12,fontWeight:month===m.v?800:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:6}}><span>{m.l.replace(' 2026','')}</span>{monthCounts[m.v]>0&&<span style={{minWidth:18,height:18,borderRadius:999,background:month===m.v?'rgba(45,91,227,0.16)':'var(--s2)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:900}}>{monthCounts[m.v]}</span>}</button>)}
  </div>;
}
function PeriodHeader({title,subtitle,month,setMonth,monthCounts}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14,flexDirection:(typeof window!=='undefined'&&window.innerWidth<860)?'column':'row',marginBottom:20}}>
    <div style={{minWidth:0}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{title}</h1>{subtitle&&<div style={{fontSize:13,color:'var(--t3)'}}>{subtitle}</div>}</div>
    <PeriodInsideTabs month={month} setMonth={setMonth} monthCounts={monthCounts}/>
  </div>;
}
`;

    html = html.replace('function App(){', component + '\nfunction App(){');

    html = html.replace(
      "<div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{ML}</h1><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>",
      "<div style={{marginBottom:24}}><PeriodHeader title={ML} subtitle={null} month={month} setMonth={setMonth} monthCounts={monthCounts}/><div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>"
    );

    html = html.replace(
      "{tab==='history'&&<div style={{maxWidth:isMobile?'100%':800}}><div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Historique</h1><div style={{fontSize:13,color:'var(--t3)'}}>{ML} · {fil.length} frais · {fil.filter(e=>e.receiptPath||e.receiptUrl).length} avec justificatif</div></div>",
      "{tab==='history'&&<div style={{maxWidth:isMobile?'100%':800}}><PeriodHeader title={'Historique'} subtitle={ML+' · '+fil.length+' frais · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' avec justificatif'} month={month} setMonth={setMonth} monthCounts={monthCounts}/>"
    );

    html = html.replace(
      "{tab==='recon'&&<div style={{maxWidth:isMobile?'100%':680}}><div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Relevé UBS</h1><div style={{fontSize:13,color:'var(--t3)'}}>Réconciliation automatique</div></div>",
      "{tab==='recon'&&<div style={{maxWidth:isMobile?'100%':680}}><PeriodHeader title={'Relevé UBS'} subtitle={'Réconciliation automatique · '+ML} month={month} setMonth={setMonth} monthCounts={monthCounts}/>"
    );

    return html;
  };
})();
