(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_RECEIPT_AI_V1')) return html;

    // Lecture des recus par IA (nov. 2026).
    //
    // Tesseract, sur le telephone, lisait mal : ticket froisse, en biais, encre
    // pale, et un commercant devine sur la premiere ligne venue. La photo part
    // desormais a /api/receipt-ai (modele Claude), qui renvoie commercant,
    // total, TVA, devise, date et categorie. Un PDF (facture recue par email)
    // est lu de la meme facon ; Tesseract, lui, ne lisait que les images.
    //
    // Tesseract reste le secours, inchange : hors ligne, sans cle API cote
    // serveur, ou si la route echoue, la lecture repasse sur le telephone et
    // le diagnostic dit pourquoi l'IA n'a pas servi (« AI: ... »).
    //
    // Charge apres les traductions, en anglais ; chaque cible manquante leve
    // une erreur.
    const rep = (label, target, replacement) => {
      if(!html.includes(target)) throw new Error('receipt-ai: cible introuvable ('+label+')');
      html = html.replace(target, replacement);
    };

    rep('tesseract runOCR', '  const runOCR=async(imgFile)=>{\n    if(!imgFile.type.startsWith(\'image/\'))return;',
      '  const nfTesseractOCR=async(imgFile,nfAiNote)=>{\n    if(!imgFile.type.startsWith(\'image/\'))return;');

    rep('diagnostic', "const detail=[\n        stage+' \\u2192 '+describeError(e),",
      "const detail=[\n        nfAiNote?('AI: '+nfAiNote):'',\n        stage+' \\u2192 '+describeError(e),");

    rep('ai runOCR', '\n\n  const handleFile=async f=>{', String.raw`
  // Lecture par IA d'abord ; Tesseract si elle ne peut pas servir.
  const runOCR=async(imgFile)=>{
    if(!imgFile||!imgFile.type)return;
    const isImage=imgFile.type.startsWith('image/');
    const isPdf=imgFile.type==='application/pdf';
    if(!isImage&&!isPdf)return;
    const seq=window.NOTESFRAIS_OCR_SEQ=(window.NOTESFRAIS_OCR_SEQ||0)+1;
    const stale=()=>window.NOTESFRAIS_OCR_SEQ!==seq;
    let note='';
    if(navigator.onLine===false)note='offline, read on this iPhone';
    else if(imgFile.size>NOTESFRAIS_AI_MAX_BYTES)note='file too large ('+Math.round(imgFile.size/1024)+' KB)';
    else{
      setOcrStatus('scanning');setOcrProgress(5);setOcrReason('');
      let tick=5;
      const timer=setInterval(()=>{tick=Math.min(92,tick+(tick<60?9:3));if(!stale())setOcrProgress(tick);},700);
      try{
        const fields=await nfReadReceiptWithAI(imgFile);
        if(stale())return;
        if(fields&&fields.is_receipt===false){
          setOcrReason('AI: this does not look like a receipt · build '+(typeof NOTESFRAIS_BUILD==='string'?NOTESFRAIS_BUILD:'?'));
          setOcrStatus('error');
          return;
        }
        if(fields&&(fields.total!=null||fields.merchant)){
          setForm(f=>({...f,
            merchant:fields.merchant||f.merchant,
            amount:fields.total!=null?Number(fields.total).toFixed(2):f.amount,
            tva:fields.vat!=null?Number(fields.vat).toFixed(2):f.tva,
            date:fields.date||f.date,
            currency:fields.currency||f.currency||'CHF',
            category:fields.category&&CMAP[fields.category]?fields.category:f.category}));
          setOcrProgress(100);
          setOcrStatus('done');
          return;
        }
        note='nothing readable found';
      }catch(e){
        if(stale())return;
        note=(e&&e.message)||String(e);
      }finally{
        clearInterval(timer);
      }
    }
    if(stale())return;
    if(isImage)return nfTesseractOCR(imgFile,note);
    setOcrReason('AI: '+note+' · build '+(typeof NOTESFRAIS_BUILD==='string'?NOTESFRAIS_BUILD:'?'));
    setOcrStatus('error');
  };

  const handleFile=async f=>{`);

    // Un PDF n'etait jamais lu : Tesseract ne sait pas l'ouvrir. L'IA, si.
    rep('pdf read', "    }else{setPreview('pdf');}\n  };", "    }else{setPreview('pdf');runOCR(prepared);}\n  };");

    rep('helper', 'function AddModal({onClose,onAdd,month}){', String.raw`const NOTESFRAIS_RECEIPT_AI_V1=true;
// Vercel refuse un corps de plus de 4,5 Mo ; le base64 grossit d'un tiers.
const NOTESFRAIS_AI_MAX_BYTES=3*1024*1024;
function nfFileToBase64(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result||'').replace(/^data:[^,]*,/,''));
    r.onerror=()=>reject(r.error||new Error('file could not be read'));
    r.readAsDataURL(file);
  });
}
async function nfReadReceiptWithAI(file){
  const data=await nfFileToBase64(file);
  const ctrl=typeof AbortController==='function'?new AbortController():null;
  const timer=setTimeout(()=>{if(ctrl)ctrl.abort();},45000);
  const d=new Date();
  const today=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  let response;
  try{
    response=await fetch('/api/receipt-ai',{method:'POST',credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data,media_type:file.type,today}),
      signal:ctrl?ctrl.signal:undefined});
  }catch(e){
    throw new Error(e&&e.name==='AbortError'?'no answer after 45 s':'network error');
  }finally{
    clearTimeout(timer);
  }
  let body=null;
  try{body=await response.json();}catch(_e){}
  if(!response.ok||!body||!body.ok||!body.fields){
    throw new Error((body&&body.error)||('HTTP '+response.status));
  }
  return body.fields;
}
function AddModal({onClose,onAdd,month}){`);

    // Retirer la photo ou repartir sur un frais vierge rend caduque toute
    // lecture encore en cours : sa reponse ne doit plus remplir le formulaire.
    const nfDrop='window.NOTESFRAIS_OCR_SEQ=(window.NOTESFRAIS_OCR_SEQ||0)+1;';
    const removeBtn='onClick={()=>{setFile(null);setPreview(null);setOcrStatus(null);setOcrProgress(0);}}';
    if(!html.includes(removeBtn)) throw new Error('receipt-ai: cible introuvable (remove receipt)');
    html = html.split(removeBtn).join('onClick={()=>{'+nfDrop+'setFile(null);setPreview(null);setOcrStatus(null);setOcrProgress(0);}}');
    rep('reset', 'const nfmReset=()=>{setFile(null);', 'const nfmReset=()=>{'+nfDrop+'setFile(null);');

    return html;
  };
})();
