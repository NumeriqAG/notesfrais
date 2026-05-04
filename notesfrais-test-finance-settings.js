(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_FINANCE_SETTINGS_TEST_V1')) return html;

    html = html.replace(
      "if(authSession&&profile){\n    return <>",
      "if(authSession&&profile){\n    window.notesFraisRole=profile.role;window.notesFraisProfile=profile;\n    return <>"
    );

    const component = String.raw`
const NOTESFRAIS_FINANCE_SETTINGS_TEST_V1=true;
const ACCOUNTING_SETTINGS_KEY='notesfrais_accounting_settings_v1';
function defaultAccountingSettings(){
  return {
    cards:{entreprise:'',perso:''},
    categories:Object.fromEntries(CATS.map(c=>[c.id,'']))
  };
}
function readAccountingSettings(){
  try{
    const saved=JSON.parse(localStorage.getItem(ACCOUNTING_SETTINGS_KEY)||'null');
    return {...defaultAccountingSettings(),...(saved||{}),cards:{...defaultAccountingSettings().cards,...((saved&&saved.cards)||{})},categories:{...defaultAccountingSettings().categories,...((saved&&saved.categories)||{})}};
  }catch(e){return defaultAccountingSettings();}
}
function FinanceSettingsTab(){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const [settings,setSettings]=useState(readAccountingSettings);
  const [saved,setSaved]=useState(false);
  const cardRows=[
    {id:'entreprise',label:'Paiement CB entreprise',hint:'Ex: carte pro / compte banque entreprise'},
    {id:'perso',label:'Paiement CB perso',hint:'Ex: compte courant d’associé / remboursement'}
  ];
  const updateCard=(id,value)=>setSettings(s=>({...s,cards:{...s.cards,[id]:value}}));
  const updateCategory=(id,value)=>setSettings(s=>({...s,categories:{...s.categories,[id]:value}}));
  const save=()=>{
    try{localStorage.setItem(ACCOUNTING_SETTINGS_KEY,JSON.stringify(settings));setSaved(true);setTimeout(()=>setSaved(false),2200);}catch(e){}
  };
  const reset=()=>{const next=defaultAccountingSettings();setSettings(next);try{localStorage.setItem(ACCOUNTING_SETTINGS_KEY,JSON.stringify(next));}catch(e){}};
  const rowStyle={display:'grid',gridTemplateColumns:isMobile?'1fr':'minmax(210px,1fr) 180px',gap:isMobile?8:14,alignItems:'center',padding:'12px 0',borderBottom:'0.5px solid var(--border)'};
  return <div style={{maxWidth:860,paddingBottom:isMobile?180:40}}>
    <div style={{marginBottom:22}}>
      <div style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.08em',fontWeight:800,marginBottom:6}}>ESPACE FINANCE</div>
      <h1 style={{fontSize:24,fontWeight:800,marginBottom:5}}>Paramètres comptables</h1>
      <div style={{fontSize:13,color:'var(--t3)',lineHeight:1.5}}>Associez les cartes et catégories à vos comptes comptables. Ces réglages préparent le futur export finance.</div>
    </div>

    <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?16:20,marginBottom:16,boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row',marginBottom:8}}>
        <div>
          <div style={{fontSize:15,fontWeight:800}}>Comptes par moyen de paiement</div>
          <div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>Exemple : CB perso = compte courant, CB pro = compte carte entreprise.</div>
        </div>
        <span style={{fontSize:11,color:'var(--green)',background:'var(--gl)',borderRadius:999,padding:'5px 9px',fontWeight:700}}>Visible finance</span>
      </div>
      {cardRows.map(row=><div key={row.id} style={rowStyle}>
        <div><div style={{fontSize:13,fontWeight:700}}>{row.label}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{row.hint}</div></div>
        <input value={settings.cards[row.id]||''} onChange={e=>updateCard(row.id,e.target.value)} placeholder="Compte comptable" style={{...inp,background:'#fff',fontFamily:'DM Mono',fontSize:13}} />
      </div>)}
    </div>

    <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?16:20,marginBottom:16,boxShadow:'0 10px 30px rgba(26,26,26,0.04)'}}>
      <div style={{fontSize:15,fontWeight:800,marginBottom:4}}>Comptes par catégorie de dépense</div>
      <div style={{fontSize:12,color:'var(--t3)',marginBottom:8}}>Exemple : repas = compte 58xx, transport = compte 62xx, hôtel = compte 66xx.</div>
      {CATS.map(cat=><div key={cat.id} style={rowStyle}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:38,height:38,borderRadius:10,background:cat.color||'var(--s2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:19}}>{cat.icon}</div>
          <div><div style={{fontSize:13,fontWeight:700}}>{cat.label}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>Catégorie : {cat.id}</div></div>
        </div>
        <input value={settings.categories[cat.id]||''} onChange={e=>updateCategory(cat.id,e.target.value)} placeholder="Compte comptable" style={{...inp,background:'#fff',fontFamily:'DM Mono',fontSize:13}} />
      </div>)}
    </div>

    <div style={{display:'flex',gap:10,flexDirection:isMobile?'column':'row',alignItems:isMobile?'stretch':'center'}}>
      <button onClick={save} style={{...bP,justifyContent:'center',padding:'12px 18px'}}>Enregistrer les paramètres</button>
      <button onClick={reset} style={{...bS,justifyContent:'center',padding:'12px 18px'}}>Réinitialiser</button>
      {saved&&<div style={{fontSize:13,color:'var(--green)',fontWeight:700}}>✓ Paramètres enregistrés</div>}
    </div>
  </div>;
}
`;

    html = html.replace('function App(){', component + '\nfunction App(){');

    html = html.replace(
      '<option value="recon">Relevé UBS</option></select>',
      '<option value="recon">Relevé UBS</option>{window.notesFraisRole===\'finance\'&&<option value="settings">Paramètres</option>}</select>'
    );

    html = html.replace(
      "{[['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']].map(([id,ic,lb])=>",
      "{([['home','🏠','Accueil'],['history','📋','Historique'],['stats','📊','Statistiques'],['recon','🏦','Relevé UBS']].concat(window.notesFraisRole==='finance'?[['settings','⚙️','Paramètres']]:[])).map(([id,ic,lb])=>"
    );

    html = html.replace(
      "{tab==='stats'&&<StatsTab expenses={expenses} month={month} months={MONTHS}/>}",
      "{tab==='stats'&&<StatsTab expenses={expenses} month={month} months={MONTHS}/>}\n        {tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}"
    );

    return html;
  };
})();
