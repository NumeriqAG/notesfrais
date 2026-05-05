(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_USER_EXPENSES_TEST_V2')) return html;

    const component = String.raw`
const NOTESFRAIS_USER_EXPENSES_TEST_V2=true;
function UserExpensesTab({mE,fil,rec,pend,mT,tva,pct,bycat,isMobile,filterCat,setFilterCat,search,setSearch,setShowAdd,setShowSubmitSummary,submitted,deleteExpense,setViewer,month,setMonth,periodMode,setPeriodMode,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts,ML,submissionBadge}){
  const receiptCount=fil.filter(e=>e.receiptPath||e.receiptUrl).length;
  const missingReceipt=mE.length-mE.filter(e=>e.receiptPath||e.receiptUrl).length;
  const canSubmit=periodMode==='month'&&mE.length>0;
  return <div style={{maxWidth:isMobile?'100%':860,paddingBottom:isMobile?180:40}}>
    <PeriodHeader title={'Frais'} subtitle={ML+' · '+fil.length+' frais visibles · '+receiptCount+' justificatifs'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>

    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:16}}>
      {[{l:'Total',v:'CHF '+fmt(mT),s:mE.length+' frais',c:'var(--text)'},{l:'TVA',v:'CHF '+fmt(tva),s:'recuperable',c:'var(--text)'},{l:'UBS',v:rec.length+'/'+mE.length,s:pct+'% reconcilie',c:pct===100?'var(--green)':'var(--amber)'},{l:'Justif.',v:receiptCount+'/'+mE.length,s:missingReceipt>0?missingReceipt+' manquant(s)':'complet',c:missingReceipt>0?'var(--red)':'var(--green)'}].map(k=><div key={k.l} style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?14:17,boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>{k.l.toUpperCase()}</div><div style={{fontSize:20,fontWeight:900,fontFamily:'DM Mono',color:k.c}}>{k.v}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{k.s}</div></div>)}
    </div>

    <div style={{background:'linear-gradient(135deg,#0B1F4D,#1A3FB5)',borderRadius:18,padding:isMobile?16:20,color:'#fff',marginBottom:16,boxShadow:'0 14px 36px rgba(26,63,181,0.22)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row'}}>
        <div><div style={{fontSize:11,opacity:0.68,letterSpacing:'0.08em',marginBottom:5}}>STATUT DU MOIS</div><div style={{fontSize:26,fontWeight:900}}>{submissionBadge.label}</div><div style={{fontSize:13,opacity:0.78,marginTop:3}}>{submissionBadge.hint}</div></div>
        <button disabled={!canSubmit} onClick={()=>setShowSubmitSummary(true)} style={{...bP,background:'#fff',color:'var(--accent)',justifyContent:'center',width:isMobile?'100%':'auto',opacity:canSubmit?1:0.55}}>{periodMode==='month'?'Soumettre les frais':'Choisir un mois'}</button>
      </div>
      <div style={{height:6,background:'rgba(255,255,255,0.22)',borderRadius:99,marginTop:16}}><div style={{width:pct+'%',height:'100%',background:pct===100?'#7CEFA0':'#FBD761',borderRadius:99}}/></div>
    </div>

    <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:18,overflow:'hidden',boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}>
      <div style={{padding:isMobile?14:18,borderBottom:'0.5px solid var(--border)',display:'grid',gap:12}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row'}}>
          <div><div style={{fontSize:16,fontWeight:900}}>Liste des frais</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>Resume et historique au meme endroit.</div></div>
          <button onClick={()=>setShowAdd(true)} style={{...bP,justifyContent:'center'}}>+ Ajouter un frais</button>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un recu, montant, commercant..." style={{...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'10px 12px'}}/>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[{id:'all',label:'Tous',icon:''},...CATS].map(c=><button key={c.id} onClick={()=>setFilterCat(c.id)} style={{padding:'7px 13px',borderRadius:20,fontSize:12,cursor:'pointer',border:filterCat===c.id?'2px solid var(--accent)':'0.5px solid var(--border)',background:filterCat===c.id?'var(--al)':'#fff',color:filterCat===c.id?'var(--accent)':'var(--t2)',fontWeight:filterCat===c.id?800:600}}>{c.icon?c.icon+' '+c.label:c.label}</button>)}</div>
      </div>
      {fil.length===0?<div style={{textAlign:'center',padding:'56px 20px',color:'var(--t3)'}}><div style={{fontSize:46,marginBottom:12}}>🧾</div><div style={{fontWeight:800,fontSize:16,marginBottom:4}}>Aucun frais sur cette periode</div><button onClick={()=>setShowAdd(true)} style={{...bP,display:'inline-flex',marginTop:12}}>+ Ajouter un frais</button></div>:fil.map((e,i)=>{const card=getPaymentCardLabel(e.note);return <div key={e.id} style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'44px 1fr 44px 110px',gap:14,alignItems:'center',padding:isMobile?'14px':'14px 18px',borderBottom:i<fil.length-1?'0.5px solid var(--border)':'none'}}>
        <div style={{width:44,height:44,borderRadius:12,background:CMAP[e.category]?.color||'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{CMAP[e.category]?.icon||'📎'}</div>
        <div style={{minWidth:0}}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span style={{fontWeight:800,fontSize:14,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:isMobile?'100%':260}}>{e.merchant}</span><Badge status={e.status}/>{card&&<span style={{fontSize:10,fontWeight:900,background:'var(--al)',color:'var(--accent)',borderRadius:999,padding:'3px 7px'}}>{card}</span>}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{fd(e.date)} · {CMAP[e.category]?.label||e.category}{cleanPaymentCardNote(e.note)&&' · '+cleanPaymentCardNote(e.note)}</div>{e.ubsRow&&<div style={{fontSize:11,color:'var(--green)',marginTop:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>↳ UBS: {e.ubsRow.label}</div>}</div>
        <Thumb path={e.receiptPath||e.receiptUrl} name={e.receiptName||'justificatif'} onView={(e.receiptPath||e.receiptUrl)?()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'}):null}/>
        <div style={{textAlign:isMobile?'left':'right'}}><div style={{fontWeight:900,fontFamily:'DM Mono',fontSize:15}}>CHF {fmt(e.amountCHF||e.amount)}</div>{e.tva>0&&<div style={{fontSize:11,color:'var(--t3)'}}>TVA {fmt(e.tva)}</div>}<button onClick={()=>deleteExpense(e.id,e.receiptPath||e.receiptUrl)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:13,padding:2,marginTop:4}}>Suppr.</button></div>
      </div>})}
    </div>
  </div>;
}
`;

    html = html.replace('function App(){', component + '\nfunction App(){');

    html = html.replace(
      "const [tab,setTab]=useState(()=>window.notesFraisRole==='finance'?'finance':'home');",
      "const [tab,setTab]=useState(()=>window.notesFraisRole==='finance'?'finance':'expenses');"
    );

    html = html.replace(
      "<><option value=\"home\">Accueil</option><option value=\"history\">Historique</option><option value=\"stats\">Statistiques</option><option value=\"recon\">Relevé UBS</option></>",
      "<><option value=\"expenses\">Frais</option><option value=\"stats\">Statistiques</option><option value=\"recon\">Relevé UBS</option></>"
    );

    html = html.replace(
      "[['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']]",
      "[['expenses','🧾','Frais'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']]"
    );

    html = html.replace(
      "{tab==='home'&&<div",
      "{tab==='expenses'&&window.notesFraisRole!=='finance'&&<UserExpensesTab mE={mE} fil={fil} rec={rec} pend={pend} mT={mT} tva={tva} pct={pct} bycat={bycat} isMobile={isMobile} filterCat={filterCat} setFilterCat={setFilterCat} search={search} setSearch={setSearch} setShowAdd={setShowAdd} setShowSubmitSummary={setShowSubmitSummary} submitted={submitted} deleteExpense={deleteExpense} setViewer={setViewer} month={month} setMonth={setMonth} periodMode={periodMode} setPeriodMode={setPeriodMode} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts} ML={ML} submissionBadge={submissionBadge}/>}

        {tab==='home'&&<div"
    );

    html = html.replace(
      "<div style={{padding:'12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>NAVIGATION</div>{isMobile?",
      "<div style={{padding:'12px',display:isMobile&&window.notesFraisRole!=='finance'?'none':'block'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>NAVIGATION</div>{isMobile?"
    );

    return html;
  };
})();
