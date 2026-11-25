(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_SESSION_V1')) return html;

    // Session expiree (nov. 2026).
    //
    // Au bout de 14 jours, le serveur repondait 401 et l'app mettait le frais
    // dans la file hors ligne en affichant « Offline — Nothing is lost… as
    // soon as you have signal ». Mike, en plein reseau, attendait un signal
    // qui ne venait jamais : il fallait se reconnecter.
    //
    // Cote serveur, la session est desormais prolongee a chaque ouverture de
    // l'app (api/session.js) : ce cas devient rare. Cote app, un 401 sur une
    // route autre que /api/session leve le drapeau NOTESFRAIS_SIGNED_OUT, et :
    //  - un bandeau en haut de l'ecran invite a se reconnecter ; le frais
    //    deja saisi reste dans la file et part apres la reconnexion ;
    //  - le toast et le bandeau de la file disent « signed out » et non
    //    « offline ».
    //
    // Charge apres les traductions, en anglais ; chaque cible manquante leve
    // une erreur.
    const rep = (label, target, replacement) => {
      if(!html.includes(target)) throw new Error('session: cible introuvable ('+label+')');
      html = html.replace(target, replacement);
    };

    rep('api 401', "const err=new Error(data.error||('HTTP '+response.status));\n    err.status=response.status;",
      "const err=new Error(data.error||('HTTP '+response.status));\n    err.status=response.status;\n    if(response.status===401&&!/^\\/api\\/session/.test(String(path))){window.NOTESFRAIS_SIGNED_OUT=true;try{window.dispatchEvent(new Event('notesfrais-signed-out'));}catch(_e){}}");

    rep('signed out bar', 'function App(){', `const NOTESFRAIS_SESSION_V1=true;
function nfShowSignedOut(){
  if(document.getElementById('nf-signed-out'))return;
  const bar=document.createElement('div');
  bar.id='nf-signed-out';
  bar.setAttribute('role','alert');
  bar.style.cssText='position:fixed;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));z-index:7000;background:#2E3E4F;color:#fff;border-radius:14px;padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.25);font:600 14px/1.35 -apple-system,BlinkMacSystemFont,system-ui,sans-serif';
  bar.innerHTML='<div style="flex:1;min-width:0"><div>You are signed out</div><div style="font-weight:500;font-size:12.5px;opacity:.8;margin-top:2px">Sign in again. Expenses saved meanwhile stay on this device and are sent right after.</div></div><button type="button" style="border:0;background:#fff;color:#2E3E4F;border-radius:10px;padding:9px 14px;font-weight:700;font-size:14px">Sign in</button>';
  bar.querySelector('button').onclick=()=>window.location.reload();
  document.body.appendChild(bar);
}
window.addEventListener('notesfrais-signed-out',nfShowSignedOut);
// Au retour sur l'app (PWA reprise sans rechargement), on relit la session :
// le serveur la prolonge, ou dit qu'elle a expire et le bandeau s'affiche
// avant que Mike ne saisisse quoi que ce soit.
let nfSessionPingAt=0;
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!window.notesFraisProfile)return;
  const now=Date.now();if(now-nfSessionPingAt<10*60*1000)return;nfSessionPingAt=now;
  fetch('/api/session',{credentials:'same-origin'}).then(r=>r.json()).then(d=>{if(d&&d.ok&&!d.session){window.NOTESFRAIS_SIGNED_OUT=true;nfShowSignedOut();}}).catch(()=>{});
});
function App(){`);

    rep('queue toast', "notify('\ud83d\udcf4 Expense kept on this iPhone. It will sync once you are back online.');",
      "notify(window.NOTESFRAIS_SIGNED_OUT?'\ud83d\udd12 Signed out. Expense kept on this iPhone: sign in again to send it.':'\ud83d\udcf4 Expense kept on this iPhone. It will sync once you are back online.');");
    rep('banner title', "<div className=\"nfm-banner-t\">{'Offline \\u2014 '+offlineCount+' expense'+(offlineCount>1?'s':'')+' kept on this iPhone'}</div>",
      "<div className=\"nfm-banner-t\">{(window.NOTESFRAIS_SIGNED_OUT?'Signed out \\u2014 ':'Offline \\u2014 ')+offlineCount+' expense'+(offlineCount>1?'s':'')+' kept on this iPhone'}</div>");
    rep('banner text', "<div className=\"nfm-banner-s\">Nothing is lost. They upload by themselves as soon as you have signal.</div>",
      "<div className=\"nfm-banner-s\">{window.NOTESFRAIS_SIGNED_OUT?'Nothing is lost. Sign in again and they are sent right away.':'Nothing is lost. They upload by themselves as soon as you have signal.'}</div>");
    // Une seule resynchro a la fois. L'evenement « online » peut arriver
    // plusieurs fois (reseau qui hoquette, montage + retour du reseau) : deux
    // passes lisaient la meme file et envoyaient le meme frais deux fois
    // (vu en simulation : HILTL enregistre en double, deux emails de copie).
    rep('sync single-flight', "async function syncOfflineExpenses(onSaved){\n  if(!navigator.onLine)return 0;",
      "let nfSyncRunning=null;\nfunction syncOfflineExpenses(onSaved){\n  if(nfSyncRunning)return nfSyncRunning.then(()=>0,()=>0);\n  nfSyncRunning=nfSyncOfflineExpensesOnce(onSaved).finally(()=>{nfSyncRunning=null;});\n  return nfSyncRunning;\n}\nasync function nfSyncOfflineExpensesOnce(onSaved){\n  if(!navigator.onLine)return 0;");
    return html;
  };
})();
