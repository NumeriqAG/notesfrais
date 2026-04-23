(function(){
  const basePatch=window.patchNotesFrais;
  window.patchNotesFrais=function(html){
    html=basePatch?basePatch(html):html;
    if(html.includes('function AccessGate('))return html;
    const accessScript=String.raw`
const ACCESS_CODES={user:'MIKE2026',finance:'FINANCE2026'};
function AccessGate({children}){
  const readSession=()=>{try{return JSON.parse(localStorage.getItem('notesfrais_access')||'null');}catch(e){return null;}};
  const [session,setSession]=useState(readSession);
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const role=session&&session.role;
  useEffect(()=>{window.notesFraisRole=role||null;},[role]);
  const unlock=()=>{
    const entered=String(code||'').trim().toUpperCase();
    const nextRole=entered===ACCESS_CODES.finance?'finance':entered===ACCESS_CODES.user?'user':null;
    if(!nextRole){setError('Code incorrect.');return;}
    const next={role:nextRole,at:Date.now()};
    try{localStorage.setItem('notesfrais_access',JSON.stringify(next));}catch(e){}
    window.notesFraisRole=nextRole;
    setSession(next);
    setCode('');
    setError('');
  };
  const logout=()=>{
    try{localStorage.removeItem('notesfrais_access');}catch(e){}
    window.notesFraisRole=null;
    setSession(null);
    setCode('');
  };
  if(!role){
    return <div style={{minHeight:'100dvh',background:'linear-gradient(135deg,#F5F3EF 0%,#EEF2FD 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{width:'100%',maxWidth:420,background:'#fff',border:'0.5px solid var(--border)',borderRadius:22,padding:24,boxShadow:'0 24px 80px rgba(26,26,26,0.12)'}}>
        <div style={{background:'linear-gradient(135deg,#0B1F4D,#1A3FB5)',borderRadius:18,padding:'22px 18px',color:'#fff',textAlign:'center',marginBottom:20}}>
          <div style={{fontSize:11,letterSpacing:'0.22em',opacity:0.72,marginBottom:8}}>NOTES DE FRAIS</div>
          <div style={{fontSize:24,fontWeight:800,letterSpacing:'0.08em'}}>NUMERIQ</div>
        </div>
        <h1 style={{fontSize:22,lineHeight:1.2,marginBottom:6}}>Code d'accès</h1>
        <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.5,marginBottom:18}}>Entrez le code utilisateur ou finance pour ouvrir l'application.</p>
        <input value={code} onChange={e=>{setCode(e.target.value);setError('');}} onKeyDown={e=>{if(e.key==='Enter')unlock();}} type="password" inputMode="text" autoComplete="current-password" placeholder="Code" autoFocus style={{...inp,fontSize:18,padding:'14px 15px',background:'#fff',marginBottom:10}} />
        {error&&<div style={{background:'var(--rl)',color:'var(--red)',borderRadius:10,padding:'9px 12px',fontSize:13,marginBottom:10}}>{error}</div>}
        <button onClick={unlock} style={{...bP,width:'100%',justifyContent:'center',padding:'14px 18px',fontSize:15}}>Déverrouiller</button>
        <div style={{fontSize:11,color:'var(--t3)',textAlign:'center',marginTop:14}}>Accès protégé par code local</div>
      </div>
    </div>;
  }
  return <>
    {children}
    <button onClick={logout} title="Changer d'accès" style={{position:'fixed',right:12,bottom:12,zIndex:2600,border:'0.5px solid var(--border)',background:'#fff',color:'var(--t2)',borderRadius:999,padding:'8px 11px',fontSize:11,boxShadow:'0 8px 22px rgba(26,26,26,0.12)',cursor:'pointer'}}>{role==='finance'?'Finance':'Mike'} · sortir</button>
  </>;
}
`;
    html=html.replace('ReactDOM.render(<React.StrictMode><App/></React.StrictMode>,document.getElementById(\'root\'));',accessScript+'\nReactDOM.render(<React.StrictMode><AccessGate><App/></AccessGate></React.StrictMode>,document.getElementById(\'root\'));');
    return html;
  };
})();
