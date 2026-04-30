(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('compressReceiptImageForTest')) return html;

    const helper = String.raw`
async function compressReceiptImageForTest(file){
  if(!file||!file.type||!file.type.startsWith('image/'))return file;
  const maxSide=1800;
  const quality=0.78;
  const originalSize=file.size||0;
  try{
    const bitmap=await new Promise((resolve,reject)=>{
      if(window.createImageBitmap){
        createImageBitmap(file).then(resolve).catch(()=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=reject;
          img.src=URL.createObjectURL(file);
        });
      }else{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=reject;
        img.src=URL.createObjectURL(file);
      }
    });
    const width=bitmap.width||bitmap.naturalWidth;
    const height=bitmap.height||bitmap.naturalHeight;
    if(!width||!height)return file;
    const scale=Math.min(1,maxSide/Math.max(width,height));
    const targetWidth=Math.max(1,Math.round(width*scale));
    const targetHeight=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');
    canvas.width=targetWidth;
    canvas.height=targetHeight;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,targetWidth,targetHeight);
    ctx.drawImage(bitmap,0,0,targetWidth,targetHeight);
    if(bitmap.close)bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
    if(!blob)return file;
    if(originalSize&&blob.size>=originalSize*0.92)return file;
    const baseName=(file.name||'recu').replace(/\.[^.]+$/,'');
    return new File([blob],baseName+'-optimise.jpg',{type:'image/jpeg',lastModified:Date.now()});
  }catch(e){
    console.warn('Compression recu indisponible, fichier original conserve',e);
    return file;
  }
}
window.__notesfraisCompressReceiptImageForTest=compressReceiptImageForTest;
`;
    html = html.replace('function AddModal({onClose,onAdd,month}){', helper + '\nfunction AddModal({onClose,onAdd,month}){');

    html = html.replace(
      `  const handleFile=f=>{
    if(!f)return;
    setFile(f);
    if(f.type.startsWith('image/')){
      const r=new FileReader();
      r.onload=e=>{setPreview(e.target.result);runOCR(f);};
      r.readAsDataURL(f);
    }else{setPreview('pdf');}
  };`,
      `  const handleFile=async f=>{
    if(!f)return;
    const original=f;
    const prepared=await compressReceiptImageForTest(f);
    setFile(prepared);
    if(prepared.type.startsWith('image/')){
      const r=new FileReader();
      r.onload=e=>{setPreview(e.target.result);runOCR(prepared);};
      r.readAsDataURL(prepared);
      if(original.size&&prepared.size&&prepared.size<original.size){
        setOcrStatus(null);
        console.info('Recu optimise',Math.round(original.size/1024)+'KB -> '+Math.round(prepared.size/1024)+'KB');
      }
    }else{setPreview('pdf');}
  };`
    );

    return html;
  };
})();
