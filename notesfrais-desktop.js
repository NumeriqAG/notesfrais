(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_DESKTOP_V2')) return html;

    // Mike sur ordinateur (nov. 2026).
    //
    // Mike recoit beaucoup de recus electroniques : factures PDF par email,
    // portails (CFF, hotels, compagnies aeriennes), captures. Il doit pouvoir
    // les saisir depuis son ordinateur, plusieurs a la fois.
    //
    // - Glisser-deposer n'importe ou sur la page (ou « Choose files ») : les
    //   fichiers forment une file. La fenetre d'ajout s'ouvre sur le premier,
    //   la lecture par IA remplit les champs, Mike verifie et confirme, et le
    //   suivant s'ouvre tout seul (« Receipt 2 of 5 »). On reutilise le
    //   formulaire existant : carte de paiement, « Who with? », devise et
    //   controles restent exactement les memes que sur l'iPhone.
    // - Sur grand ecran, la fenetre d'ajout montre le justificatif en grand
    //   (PDF ou image) a cote du formulaire, pour verifier d'un coup d'oeil.
    // - La carte du mois, mise en forme pour l'iPhone, est enfin lisible sur
    //   ordinateur.
    //
    // Rien ne change pour la finance : tout est conditionne a un compte
    // `user` sur un ecran large (>= 860 px, le seuil `isMobile` de l'app).
    //
    // Charge apres les traductions, en anglais ; chaque cible manquante leve
    // une erreur au lieu d'un no-op silencieux.
    const rep = (label, target, replacement, count = 1) => {
      const n = html.split(target).length - 1;
      if(n !== count) throw new Error('desktop: cible '+label+' trouvee '+n+' fois au lieu de '+count);
      html = html.split(target).join(replacement);
    };

    // ── 1. Outils globaux, la zone de depot de page et le panneau d'import ──
    rep('App', '\nfunction App(){', String.raw`
// NOTESFRAIS_DESKTOP_V2 : saisie depuis un ordinateur, plusieurs recus a la fois.
function nfDeskOn(){return typeof window!=='undefined'&&window.innerWidth>=860&&!!window.notesFraisRole&&window.notesFraisRole!=='finance';}
function nfDeskAccept(list){
  return [...(list||[])].filter(Boolean).map(f=>{
    const name=f.name||'';
    if(!f.type&&/\.pdf$/i.test(name)){try{return new File([f],name,{type:'application/pdf'});}catch(e){return f;}}
    return f;
  }).filter(f=>/^image\//.test(f.type||'')||f.type==='application/pdf');
}
function nfDeskFeed(list,onOpen){
  const files=nfDeskAccept(list);
  if(!files.length){alert('Only PDF files and images (JPG, PNG) can be added as receipts.');return;}
  if(typeof window.NOTESFRAIS_DESK_ADD==='function'){window.NOTESFRAIS_DESK_ADD(files);return;}
  window.NOTESFRAIS_DESK_PENDING=files;
  if(onOpen)onOpen();
}
function NfDeskDrop({onOpen}){
  const [drag,setDrag]=React.useState(false);
  const openRef=React.useRef(onOpen);openRef.current=onOpen;
  React.useEffect(()=>{
    // Le voile couvre toute la page pendant le survol (y compris l'apercu PDF,
    // une iframe qui avalerait sinon le depot). Il s'efface 900 ms apres le
    // dernier dragover : jamais de voile bloque si un dragleave se perd.
    let hide=null;
    const stop=()=>{clearTimeout(hide);hide=null;setDrag(false);};
    const sync=()=>{document.body.classList.toggle('nf-desk-user',nfDeskOn());};
    const hasFiles=e=>{const t=e.dataTransfer&&e.dataTransfer.types;return !!t&&[...t].indexOf('Files')>=0;};
    const over=e=>{
      if(!nfDeskOn()||!hasFiles(e))return;
      e.preventDefault();try{e.dataTransfer.dropEffect='copy';}catch(_){}
      setDrag(true);clearTimeout(hide);hide=setTimeout(stop,900);
    };
    const drop=e=>{
      if(!nfDeskOn()||!hasFiles(e))return;
      stop();
      if(e.defaultPrevented)return;           // deja pris par la zone de la fenetre d'ajout
      e.preventDefault();                     // sinon le navigateur ouvre le PDF a la place de l'app
      nfDeskFeed(e.dataTransfer.files,()=>openRef.current&&openRef.current());
    };
    sync();
    const timer=setInterval(sync,1500);
    window.addEventListener('resize',sync);
    window.addEventListener('dragenter',over);
    window.addEventListener('dragover',over);
    window.addEventListener('drop',drop);
    window.addEventListener('dragend',stop);
    return()=>{clearInterval(timer);clearTimeout(hide);window.removeEventListener('resize',sync);window.removeEventListener('dragenter',over);window.removeEventListener('dragover',over);window.removeEventListener('drop',drop);window.removeEventListener('dragend',stop);};
  },[]);
  if(!drag)return null;
  return(
    <div className="nf-desk-overlay" aria-hidden="true">
      <div className="nf-desk-overlay-card">
        <div className="nf-desk-overlay-ico">⤓</div>
        <div className="nf-desk-overlay-t">Drop your receipts</div>
        <div className="nf-desk-overlay-s">PDFs or photos, several at once. Each one is read for you.</div>
      </div>
    </div>
  );
}
function NfDeskImport({onOpen}){
  const ref=React.useRef(null);
  return(
    <div className="nf-desk-import" data-nf-desk-import="true" onClick={()=>ref.current&&ref.current.click()} role="button" tabIndex={0}>
      <input ref={ref} type="file" multiple accept="image/*,.pdf,application/pdf" style={{display:'none'}} onClick={e=>e.stopPropagation()} onChange={e=>{const l=[...(e.target.files||[])];e.target.value='';if(l.length)nfDeskFeed(l,onOpen);}}/>
      <div className="nf-desk-import-ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6"/><path d="M9.5 14.5 12 12l2.5 2.5"/></svg></div>
      <div className="nf-desk-import-txt">
        <div className="nf-desk-import-t">Add receipts from your computer</div>
        <div className="nf-desk-import-s">Drag PDFs or photos here: invoices from email, portals, scans. Several at once, each one is read for you.</div>
      </div>
      <button type="button" className="nf-desk-import-btn" onClick={e=>{e.stopPropagation();ref.current&&ref.current.click();}}>Choose files</button>
    </div>
  );
}

function App(){`);

    rep('modale', '{showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={addExpense} month={month}/>}',
      '<NfDeskDrop onOpen={()=>setShowAdd(true)}/>{showAdd&&<AddModal onClose={()=>setShowAdd(false)} onAdd={addExpense} month={month}/>}');

    rep('panneau import', '<div style={{marginBottom:12}}><input value={search}',
      '{!isMobile&&window.notesFraisRole!==\'finance\'&&<NfDeskImport onOpen={()=>setShowAdd(true)}/>}<div style={{marginBottom:12}}><input value={search}');

    // ── 2. La file dans la fenetre d'ajout ──────────────────────────────────
    rep('file AddModal', '\n  const confirm=async(nfmAgain)=>{', String.raw`
  // File de recus deposes ensemble (NOTESFRAIS_DESKTOP_V2).
  const nfDeskRef=React.useRef({q:[],pos:0,total:0,last:''});
  const [,nfDeskBump]=React.useState(0);
  const nfDeskHasFile=React.useRef(false);nfDeskHasFile.current=!!file;
  const nfDeskStart=list=>{
    const files=nfDeskAccept(list);
    if(!files.length)return;
    const s=nfDeskRef.current;
    if(nfDeskHasFile.current){s.q=s.q.concat(files);s.total=(s.total||1)+files.length;if(!s.pos)s.pos=1;}
    else{clearExpenseDraft();if(s.total)nfmReset();s.q=files.slice(1);s.pos=1;s.total=files.length;s.last='';handleFile(files[0]);}
    nfDeskBump(n=>n+1);
  };
  const nfDeskNext=saved=>{
    const s=nfDeskRef.current;
    if(!s.q.length){s.q=[];s.pos=0;s.total=0;return false;}
    s.last=saved||'';
    const next=s.q.shift();s.pos++;
    nfmReset();handleFile(next);nfDeskBump(n=>n+1);
    return true;
  };
  window.NOTESFRAIS_DESK_ADD=isMobile?null:nfDeskStart;
  React.useEffect(()=>{
    const pending=window.NOTESFRAIS_DESK_PENDING;window.NOTESFRAIS_DESK_PENDING=null;
    if(pending&&pending.length&&!isMobile){nfmReset();nfDeskStart(pending);}
    return()=>{window.NOTESFRAIS_DESK_ADD=null;};
  },[]);
  const nfDeskUrl=React.useMemo(()=>{if(isMobile||!file||window.notesFraisRole==='finance')return null;try{return URL.createObjectURL(file);}catch(e){return null;}},[file]);
  React.useEffect(()=>()=>{if(nfDeskUrl)try{URL.revokeObjectURL(nfDeskUrl);}catch(e){}},[nfDeskUrl]);
  const nfDeskS=nfDeskRef.current;

  const confirm=async(nfmAgain)=>{`);

    // Apres enregistrement : le recu suivant de la file, sinon fermer comme avant.
    rep('enchainement', 'clearExpenseDraft();if(nfmAgain===true){nfmReset();}else{onClose();}',
      'clearExpenseDraft();if(nfmAgain===true){nfmReset();}else if(!nfDeskNext(form.merchant)){onClose();}', 2);

    // ── 3. La fenetre d'ajout sur ordinateur ────────────────────────────────
    // role="dialog" : le panneau « Local queue » de sync-status.js s'efface
    // devant une fenetre modale ; sans lui, il recouvrait le bouton Confirm.
    rep('largeur', "<div style={{background:'#fff',borderRadius:isMobile?'18px 18px 0 0':18,padding:isMobile?18:24,width:'100%',maxWidth:isMobile?'100%':480,maxHeight:isMobile?'92dvh':'92vh'",
      "<div role=\"dialog\" aria-modal=\"true\" style={{background:'#fff',borderRadius:isMobile?'18px 18px 0 0':18,padding:isMobile?18:24,width:'100%',maxWidth:isMobile?'100%':(nfDeskUrl?1100:480),maxHeight:isMobile?'92dvh':'92vh'");

    rep('colonnes', "<div style={{display:'grid',gap:12}}>\n          <div>\n            <label style={lbl}>Receipt - photo or PDF</label>", String.raw`{nfDeskS.total>1&&<div className="nf-desk-queue" data-nf-desk-queue="true"><div><b>{'Receipt '+nfDeskS.pos+' of '+nfDeskS.total}</b>{nfDeskS.last?<span>{' · ✓ '+nfDeskS.last+' saved'}</span>:null}</div><button type="button" onClick={()=>{if(!nfDeskNext(''))onClose();}}>{nfDeskS.q.length?'Skip this one':'Skip and close'}</button></div>}
        <div style={nfDeskUrl?{display:'grid',gridTemplateColumns:'minmax(0,1.15fr) minmax(0,1fr)',gap:24,alignItems:'start'}:{}}>{nfDeskUrl&&<div className="nf-desk-preview" data-nf-desk-preview="true">{file&&file.type==='application/pdf'?<iframe title="Receipt" src={nfDeskUrl+'#view=FitH&navpanes=0'}/>:<img src={nfDeskUrl} alt="Receipt"/>}</div>}<div style={{minWidth:0}}>
        <div style={{display:'grid',gap:12}}>
          <div>
            <label style={lbl}>Receipt - photo or PDF</label>`);

    rep('fin colonnes', "{uploading?'⏳ Uploading…':'✓ Confirm'}</button>\n        </div>\n      </div>\n    </div>\n  );\n}\n\nfunction UBSModal",
      "{uploading?'⏳ Uploading…':'✓ Confirm'}</button>\n        </div>\n        </div></div>\n      </div>\n    </div>\n  );\n}\n\nfunction UBSModal");

    // Plusieurs fichiers, au clic comme au depot.
    rep('input', `<input ref={fRef} type="file" accept="image/*,.pdf" style={{display:'none'}} onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}}/>`,
      `<input ref={fRef} type="file" multiple={window.notesFraisRole!=='finance'} accept="image/*,.pdf,application/pdf" style={{display:'none'}} onChange={e=>{const l=[...(e.target.files||[])];e.target.value='';if(l.length)nfDeskStart(l);}}/>`);
    rep('depot', 'if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);',
      'if(e.dataTransfer.files&&e.dataTransfer.files.length)nfDeskStart([...e.dataTransfer.files]);');
    rep('texte depot', 'Drop or tap to add', 'Drop or click to add');
    rep('texte depot 2', "<div style={{fontSize:11,color:'var(--t3)'}}>Receipt photo or PDF</div>",
      "<div style={{fontSize:11,color:'var(--t3)'}}>{window.notesFraisRole!=='finance'?'Photos or PDFs, several at once':'Receipt photo or PDF'}</div>");
    rep('lecture', 'OCR scanning... {ocrProgress}%', 'Reading the receipt… {ocrProgress}%');
    rep('lecture ok', 'OCR done - data extracted automatically', 'Read · check the fields');
    rep('lecture ko', 'OCR unavailable - enter manually', 'Could not read it · enter the fields');

    // Zone principale reperable : sur grand ecran, le contenu y est centre
    // (il etait colle a gauche avec un grand vide a droite).
    rep('zone principale', "<div style={{flex:1,overflowY:'auto',padding:isMobile?16:28}}>",
      "<div data-nf-main=\"true\" style={{flex:1,overflowY:'auto',padding:isMobile?16:28}}>");

    // ── 4. Styles : ecran large, compte utilisateur seulement ──────────────
    const css = `<style id="nf-desk-css">
/* NOTESFRAIS_DESKTOP_V2 */
.nf-desk-overlay{position:fixed;inset:0;z-index:5000;background:rgba(15,94,146,.10);backdrop-filter:blur(1px);display:flex;align-items:center;justify-content:center;border:3px dashed #0F5E92;border-radius:14px;margin:8px}
.nf-desk-overlay-card{pointer-events:none;background:#fff;border-radius:18px;padding:28px 40px;text-align:center;box-shadow:0 24px 60px rgba(30,43,56,.18)}
.nf-desk-overlay-ico{font-size:34px;color:#0F5E92;line-height:1;margin-bottom:8px}
.nf-desk-overlay-t{font-size:18px;font-weight:700;color:#1E2B38}
.nf-desk-overlay-s{font-size:13px;color:#5B6875;margin-top:4px}
.nf-desk-import{display:flex;align-items:center;gap:14px;border:1.5px dashed #B9C7D4;background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:14px;cursor:pointer;transition:border-color .15s,background .15s}
.nf-desk-import:hover{border-color:#0F5E92;background:#F5F9FC}
.nf-desk-import-ico{width:42px;height:42px;border-radius:10px;background:#E7F0F7;color:#0F5E92;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.nf-desk-import-txt{flex:1;min-width:0}
.nf-desk-import-t{font-size:14px;font-weight:650;color:#1E2B38}
.nf-desk-import-s{font-size:12px;color:#5B6875;margin-top:2px}
.nf-desk-import-btn{background:#0F5E92;color:#fff;border:0;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;font-family:inherit}
.nf-desk-queue{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#E7F0F7;color:#0F5E92;border-radius:10px;padding:9px 12px;margin:-6px 0 14px;font-size:13px}
.nf-desk-queue span{color:#0F6E56;font-weight:500}
.nf-desk-queue button{background:#fff;border:0.5px solid #B9C7D4;color:#1E2B38;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0}
.nf-desk-preview{position:sticky;top:0;height:min(72vh,760px);background:#F3F6F9;border:0.5px solid #D5DEE6;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center}
.nf-desk-preview iframe{width:100%;height:100%;border:0;background:#fff}
.nf-desk-preview img{max-width:100%;max-height:100%;object-fit:contain}
body.nf-desk-user [data-nf-main]>*{margin-left:auto!important;margin-right:auto!important}
body.nf-desk-user [data-nf-main]>*:not([style*="position: fixed"]){max-width:1100px!important}
body.nf-desk-user [data-nfm-expenses]{max-width:1100px!important}
body.nf-desk-user [data-user-submit-placement]{display:grid!important;grid-template-columns:minmax(200px,1fr) minmax(260px,1.2fr) auto;column-gap:28px;row-gap:12px;align-items:center!important;padding:18px 22px!important}
body.nf-desk-user [data-user-submit-placement]>*{grid-column:1/-1;order:0}
body.nf-desk-user [data-user-submit-placement]>.nfm-sum-head{grid-column:auto;order:1;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
body.nf-desk-user [data-user-submit-placement]>.nfm-sum-grid{grid-column:auto;order:2;display:grid;grid-template-columns:1fr 1fr;gap:20px;border-left:0.5px solid #D5DEE6;padding-left:24px}
body.nf-desk-user [data-user-submit-placement]>.nfm-submit{grid-column:auto;order:3}
body.nf-desk-user [data-user-submit-placement]>.nfm-track{order:4;height:4px;border-radius:99px;background:#E9EEF3;overflow:hidden}
body.nf-desk-user .nfm-track>i{display:block;height:100%;border-radius:99px;background:#0F5E92}
body.nf-desk-user .nfm-sum-label{font-size:12px;color:#5B6875;font-weight:500}
body.nf-desk-user .nfm-sum-total{font-size:26px;font-weight:700;color:#1E2B38;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
body.nf-desk-user .nfm-badge{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:4px 10px}
body.nf-desk-user .nfm-badge-open{background:#E7F0F7;color:#0F5E92}
body.nf-desk-user .nfm-badge-closed{background:#E3F4EC;color:#0F6E56}
body.nf-desk-user .nfm-sum-k{font-size:12px;color:#5B6875;font-weight:500}
body.nf-desk-user .nfm-sum-v{font-size:17px;font-weight:650;color:#1E2B38;margin-top:3px;font-variant-numeric:tabular-nums}
body.nf-desk-user .nfm-sum-ubs-go{cursor:pointer}
body.nf-desk-user .nfm-sum-ubs-go .nfm-sum-v{color:#0F5E92}
body.nf-desk-user .nfm-sum-ubs-go .nfm-sum-v:after{content:" \\203A";font-weight:600}
body.nf-desk-user .nfm-strip{display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:600;letter-spacing:.04em;color:#5B6875;margin:4px 4px 8px}
body.nf-desk-user .nfm-strip b{font-size:13px;color:#1E2B38;letter-spacing:0}
</style>`;
    rep('head', '</head>', css + '</head>');
    return html;
  };
})();
