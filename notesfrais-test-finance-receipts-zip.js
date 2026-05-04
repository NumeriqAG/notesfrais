(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('NOTESFRAIS_FINANCE_RECEIPTS_ZIP_TEST_V1')) return html;

    const helper = String.raw`
const NOTESFRAIS_FINANCE_RECEIPTS_ZIP_TEST_V1=true;
function safeZipPart(value){
  return String(value||'sans-nom').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'sans-nom';
}
function receiptExtension(expense){
  const source=String(expense.receiptName||expense.receiptPath||expense.receiptUrl||'').split('?')[0];
  const m=source.match(/\.([a-zA-Z0-9]{2,6})$/);
  return m?m[1].toLowerCase():'jpg';
}
async function ensureNotesFraisZip(){
  if(window.JSZip)return window.JSZip;
  await new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-notesfrais-jszip]');
    if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    s.async=true;
    s.dataset.notesfraisJszip='true';
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
  return window.JSZip;
}
async function downloadFinanceReceiptsZip(expenses,label,setBusy){
  const receipts=(expenses||[]).filter(e=>e.receiptPath||e.receiptUrl);
  if(receipts.length===0)return;
  setBusy(true);
  try{
    const JSZip=await ensureNotesFraisZip();
    const zip=new JSZip();
    const failures=[];
    for(let i=0;i<receipts.length;i++){
      const e=receipts[i];
      try{
        const value=e.receiptPath||e.receiptUrl;
        const url=typeof getReceiptUrl==='function'?await getReceiptUrl(value,true,e.receiptName||'justificatif'):value;
        const res=await fetch(url);
        if(!res.ok)throw new Error('HTTP '+res.status);
        const blob=await res.blob();
        const ext=receiptExtension(e);
        const name=[String(i+1).padStart(2,'0'),e.date||'date',safeZipPart(e.merchant),safeZipPart(e.receiptName||'recu')].filter(Boolean).join('_')+'.'+ext;
        zip.file(name,blob);
      }catch(err){
        failures.push(e.merchant||e.receiptName||('recu '+(i+1)));
      }
    }
    if(Object.keys(zip.files).length===0)throw new Error('Aucun justificatif telechargeable');
    if(failures.length>0)zip.file('_A_LIRE_erreurs.txt','Justificatifs non recuperes:\n'+failures.join('\n'));
    const content=await zip.generateAsync({type:'blob'});
    const a=document.createElement('a');
    const url=URL.createObjectURL(content);
    a.href=url;
    a.download='justificatifs_'+safeZipPart(label)+'.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }catch(err){
    alert('Impossible de creer le ZIP des recus: '+(err.message||err));
  }finally{
    setBusy(false);
  }
}
`;

    html = html.replace('function FinanceExpensesTab({', helper + '\nfunction FinanceExpensesTab({');

    html = html.replace(
      "const receiptCount=fil.filter(e=>e.receiptPath||e.receiptUrl).length;",
      "const receiptCount=fil.filter(e=>e.receiptPath||e.receiptUrl).length;\n  const periodReceiptCount=mE.filter(e=>e.receiptPath||e.receiptUrl).length;\n  const [downloadingReceipts,setDownloadingReceipts]=useState(false);"
    );

    html = html.replace(
      "<button onClick={()=>setShowAdd(true)} style={{...bS,justifyContent:'center'}}>+ Ajouter</button>\n              <button disabled={!canSubmit} onClick={()=>setShowSubmitSummary(true)}",
      "<button onClick={()=>setShowAdd(true)} style={{...bS,justifyContent:'center'}}>+ Ajouter</button>\n              <button disabled={periodReceiptCount===0||downloadingReceipts} onClick={()=>downloadFinanceReceiptsZip(mE,ML,setDownloadingReceipts)} style={{...bS,justifyContent:'center',opacity:(periodReceiptCount===0||downloadingReceipts)?0.55:1}}>{downloadingReceipts?'ZIP...':'Télécharger reçus ('+periodReceiptCount+')'}</button>\n              <button disabled={!canSubmit} onClick={()=>setShowSubmitSummary(true)}"
    );

    return html;
  };
})();
