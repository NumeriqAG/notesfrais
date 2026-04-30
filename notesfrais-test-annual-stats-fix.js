(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_ANNUAL_STATS_FIX_DONE')) return html;
    html = html.replace('</script>', '<!-- NOTESFRAIS_ANNUAL_STATS_FIX_DONE --></script>');

    html = html.replace(
      /const loadData=useCallback\(async\(\)=>\{[\s\S]*?\},\[month\]\);\s*useEffect\(\(\)=>\{loadData\(\);\},\[loadData\]\);/,
      `const loadData=useCallback(async()=>{
    setLoading(true);setDbError(null);
    let timedOut=false;
    const bootTimer=setTimeout(()=>{
      timedOut=true;
      setDbError('Mode local - connexion indisponible. Les frais saisis hors ligne restent sur cet appareil.');
      setLoading(false);
    },NOTESFRAIS_FETCH_TIMEOUT_MS+1000);
    try{
      const batches=await Promise.all(MONTHS.map(m=>fetchExpensesWithTimeout(m.v)));
      const all=batches.flat().sort((a,b)=>new Date(b.date)-new Date(a.date));
      if(!timedOut)setExpenses(all);
    }catch(e){
      setDbError(e.message);
    }finally{
      clearTimeout(bootTimer);
      setLoading(false);
    }
  },[]);
  useEffect(()=>{loadData();},[loadData]);`
    );

    const statsTab = String.raw`function StatsTab({expenses,month,months}){
  const [scope,setScope]=useState('year');
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const scoped=useMemo(()=>scope==='year'?expenses:expenses.filter(e=>e.date&&e.date.startsWith(scope)),[expenses,scope]);
  const title=scope==='year'?'Annee 2026':(months.find(m=>m.v===scope)?.l||scope);
  const total=tot(scoped);
  const tva=scoped.reduce((s,e)=>s+Number(e.tva||0),0);
  const reconciled=scoped.filter(e=>e.status==='reconciled').length;
  const receiptCount=scoped.filter(e=>e.receiptPath||e.receiptUrl).length;
  const cardLabel=typeof getPaymentCardLabel==='function'?getPaymentCardLabel:(note=>{const m=String(note||'').match(/Carte utilisee:\s*(entreprise|perso)/i);return !m?'':m[1].toLowerCase()==='entreprise'?'Carte entreprise':'Carte perso';});
  const bycat=CATS.map(c=>({...c,total:tot(scoped.filter(e=>e.category===c.id)),count:scoped.filter(e=>e.category===c.id).length})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
  const bymonth=months.map(m=>{const items=expenses.filter(e=>e.date&&e.date.startsWith(m.v));return {...m,total:tot(items),count:items.length};}).filter(m=>m.count>0);
  const cards=[
    {label:'Carte entreprise',items:scoped.filter(e=>cardLabel(e.note)==='Carte entreprise'),color:'var(--accent)'},
    {label:'Carte perso',items:scoped.filter(e=>cardLabel(e.note)==='Carte perso'),color:'var(--amber)'}
  ].filter(r=>r.items.length>0).map(r=>({...r,total:tot(r.items)}));
  const maxCat=Math.max(1,...bycat.map(c=>c.total));
  const maxMonth=Math.max(1,...bymonth.map(m=>m.total));
  const maxCard=Math.max(1,...cards.map(c=>c.total));
  const panel={background:'#fff',borderRadius:14,border:'0.5px solid var(--border)',padding:isMobile?14:18};
  const statCards=[
    {l:'Total',v:'CHF '+fmt(total),s:scoped.length+' frais'},
    {l:'TVA',v:'CHF '+fmt(tva),s:'recuperable'},
    {l:'Justificatifs',v:receiptCount+'/'+scoped.length,s:scoped.length?Math.round(receiptCount/scoped.length*100)+'%':'aucun'},
    {l:'Reconcilies',v:reconciled+'/'+scoped.length,s:scoped.length?Math.round(reconciled/scoped.length*100)+'%':'apres UBS'}
  ];
  return <div style={{maxWidth:920,paddingBottom:isMobile?130:0}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:isMobile?'stretch':'flex-end',flexDirection:isMobile?'column':'row',gap:12,marginBottom:20}}>
      <div><h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Statistiques</h1><div style={{fontSize:13,color:'var(--t3)'}}>{title} · annuel par defaut, filtre mensuel si besoin</div></div>
      <div style={{minWidth:isMobile?'100%':230}}><label style={lbl}>Periode</label><select value={scope} onChange={e=>setScope(e.target.value)} style={{...inp,background:'#fff'}}><option value="year">Toute l'annee 2026</option>{months.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:16}}>{statCards.map(c=><div key={c.l} style={panel}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',marginBottom:7}}>{c.l.toUpperCase()}</div><div style={{fontSize:isMobile?18:22,fontWeight:800,fontFamily:'DM Mono'}}>{c.v}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{c.s}</div></div>)}</div>
    {scoped.length===0?<div style={{...panel,textAlign:'center',padding:'48px 20px'}}><div style={{fontSize:42,marginBottom:10}}>📊</div><div style={{fontWeight:700,marginBottom:4}}>Aucune donnee pour cette periode</div><div style={{fontSize:13,color:'var(--t3)'}}>Les statistiques se rempliront avec les frais saisis.</div></div>:<>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.2fr .8fr',gap:14,marginBottom:14}}>
        <div style={panel}><div style={{fontWeight:700,marginBottom:14}}>Repartition par categorie</div>{bycat.map(c=>{const p=Math.round(c.total/maxCat*100);const share=total?Math.round(c.total/total*100):0;return <div key={c.id} style={{marginBottom:13}}><div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,marginBottom:6}}><span style={{fontWeight:700}}>{c.icon} {c.label}</span><span style={{fontFamily:'DM Mono',fontWeight:800}}>CHF {fmt(c.total)} <span style={{fontFamily:'DM Sans',fontWeight:500,color:'var(--t3)',fontSize:11}}>({share}%)</span></span></div><div style={{height:7,background:'var(--s2)',borderRadius:99,overflow:'hidden'}}><div style={{width:p+'%',height:'100%',background:'var(--accent)',borderRadius:99}}/></div></div>})}</div>
        <div style={panel}><div style={{fontWeight:700,marginBottom:14}}>Carte utilisee</div>{cards.length===0?<div style={{fontSize:13,color:'var(--t3)'}}>Aucune carte renseignee.</div>:cards.map(r=>{const p=Math.round(r.total/maxCard*100);return <div key={r.label} style={{marginBottom:13}}><div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:13,marginBottom:6}}><span style={{fontWeight:700}}>💳 {r.label}</span><span style={{fontFamily:'DM Mono',fontWeight:800}}>CHF {fmt(r.total)}</span></div><div style={{height:7,background:'var(--s2)',borderRadius:99,overflow:'hidden'}}><div style={{width:p+'%',height:'100%',background:r.color,borderRadius:99}}/></div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{r.items.length} frais</div></div>})}</div>
      </div>
      <div style={panel}><div style={{fontWeight:700,marginBottom:14}}>Evolution mensuelle</div>{bymonth.length===0?<div style={{fontSize:13,color:'var(--t3)'}}>Aucun mois avec frais.</div>:bymonth.map(m=>{const p=Math.round(m.total/maxMonth*100);return <div key={m.v} style={{display:'grid',gridTemplateColumns:isMobile?'82px 1fr':'120px 1fr 125px',alignItems:'center',gap:10,marginBottom:10}}><div style={{fontSize:13,fontWeight:700}}>{m.l.replace(' 2026','')}</div><div style={{height:10,background:'var(--s2)',borderRadius:99,overflow:'hidden'}}><div style={{width:p+'%',height:'100%',background:'linear-gradient(90deg,#2D5BE3,#0F6E56)',borderRadius:99}}/></div><div style={{fontSize:12,fontFamily:'DM Mono',fontWeight:800,textAlign:isMobile?'left':'right'}}>CHF {fmt(m.total)} · {m.count}</div></div>})}</div>
    </>}
  </div>;
}`;

    html = html.replace(/function StatsTab\(\{expenses,month,months\}\)\{[\s\S]*?\}\s*function App\(\)/, statsTab + '\n\nfunction App()');
    return html;
  };
})();
