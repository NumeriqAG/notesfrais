(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_FINANCE_SUBMISSIONS_TEST_V3')) return html;

    html = html.replace('function App(){', 'const NOTESFRAIS_FINANCE_SUBMISSIONS_TEST_V3=true;\nfunction App(){');

    html = html.replace(
      "return{...m,list,total,tva,withReceipt,missingReceipt,reconciled,status};",
      "const submittedAt=(list.find(e=>e.submittedAt)||{}).submittedAt||null;return{...m,list,total,tva,withReceipt,missingReceipt,reconciled,status,submittedAt};"
    );

    html = html.replace(
      "const openMonth=(m)=>{setMonth(m);setTab('home');};",
      "const openMonth=(m)=>{setMonth(m);if(typeof setPeriodMode==='function')setPeriodMode('month');setTab('finance_expenses');};"
    );

    html = html.replace(
      "<div style={kpiStyle}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>A SOUMETTRE</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono',color:'var(--amber)'}}>{toSubmit.length}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>mois a relancer</div></div>",
      "<div style={kpiStyle}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>MOIS SOUMIS</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono',color:'var(--green)'}}>{submitted.length}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>prets pour controle</div></div>"
    );

    html = html.replace(
      "<div style={{fontSize:12,color:'var(--t3)',marginTop:5}}>{r.list.length} frais · {r.withReceipt}/{r.list.length} justificatifs · {r.reconciled}/{r.list.length} UBS</div>",
      "<div style={{fontSize:12,color:'var(--t3)',marginTop:5}}>{r.list.length} frais · {r.withReceipt}/{r.list.length} justificatifs · {r.reconciled}/{r.list.length} UBS{r.status==='submitted'&&<span style={{color:'var(--green)',fontWeight:800}}> · Soumis{r.submittedAt?' le '+fd(r.submittedAt.slice(0,10)):''}</span>}</div>"
    );

    html = html.replace(
      "function FinanceDashboardTab({expenses,months,setMonth,setTab}){",
      "function FinanceDashboardTab({expenses,months,setMonth,setTab,setPeriodMode}){"
    );

    html = html.replace(
      "<FinanceDashboardTab expenses={expenses} months={MONTHS} setMonth={setMonth} setTab={setTab}/>",
      "<FinanceDashboardTab expenses={expenses} months={MONTHS} setMonth={setMonth} setTab={setTab} setPeriodMode={setPeriodMode}/>"
    );

    html = html.replace(
      "function FinanceExpensesTab({mE,fil,rec,pend,mT,tva,pct,bycat,isMobile,filterCat,setFilterCat,search,setSearch,setShowAdd,setShowSubmitSummary,submitted,deleteExpense,setViewer,month,setMonth,periodMode,setPeriodMode,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts,ML}){",
      "function FinanceExpensesTab({mE,fil,rec,pend,mT,tva,pct,bycat,isMobile,filterCat,setFilterCat,search,setSearch,setShowAdd,setShowSubmitSummary,submitted,deleteExpense,setViewer,month,setMonth,periodMode,setPeriodMode,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts,ML,setTab}){"
    );

    html = html.replace(
      "monthCounts={monthCounts} ML={ML}/>}",
      "monthCounts={monthCounts} ML={ML} setTab={setTab}/>}
    );

    html = html.replace(
      "const cardRows=Object.entries(cardTotals).sort((a,b)=>b[1]-a[1]);\n  const canSubmit=periodMode==='month'&&mE.length>0;\n  return <div style={{maxWidth:1040,paddingBottom:isMobile?180:40}}>",
      "const cardRows=Object.entries(cardTotals).sort((a,b)=>b[1]-a[1]);\n  const submissionStatus=typeof getSubmissionStatusForMonth==='function'?getSubmissionStatusForMonth(month,mE):'pending';\n  const submittedAt=(mE.find(e=>e.submittedAt)||{}).submittedAt||null;\n  const canSubmit=periodMode==='month'&&mE.length>0;\n  return <div style={{maxWidth:1040,paddingBottom:isMobile?180:40}}>"
    );

    html = html.replace(
      "<PeriodHeader title={'Frais'} subtitle={ML+' · '+fil.length+' frais visibles · '+receiptCount+' justificatifs'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>",
      "<PeriodHeader title={'Frais'} subtitle={ML+' · '+fil.length+' frais visibles · '+receiptCount+' justificatifs'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>\n    {window.notesFraisRole==='finance'&&submissionStatus==='submitted'&&<div style={{background:'var(--gl)',border:'0.5px solid #BDEAD9',color:'var(--green)',borderRadius:16,padding:isMobile?14:16,marginBottom:16,display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row'}}><div><div style={{fontWeight:900,fontSize:15}}>Mois soumis par l'utilisateur</div><div style={{fontSize:12,opacity:0.78,marginTop:3}}>Pret pour controle finance{submittedAt?' · soumis le '+fd(submittedAt.slice(0,10)):''}</div></div><button onClick={()=>setTab&&setTab('finance')} style={{...bS,borderColor:'#BDEAD9',color:'var(--green)',justifyContent:'center'}}>Retour dashboard</button></div>}"
    );

    return html;
  };
})();
