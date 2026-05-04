(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_FINANCE_DASHBOARD_TEST_V1')) return html;

    const component = String.raw`
const NOTESFRAIS_FINANCE_DASHBOARD_TEST_V1=true;
function financeMonthStatus(month,items){
  const now=new Date();
  const current=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const list=Array.isArray(items)?items:[];
  if(list.length>0&&list.every(e=>(e.submissionStatus||'pending')==='submitted'))return 'submitted';
  return month<current?'to_submit':'pending';
}
function financeStatusMeta(status){
  if(status==='submitted')return{label:'Soumis',bg:'var(--gl)',color:'var(--green)'};
  if(status==='to_submit')return{label:'A soumettre',bg:'var(--aml)',color:'var(--amber)'};
  return{label:'En cours',bg:'var(--al)',color:'var(--accent)'};
}
function FinanceDashboardTab({expenses,months,setMonth,setTab}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const all=Array.isArray(expenses)?expenses:[];
  const rows=months.map(m=>{
    const list=all.filter(e=>e.date&&e.date.startsWith(m.v));
    const total=list.reduce((s,e)=>s+Math.abs(Number(e.amountCHF||e.amount||0)),0);
    const tva=list.reduce((s,e)=>s+Number(e.tva||0),0);
    const withReceipt=list.filter(e=>e.receiptPath||e.receiptUrl).length;
    const missingReceipt=list.length-withReceipt;
    const reconciled=list.filter(e=>e.status==='reconciled').length;
    const status=financeMonthStatus(m.v,list);
    return{...m,list,total,tva,withReceipt,missingReceipt,reconciled,status};
  }).filter(r=>r.list.length>0||r.status!=='pending');
  const submitted=rows.filter(r=>r.status==='submitted');
  const toSubmit=rows.filter(r=>r.status==='to_submit');
  const pending=rows.filter(r=>r.status==='pending');
  const total=rows.reduce((s,r)=>s+r.total,0);
  const tva=rows.reduce((s,r)=>s+r.tva,0);
  const missing=rows.reduce((s,r)=>s+r.missingReceipt,0);
  const openMonth=(m)=>{setMonth(m);setTab('home');};
  const kpiStyle={background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?16:18,boxShadow:'0 10px 30px rgba(26,26,26,0.04)'};
  return <div style={{maxWidth:1040,paddingBottom:isMobile?180:40}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row',marginBottom:22}}>
      <div>
        <div style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.08em',fontWeight:800,marginBottom:6}}>ESPACE FINANCE</div>
        <h1 style={{fontSize:26,fontWeight:900,marginBottom:5}}>Tableau de bord finance</h1>
        <div style={{fontSize:13,color:'var(--t3)',lineHeight:1.5}}>Vue de controle pour suivre les mois soumis, les justificatifs manquants et les montants a exporter.</div>
      </div>
      <button onClick={()=>setTab('settings')} style={{...bS,justifyContent:'center',padding:'10px 14px'}}>Parametres comptables</button>
    </div>

    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:18}}>
      <div style={kpiStyle}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>TOTAL A CONTROLER</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono'}}>CHF {fmt(total)}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{all.length} frais</div></div>
      <div style={kpiStyle}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>TVA</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono'}}>CHF {fmt(tva)}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>recuperable</div></div>
      <div style={kpiStyle}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>A SOUMETTRE</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono',color:'var(--amber)'}}>{toSubmit.length}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>mois a relancer</div></div>
      <div style={kpiStyle}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>SANS JUSTIF.</div><div style={{fontSize:22,fontWeight:900,fontFamily:'DM Mono',color:missing>0?'var(--red)':'var(--green)'}}>{missing}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>pieces a verifier</div></div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.2fr 0.8fr',gap:14,marginBottom:18}}>
      <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:18,padding:isMobile?14:18,boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',marginBottom:12}}>
          <div><div style={{fontSize:15,fontWeight:900}}>Suivi par mois</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>Cliquez un mois pour ouvrir le detail utilisateur.</div></div>
        </div>
        <div style={{display:'grid',gap:8}}>
          {rows.length===0?<div style={{fontSize:13,color:'var(--t3)',padding:18,textAlign:'center'}}>Aucun frais pour le moment.</div>:rows.map(r=>{const meta=financeStatusMeta(r.status);const receiptPct=r.list.length?Math.round(r.withReceipt/r.list.length*100):0;return <button key={r.v} onClick={()=>openMonth(r.v)} style={{textAlign:'left',background:'var(--bg)',border:'0.5px solid var(--border)',borderRadius:14,padding:14,cursor:'pointer',display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 130px 120px',gap:12,alignItems:'center'}}>
            <div style={{minWidth:0}}><div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}><span style={{fontSize:15,fontWeight:900}}>{r.l}</span><span style={{background:meta.bg,color:meta.color,borderRadius:999,padding:'4px 8px',fontSize:11,fontWeight:800}}>{meta.label}</span></div><div style={{fontSize:12,color:'var(--t3)',marginTop:5}}>{r.list.length} frais · {r.withReceipt}/{r.list.length} justificatifs · {r.reconciled}/{r.list.length} UBS</div><div style={{height:5,background:'var(--s2)',borderRadius:99,marginTop:8,overflow:'hidden'}}><div style={{height:'100%',width:receiptPct+'%',background:receiptPct===100?'var(--green)':'var(--amber)',borderRadius:99}}/></div></div>
            <div style={{fontFamily:'DM Mono',fontWeight:900,fontSize:15}}>CHF {fmt(r.total)}</div>
            <div style={{fontSize:12,color:r.missingReceipt>0?'var(--red)':'var(--green)',fontWeight:800}}>{r.missingReceipt>0?r.missingReceipt+' manquant(s)':'Complet'}</div>
          </button>})}
        </div>
      </div>

      <div style={{display:'grid',gap:14}}>
        <div style={{background:'linear-gradient(135deg,#0B1F4D,#1A3FB5)',color:'#fff',borderRadius:18,padding:18,boxShadow:'0 14px 36px rgba(26,63,181,0.22)'}}>
          <div style={{fontSize:11,letterSpacing:'0.08em',opacity:0.68,marginBottom:8}}>PRIORITES</div>
          <div style={{fontSize:26,fontWeight:900,marginBottom:6}}>{toSubmit.length+missing}</div>
          <div style={{fontSize:13,opacity:0.78,lineHeight:1.45}}>Elements demandant une action finance ou utilisateur.</div>
        </div>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:18,padding:18}}>
          <div style={{fontSize:15,fontWeight:900,marginBottom:12}}>File de controle</div>
          {[...toSubmit.map(r=>({type:'Relancer',text:r.l,color:'var(--amber)'})),...rows.filter(r=>r.missingReceipt>0).map(r=>({type:'Justificatif',text:r.l+' · '+r.missingReceipt+' manquant(s)',color:'var(--red)'}))].slice(0,6).map((a,i)=><div key={i} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'9px 0',borderBottom:i<5?'0.5px solid var(--border)':'none'}}><span style={{fontSize:13,fontWeight:700,color:a.color}}>{a.type}</span><span style={{fontSize:13,color:'var(--t2)',textAlign:'right'}}>{a.text}</span></div>)}
          {toSubmit.length===0&&missing===0&&<div style={{fontSize:13,color:'var(--green)',background:'var(--gl)',borderRadius:12,padding:12,fontWeight:800}}>Tout est propre pour le moment.</div>}
        </div>
      </div>
    </div>
  </div>;
}
`;

    html = html.replace('function App(){', component + '\nfunction App(){');

    html = html.replace(
      "const [tab,setTab]=useState('home');",
      "const [tab,setTab]=useState(()=>window.notesFraisRole==='finance'?'finance':'home');"
    );

    html = html.replace(
      '<option value="recon">Relevé UBS</option>{window.notesFraisRole===\'finance\'&&<option value="settings">Paramètres</option>}</select>',
      '<option value="recon">Relevé UBS</option>{window.notesFraisRole===\'finance\'&&<option value="finance">Finance</option>}{window.notesFraisRole===\'finance\'&&<option value="settings">Paramètres</option>}</select>'
    );

    html = html.replace(
      "[['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']].concat(window.notesFraisRole==='finance'?[['settings','⚙️','Paramètres']]:[])",
      "[['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']].concat(window.notesFraisRole==='finance'?[['finance','💼','Finance'],['settings','⚙️','Paramètres']]:[])"
    );

    html = html.replace(
      "{tab==='stats'&&<StatsTab expenses={expenses} month={month} months={MONTHS}/>}\n        {tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}",
      "{tab==='stats'&&<StatsTab expenses={expenses} month={month} months={MONTHS}/>}\n        {tab==='finance'&&window.notesFraisRole==='finance'&&<FinanceDashboardTab expenses={expenses} months={MONTHS} setMonth={setMonth} setTab={setTab}/>}\n        {tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}"
    );

    return html;
  };
})();
