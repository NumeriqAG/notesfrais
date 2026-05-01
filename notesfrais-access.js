(function(){
  const basePatch=window.patchNotesFrais;
  window.patchNotesFrais=function(html){
    html=basePatch?basePatch(html):html;
    if(html.includes('function AccessGate('))return html;
    const accessScript=String.raw`
const ACCESS_CODES={user:'MIKE2026',finance:'FINANCE2026'};
function AccessGate({children}){
  const readSession=()=>{try{return JSON.parse(localStorage.getItem('notesfrais_access')||'null');}catch(e){return null;}};
  const [localSession,setLocalSession]=useState(readSession);
  const [authSession,setAuthSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [checkingAuth,setCheckingAuth]=useState(true);
  const [authMode,setAuthMode]=useState('password');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    let alive=true;
    sb.auth.getSession().then(({data})=>{if(alive)setAuthSession(data&&data.session?data.session:null);}).finally(()=>{if(alive)setCheckingAuth(false);});
    const {data:{subscription}}=sb.auth.onAuthStateChange((_event,session)=>{setAuthSession(session||null);});
    return()=>{alive=false;subscription&&subscription.unsubscribe&&subscription.unsubscribe();};
  },[]);

  useEffect(()=>{
    let alive=true;
    if(!authSession){setProfile(null);return;}
    setBusy(true);
    sb.from('app_profiles').select('role,app_channel').eq('user_id',authSession.user.id).maybeSingle()
      .then(({data,error})=>{
        if(!alive)return;
        if(error){setError('Profil introuvable ou non autorisé.');setProfile(null);return;}
        setProfile(data||null);
      })
      .finally(()=>{if(alive)setBusy(false);});
    return()=>{alive=false;};
  },[authSession]);

  const activeRole=profile&&profile.role?profile.role:(localSession&&localSession.role)||null;
  useEffect(()=>{window.notesFraisRole=activeRole||null;window.notesFraisProfile=profile||null;},[activeRole,profile]);

  const loginPassword=async()=>{
    setError('');setBusy(true);
    try{
      const {error}=await sb.auth.signInWithPassword({email:String(email||'').trim(),password});
      if(error)throw error;
      try{localStorage.removeItem('notesfrais_access');}catch(e){}
      setLocalSession(null);
      setPassword('');
    }catch(e){setError(e.message||'Connexion impossible.');}
    finally{setBusy(false);}
  };

  const unlockCode=()=>{
    const entered=String(code||'').trim().toUpperCase();
    const nextRole=entered===ACCESS_CODES.finance?'finance':entered===ACCESS_CODES.user?'user':null;
    if(!nextRole){setError('Code incorrect.');return;}
    const next={role:nextRole,at:Date.now(),legacy:true};
    try{localStorage.setItem('notesfrais_access',JSON.stringify(next));}catch(e){}
    window.notesFraisRole=nextRole;
    setLocalSession(next);
    setCode('');
    setError('');
  };

  const logout=async()=>{
    try{localStorage.removeItem('notesfrais_access');}catch(e){}
    await sb.auth.signOut().catch(()=>{});
    window.notesFraisRole=null;
    window.notesFraisProfile=null;
    setLocalSession(null);
    setAuthSession(null);
    setProfile(null);
    setCode('');
    setPassword('');
  };

  if(checkingAuth){
    return <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',color:'var(--t2)',fontSize:14}}>Vérification de l'accès...</div>;
  }

  if(authSession&&busy&&!profile){
    return <div style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)',color:'var(--t2)',fontSize:14}}>Chargement du profil...</div>;
  }

  if(authSession&&profile){
    return <>
      {children}
      <button onClick={logout} title="Changer d'accès" style={{position:'fixed',top:12,right:12,zIndex:2600,border:'0.5px solid rgba(26,26,26,0.08)',background:'rgba(255,255,255,0.92)',backdropFilter:'blur(10px)',color:'var(--t2)',borderRadius:999,padding:'7px 10px',fontSize:11,boxShadow:'0 8px 22px rgba(26,26,26,0.08)',cursor:'pointer'}}>{profile.role==='finance'?'Finance':'Mike'}</button>
    </>;
  }

  if(activeRole){
    return <>
      {children}
      {activeRole==='finance'&&<button onClick={logout} title="Changer d'accès" style={{position:'fixed',top:12,right:12,zIndex:2600,border:'0.5px solid rgba(26,26,26,0.08)',background:'rgba(255,255,255,0.92)',backdropFilter:'blur(10px)',color:'var(--t2)',borderRadius:999,padding:'7px 10px',fontSize:11,boxShadow:'0 8px 22px rgba(26,26,26,0.08)',cursor:'pointer'}}>Finance</button>}
    </>;
  }

  return <div style={{minHeight:'100dvh',background:'linear-gradient(135deg,#F5F3EF 0%,#EEF2FD 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
    <div style={{width:'100%',maxWidth:430,background:'#fff',border:'0.5px solid var(--border)',borderRadius:22,padding:24,boxShadow:'0 24px 80px rgba(26,26,26,0.12)'}}>
      <div style={{background:'linear-gradient(135deg,#0B1F4D,#1A3FB5)',borderRadius:18,padding:'22px 18px',color:'#fff',textAlign:'center',marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:'0.22em',opacity:0.72,marginBottom:8}}>NOTES DE FRAIS</div>
        <div style={{fontSize:24,fontWeight:800,letterSpacing:'0.08em'}}>NUMERIQ</div>
      </div>
      <h1 style={{fontSize:22,lineHeight:1.2,marginBottom:6}}>Accès sécurisé</h1>
      <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.5,marginBottom:16}}>Connectez-vous avec le compte Supabase. Le code local reste disponible temporairement tant que RLS n'est pas activé.</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
        <button onClick={()=>{setAuthMode('password');setError('');}} style={{...bS,justifyContent:'center',background:authMode==='password'?'var(--al)':'var(--s2)',color:authMode==='password'?'var(--accent)':'var(--t2)'}}>Compte</button>
        <button onClick={()=>{setAuthMode('code');setError('');}} style={{...bS,justifyContent:'center',background:authMode==='code'?'var(--al)':'var(--s2)',color:authMode==='code'?'var(--accent)':'var(--t2)'}}>Code local</button>
      </div>
      {authMode==='password'?<>
        <input value={email} onChange={e=>{setEmail(e.target.value);setError('');}} type="email" autoComplete="email" placeholder="Email" style={{...inp,fontSize:16,padding:'13px 14px',background:'#fff',marginBottom:10}} />
        <input value={password} onChange={e=>{setPassword(e.target.value);setError('');}} onKeyDown={e=>{if(e.key==='Enter')loginPassword();}} type="password" autoComplete="current-password" placeholder="Mot de passe" style={{...inp,fontSize:16,padding:'13px 14px',background:'#fff',marginBottom:10}} />
        {error&&<div style={{background:'var(--rl)',color:'var(--red)',borderRadius:10,padding:'9px 12px',fontSize:13,marginBottom:10}}>{error}</div>}
        <button onClick={loginPassword} disabled={busy} style={{...bP,width:'100%',justifyContent:'center',padding:'14px 18px',fontSize:15,opacity:busy?0.65:1}}>{busy?'Connexion...':'Se connecter'}</button>
      </>:<>
        <input value={code} onChange={e=>{setCode(e.target.value);setError('');}} onKeyDown={e=>{if(e.key==='Enter')unlockCode();}} type="password" inputMode="text" autoComplete="current-password" placeholder="Code" style={{...inp,fontSize:18,padding:'14px 15px',background:'#fff',marginBottom:10}} />
        {error&&<div style={{background:'var(--rl)',color:'var(--red)',borderRadius:10,padding:'9px 12px',fontSize:13,marginBottom:10}}>{error}</div>}
        <button onClick={unlockCode} style={{...bP,width:'100%',justifyContent:'center',padding:'14px 18px',fontSize:15}}>Déverrouiller</button>
        <div style={{fontSize:11,color:'var(--amber)',textAlign:'center',marginTop:12}}>Mode temporaire: ne fonctionnera plus après activation RLS stricte.</div>
      </>}
    </div>
  </div>;
}
`;
    html=html.replace('ReactDOM.render(<React.StrictMode><App/></React.StrictMode>,document.getElementById(\'root\'));',accessScript+'\nReactDOM.render(<React.StrictMode><AccessGate><App/></AccessGate></React.StrictMode>,document.getElementById(\'root\'));');
    return html;
  };
})();
