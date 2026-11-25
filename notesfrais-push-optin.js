(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_PUSH_OPTIN_V1')) return html;

    // Notifications Web Push : propose a l'utilisateur de recevoir sur son
    // iPhone les decisions et commentaires de la finance (l'envoi vit dans
    // api/_lib/notify.js, l'abonnement dans /api/push-subscription, l'affichage
    // dans mike-sw.js / test-sw.js).
    //
    // Charge EN DERNIER, apres toutes les traductions : ses textes sont donc
    // ecrits directement en anglais, comme le reste de l'interface, et il cible
    // du code deja traduit. Il parle directement a /api/push-subscription,
    // route hors du shim Supabase.
    const components = String.raw`
const NOTESFRAIS_PUSH_OPTIN_V1=true;
function nfdKeyToBytes(base64){
  const padding='='.repeat((4-base64.length%4)%4);
  const raw=atob((base64+padding).replace(/-/g,'+').replace(/_/g,'/'));
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
async function nfdSaveSubscription(sub){
  const res=await fetch('/api/push-subscription',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON?sub.toJSON():sub})});
  if(!res.ok)throw new Error('HTTP '+res.status);
}
function nfdPushSupported(){
  return typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
}
// Sur iPhone, PushManager n'existe que dans la PWA installee sur l'ecran
// d'accueil (iOS 16.4+). Dans Safari, on propose donc d'abord l'installation.
function nfdIsIosBrowserTab(){
  const ua=navigator.userAgent||'';
  const ios=/iPhone|iPad|iPod/.test(ua);
  const standalone=window.navigator.standalone===true||(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches);
  return ios&&!standalone;
}
function NfdPushOptIn(){
  const [state,setState]=useState('hidden');
  const [error,setError]=useState('');
  const regRef=useRef(null);
  const keyRef=useRef(null);
  useEffect(()=>{
    let alive=true;
    let dismissed=false;
    try{dismissed=localStorage.getItem('notesfrais-push-dismissed')==='1';}catch(_){}
    if(!nfdPushSupported()){
      if(nfdIsIosBrowserTab()&&!dismissed)setState('install');
      return;
    }
    (async()=>{
      try{
        const res=await fetch('/api/push-subscription',{credentials:'same-origin',cache:'no-store'});
        const json=await res.json().catch(()=>({}));
        if(!json||!json.publicKey)return;
        keyRef.current=json.publicKey;
        const reg=await Promise.race([navigator.serviceWorker.ready,new Promise(r=>setTimeout(()=>r(null),5000))]);
        if(!reg||!reg.pushManager)return;
        regRef.current=reg;
        const existing=await reg.pushManager.getSubscription();
        if(existing){
          nfdSaveSubscription(existing).catch(()=>undefined);
          if(alive)setState('on');
          return;
        }
        if(Notification.permission==='denied'){if(alive&&!dismissed)setState('denied');return;}
        if(alive&&!dismissed)setState('offer');
      }catch(_){}
    })();
    return ()=>{alive=false;};
  },[]);
  const dismiss=()=>{try{localStorage.setItem('notesfrais-push-dismissed','1');}catch(_){}setState('hidden');};
  const enable=()=>{
    // iOS exige que requestPermission parte directement du geste : aucun await avant.
    setState('working');setError('');
    Notification.requestPermission().then(async permission=>{
      if(permission!=='granted'){setState(permission==='denied'?'denied':'offer');return;}
      const reg=regRef.current||await navigator.serviceWorker.ready;
      const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:nfdKeyToBytes(keyRef.current)});
      await nfdSaveSubscription(sub);
      setState('on');
    }).catch(err=>{setError(String(err&&err.message||err));setState('offer');});
  };
  if(state==='hidden'||state==='on')return null;
  const box={background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:'12px 14px',marginBottom:14,display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'};
  if(state==='install')return <div data-nf-push-optin="install" style={box}><div style={{fontSize:13,color:'var(--t2)',lineHeight:1.4,flex:'1 1 200px'}}>🔔 To be notified when finance replies, add NotesFrais to your Home Screen (Share → Add to Home Screen) and open it from there.</div><button onClick={dismiss} style={{...bS,justifyContent:'center'}}>OK</button></div>;
  if(state==='denied')return <div data-nf-push-optin="denied" style={box}><div style={{fontSize:13,color:'var(--t2)',lineHeight:1.4,flex:'1 1 200px'}}>🔕 Notifications are blocked for NotesFrais. You can allow them in Settings → Notifications → NotesFrais. Finance replies still arrive by email.</div><button onClick={dismiss} style={{...bS,justifyContent:'center'}}>OK</button></div>;
  return <div data-nf-push-optin="offer" style={box}>
    <div style={{fontSize:13,color:'var(--t2)',lineHeight:1.4,flex:'1 1 200px'}}>🔔 Get a notification on this device when finance approves, sends back or comments on your expenses.{error&&<div style={{color:'var(--red)',fontSize:12,marginTop:4}}>{error}</div>}</div>
    <div style={{display:'flex',gap:8}}><button onClick={dismiss} style={{...bS,justifyContent:'center'}}>Not now</button><button disabled={state==='working'} onClick={enable} style={{...bP,justifyContent:'center',opacity:state==='working'?0.6:1}}>{state==='working'?'...':'Turn on'}</button></div>
  </div>;
}
`;

    html = html.replace('function App(){', components + '\nfunction App(){');

    // Utilisateur : la proposition d'activer les notifications, en tete de
    // l'onglet Expenses (le bandeau de la derniere decision vient de
    // notesfrais-month-review.js, autre patch).
    html = html.replace(
      "monthCounts={monthCounts}/>{window.notesFraisRole!=='finance'&&periodMode==='month'&&<div data-user-submit-placement=\"true\"",
      "monthCounts={monthCounts}/>{window.notesFraisRole!=='finance'&&periodMode==='month'&&<NfdPushOptIn/>}{window.notesFraisRole!=='finance'&&periodMode==='month'&&<div data-user-submit-placement=\"true\""
    );

    return html;
  };
})();
