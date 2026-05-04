(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_FINANCE_EXPENSES_TEST_V1')) return html;

    const component = String.raw`
const NOTESFRAIS_FINANCE_EXPENSES_TEST_V1=true;
function FinanceExpensesTab({mE,fil,rec,pend,mT,tva,pct,bycat,isMobile,filterCat,setFilterCat,search,setSearch,setShowAdd,setShowSubmitSummary,submitted,deleteExpense,setViewer,month,setMonth,periodMode,setPeriodMode,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts,ML}){
  const receiptCount=fil.filter(e=>e.receiptPath||e.receiptUrl).length;
  const missingReceipt=mE.length-mE.filter(e=>e.receiptPath||e.receiptUrl).length;
  const cardTotals=mE.reduce((acc,e)=>{const label=getPaymentCardLabel(e.note)||'Non renseignee';acc[label]=(acc[label]||0)+Math.abs(Number(e.amountCHF||e.amount||0));return acc;},{});
  const cardRows=Object.entries(cardTotals).sort((a,b)=>b[1]-a[1]);
  const canSubmit=periodMode==='month'&&mE.length>0;
  return <div style={{maxWidth:1040,paddingBottom:isMobile?180:40}}>
    <PeriodHeader title={'Frais'} subtitle={ML+' · '+fil.length+' frais visibles · '+receiptCount+' justificatifs'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>

    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:18}}>
      {[{l:'Total',v:'CHF '+fmt(mT),s:mE.length+' frais',c:'var(--text)'},{l:'TVA',v:'CHF '+fmt(tva),s:'recuperable',c:'var(--text)'},{l:'UBS',v:rec.length+'/'+mE.length,s:pct+'% reconcilie',c:pct===100?'var(--green)':'var(--amber)'},{l:'Sans justif.',v:missingReceipt,s:missingReceipt>0?'a controler':'complet',c:missingReceipt>0?'var(--red)':'var(--green)'}].map(k=><div key={k.l} style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?15:18,boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>{k.l.toUpperCase()}</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono',color:k.c}}>{k.v}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{k.s}</div></div>)}
    </div>

    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 280px',gap:14,alignItems:'start'}}>
      <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:18,overflow:'hidden',boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}>
        <div style={{padding:isMobile?14:18,borderBottom:'0.5px solid var(--border)',display:'grid',gap:12}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row'}}>
            <div><div style={{fontSize:16,fontWeight:900}}>Liste des frais</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>Resume et historique fusionnes pour la finance.</div></div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>setShowAdd(true)} style={{...bS,justifyContent:'center'}}>+ Ajouter</button>
              <button disabled={!canSubmit} onClick={()=>setShowSubmitSummary(true)} style={{...bP,justifyContent:'center',opacity:canSubmit?1:0.5}}>{periodMode==='month'?'Soumettre':'Mois requis'}</button>
            </div>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un recu, montant, commercant..." style={{...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'10px 12px'}}/>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[{id:'all',label:'Tous',icon:''},...CATS].map(c=><button key={c.id} onClick={()=>setFilterCat(c.id)} style={{padding:'7px 13px',borderRadius:20,fontSize:12,cursor:'pointer',border:filterCat===c.id?'2px solid var(--accent)':'0.5px solid var(--border)',background:filterCat===c.id?'var(--al)':'#fff',color:filterCat===c.id?'var(--accent)':'var(--t2)',fontWeight:filterCat===c.id?800:600}}>{c.icon?c.icon+' '+c.label:c.label}</button>)}</div>
        </div>
        {fil.length===0?<div style={{textAlign:'center',padding:'56px 20px',color:'var(--t3)'}}><div style={{fontSize:42,marginBottom:12}}>🧾</div><div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Aucun frais sur cette periode</div><button onClick={()=>setShowAdd(true)} style={{...bP,display:'inline-flex',marginTop:12}}>+ Ajouter un frais</button></div>:fil.map((e,i)=>{const card=getPaymentCardLabel(e.note);return <div key={e.id} style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'44px 1fr 44px 118px',gap:14,alignItems:'center',padding:isMobile?'14px':'14px 18px',borderBottom:i<fil.length-1?'0.5px solid var(--border)':'none'}}>
          <div style={{width:44,height:44,borderRadius:12,background:CMAP[e.category]?.color||'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{CMAP[e.category]?.icon||'📎'}</div>
          <div style={{minWidth:0}}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span style={{fontWeight:800,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:isMobile?'100%':260}}>{e.merchant}</span><Badge status={e.status}/>{card&&<span style={{fontSize:10,fontWeight:900,background:'var(--al)',color:'var(--accent)',borderRadius:999,padding:'3px 7px'}}>{card}</span>}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{fd(e.date)} · {CMAP[e.category]?.label||e.category}{cleanPaymentCardNote(e.note)&&' · '+cleanPaymentCardNote(e.note)}</div>{e.ubsRow&&<div style={{fontSize:11,color:'var(--green)',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>↳ UBS: {e.ubsRow.label}</div>}</div>
          <Thumb path={e.receiptPath||e.receiptUrl} name={e.receiptName||'justificatif'} onView={(e.receiptPath||e.receiptUrl)?()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'}):null}/>
          <div style={{textAlign:isMobile?'left':'right'}}><div style={{fontWeight:900,fontFamily:'DM Mono',fontSize:15}}>CHF {fmt(e.amountCHF||e.amount)}</div>{e.tva>0&&<div style={{fontSize:11,color:'var(--t3)'}}>TVA {fmt(e.tva)}</div>}<button onClick={()=>deleteExpense(e.id,e.receiptPath||e.receiptUrl)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:13,padding:2,marginTop:4}}>Suppr.</button></div>
        </div>})}
      </div>

      <div style={{display:'grid',gap:14}}>
        <div style={{background:'linear-gradient(135deg,#0B1F4D,#1A3FB5)',color:'#fff',borderRadius:18,padding:18,boxShadow:'0 14px 36px rgba(26,63,181,0.22)'}}><div style={{fontSize:11,letterSpacing:'0.08em',opacity:0.68,marginBottom:8}}>CONTROLE</div><div style={{fontSize:28,fontWeight:900}}>{missingReceipt+pend.length}</div><div style={{fontSize:13,opacity:0.78,lineHeight:1.45,marginTop:4}}>Points a verifier sur la periode.</div></div>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:18,padding:18}}><div style={{fontSize:15,fontWeight:900,marginBottom:12}}>Par carte</div>{cardRows.length===0?<div style={{fontSize:13,color:'var(--t3)'}}>Aucune carte renseignee.</div>:cardRows.map(([label,total])=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}><span style={{fontSize:13,fontWeight:800}}>{label}</span><span style={{fontSize:13,fontFamily:'DM Mono',fontWeight:900}}>CHF {fmt(total)}</span></div>)}</div>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:18,padding:18}}><div style={{fontSize:15,fontWeight:900,marginBottom:12}}>Par categorie</div>{bycat.length===0?<div style={{fontSize:13,color:'var(--t3)'}}>Aucune categorie.</div>:bycat.sort((a,b)=>b.t-a.t).map(c=>{const p=mT>0?Math.round(c.t/mT*100):0;return <div key={c.id} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:5}}><span style={{fontWeight:800}}>{c.icon} {c.label}</span><span style={{fontFamily:'DM Mono',fontWeight:900}}>CHF {fmt(c.t)}</span></div><div style={{height:6,background:'var(--s2)',borderRadius:99}}><div style={{width:p+'%',height:'100%',background:'var(--accent)',borderRadius:99}}/></div></div>})}</div>
      </div>
    </div>
  </div>;
}
`;

    html = html.replace('function App(){', component + '\nfunction App(){');

    html = html.replace(
      '<option value="home">Accueil</option><option value="history">Historique</option><option value="stats">Statistiques</option><option value="recon">Relevé UBS</option>{window.notesFraisRole===\'finance\'&&<option value="finance">Finance</option>}{window.notesFraisRole===\'finance\'&&<option value="settings">Paramètres</option>}',
      "{window.notesFraisRole==='finance'?<><option value=\"finance\">Finance</option><option value=\"finance_expenses\">Frais</option><option value=\"stats\">Statistiques</option><option value=\"recon\">Relevé UBS</option><option value=\"settings\">Paramètres</option></>:<><option value=\"home\">Accueil</option><option value=\"history\">Historique</option><option value=\"stats\">Statistiques</option><option value=\"recon\">Relevé UBS</option></>}"
    );

    html = html.replace(
      "([['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']].concat(window.notesFraisRole==='finance'?[['finance','💼','Finance'],['settings','⚙️','Paramètres']]:[]))",
      "(window.notesFraisRole==='finance'?[['finance','💼','Finance'],['finance_expenses','🧾','Frais'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS'],['settings','⚙️','Paramètres']]:[['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']])"
    );

    html = html.replace(
      "{tab==='finance'&&window.notesFraisRole==='finance'&&<FinanceDashboardTab expenses={expenses} months={MONTHS} setMonth={setMonth} setTab={setTab}/>}\n        {tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}",
      "{tab==='finance'&&window.notesFraisRole==='finance'&&<FinanceDashboardTab expenses={expenses} months={MONTHS} setMonth={setMonth} setTab={setTab}/>}\n        {tab==='finance_expenses'&&window.notesFraisRole==='finance'&&<FinanceExpensesTab mE={mE} fil={fil} rec={rec} pend={pend} mT={mT} tva={tva} pct={pct} bycat={bycat} isMobile={isMobile} filterCat={filterCat} setFilterCat={setFilterCat} search={search} setSearch={setSearch} setShowAdd={setShowAdd} setShowSubmitSummary={setShowSubmitSummary} submitted={submitted} deleteExpense={deleteExpense} setViewer={setViewer} month={month} setMonth={setMonth} periodMode={periodMode} setPeriodMode={setPeriodMode} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts} ML={ML}/>}\n        {tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}"
    );

    return html;
  };
})();
