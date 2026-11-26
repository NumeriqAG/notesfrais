(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_PDF_VIEWER_V1')) return html;

    // Les justificatifs PDF s'affichent enfin dans la visionneuse (nov. 2026).
    //
    // ReceiptViewer et UserReceiptGallery (Mike comme la finance) mettaient
    // l'URL signee R2 dans un <iframe>. Or la CSP de vercel.json n'autorise
    // les cadres que depuis 'self' et blob: (frame-src) : le navigateur
    // refusait le cadre et la visionneuse restait vide pour tout PDF.
    //
    // On lit le PDF par /api/receipts?raw=1 (meme origine, meme double
    // controle d'acces que l'URL signee) et on l'affiche depuis un blob:.
    // En cas d'echec (fichier trop lourd pour une reponse Vercel, reseau),
    // un lien ouvre l'URL signee dans un nouvel onglet : une navigation n'est
    // pas soumise a frame-src. Sur iPhone, Safari ne montre que la premiere
    // page d'un PDF dans un cadre : le meme lien reste visible.
    //
    // Charge apres desk-workspace.js, en anglais ; chaque cible manquante
    // leve une erreur au lieu d'un no-op silencieux.
    const rep = (label, target, replacement, count = 1) => {
      const n = html.split(target).length - 1;
      if(n !== count) throw new Error('pdf-viewer: cible '+label+' trouvee '+n+' fois au lieu de '+count);
      html = html.split(target).join(replacement);
    };

    rep('composant', '\nfunction ReceiptViewer({path,name,onClose}){', String.raw`
// NOTESFRAIS_PDF_VIEWER_V1 : un PDF s'affiche depuis un blob:, la CSP refusant un cadre vers R2.
function nfPdfBlobUrl(path,name){
  const qs=new URLSearchParams({path:String(path||''),name:name||'receipt.pdf',raw:'1'});
  return fetch('/api/receipts?'+qs.toString(),{credentials:'same-origin'})
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.blob();})
    .then(b=>URL.createObjectURL(new Blob([b],{type:'application/pdf'})));
}
function nfIsIos(){try{return /iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);}catch(e){return false;}}
function NfPdfFrame({path,name,url,style,dark}){
  const [src,setSrc]=useState(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let live=true,made=null;
    setSrc(null);setFailed(false);
    nfPdfBlobUrl(path,name).then(u=>{made=u;if(live)setSrc(u);}).catch(()=>{if(live)setFailed(true);});
    return()=>{live=false;if(made)setTimeout(()=>{try{URL.revokeObjectURL(made);}catch(_){}},1000);};
  },[path]);
  const fg=dark?'#fff':'var(--t2)';
  const open=url?<a href={url} target="_blank" rel="noopener" data-nf-pdf-open="true" style={{display:'inline-flex',alignItems:'center',gap:6,background:'#0F5E92',color:'#fff',textDecoration:'none',borderRadius:10,padding:'9px 14px',fontSize:13,fontWeight:700}}>Open the PDF ↗</a>:null;
  if(failed)return <div data-nf-pdf-frame="failed" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,padding:20,textAlign:'center',color:fg,fontSize:13}}><div>The PDF can't be shown here.</div>{open}</div>;
  if(!src)return <div data-nf-pdf-frame="loading" style={{color:dark?'#aeaeb2':'var(--t3)',fontSize:13}}>Loading the PDF…</div>;
  return <div data-nf-pdf-frame="ready" style={{position:'relative',width:'100%',height:'100%'}}>
    <iframe src={src+'#toolbar=0&navpanes=0'} style={style} title="receipt"/>
    {nfIsIos()&&open&&<div style={{position:'absolute',right:12,bottom:12}}>{open}</div>}
  </div>;
}

function ReceiptViewer({path,name,onClose}){`);

    rep('visionneuse', `isPDF(path)?<iframe src={url+'#toolbar=0&navpanes=0'} style={{width:'100%',height:'100%',border:'none',background:'#fff'}} title="receipt"/>`,
      `isPDF(path)?<NfPdfFrame path={path} name={name} url={url} style={{width:'100%',height:'100%',border:'none',background:'#fff',display:'block'}}/>`);
    rep('galerie', `isPDF(item.path)?<iframe src={url+'#toolbar=0&navpanes=0'} style={{width:'100%',height:'100%',border:0,background:'#fff',borderRadius:isMobile?0:10}} title="gallery file"/>`,
      `isPDF(item.path)?<NfPdfFrame dark path={item.path} name={item.name} url={url} style={{width:'100%',height:'100%',border:0,background:'#fff',borderRadius:isMobile?0:10,display:'block'}}/>`);
    return html;
  };
})();
