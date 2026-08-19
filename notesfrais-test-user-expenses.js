(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('NOTESFRAIS_USER_EXPENSES_TEST_V5')) return html;

    html = html.replace('function App(){', 'const NOTESFRAIS_USER_EXPENSES_TEST_V5=true;\nfunction App(){');

    html = html.replace(
      "const [tab,setTab]=useState(()=>window.notesFraisRole==='finance'?'finance':'home');",
      "const [tab,setTab]=useState(()=>window.notesFraisRole==='finance'?'finance':'expenses');"
    );
    html = html.replace(
      "const [tab,setTab]=useState('home');",
      "const [tab,setTab]=useState(window.notesFraisRole==='finance'?'finance':'expenses');"
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
      "{tab==='history'&&<div",
      "{(tab==='history'||(tab==='expenses'&&window.notesFraisRole!=='finance'))&&<div"
    );
    html = html.replace(
      "<h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>Historique</h1>",
      "<h1 style={{fontSize:22,fontWeight:700,marginBottom:4}}>{tab==='expenses'?'Liste des frais':'Historique'}</h1>"
    );

    html = html.replace(
      "<div style={{padding:'12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>NAVIGATION</div>{isMobile?",
      "<div style={{padding:'12px',display:isMobile&&window.notesFraisRole!=='finance'?'none':'block'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>NAVIGATION</div>{isMobile?"
    );
    html = html.replace(
      "<div style={{padding:'12px'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>NAVIGATION</div><div style={{display:'flex',flexDirection:isMobile?'row':'column'",
      "<div style={{padding:'12px',display:isMobile&&window.notesFraisRole!=='finance'?'none':'block'}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.08em',padding:'0 8px',marginBottom:6}}>NAVIGATION</div><div style={{display:'flex',flexDirection:isMobile?'row':'column'"
    );

    return html;
  };
})();
