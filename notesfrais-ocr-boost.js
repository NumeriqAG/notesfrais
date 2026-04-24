(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('function preprocessReceiptImage(')) return html;

    const boosted = String.raw`
  function normalizeOCRAmount(raw){
    if(!raw)return NaN;
    let s=String(raw).replace(/CHF|SFR|EUR|TOTAL|MONTANT|TVA/gi,'').replace(/\s/g,'').replace(/'/g,'');
    s=s.replace(/[Oo]/g,'0').replace(/[Il]/g,'1');
    if(/,\d{2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');
    return parseFloat(s);
  }
  function preprocessReceiptImage(file){
    return new Promise((resolve,reject)=>{
      const img=new Image();
      img.onload=()=>{
        const maxW=1800;
        const scale=Math.min(1,maxW/img.width);
        const w=Math.round(img.width*scale),h=Math.round(img.height*scale);
        const canvas=document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
        ctx.drawImage(img,0,0,w,h);
        const image=ctx.getImageData(0,0,w,h);
        const d=image.data;
        let sum=0;
        for(let i=0;i<d.length;i+=4){
          const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
          sum+=gray;
        }
        const avg=sum/(d.length/4);
        const threshold=Math.max(118,Math.min(188,avg*0.86));
        for(let i=0;i<d.length;i+=4){
          let gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
          gray=(gray-128)*1.35+128;
          const v=gray<threshold?0:255;
          d[i]=d[i+1]=d[i+2]=v;
        }
        ctx.putImageData(image,0,0);
        canvas.toBlob(blob=>resolve(blob||file),'image/png',0.92);
      };
      img.onerror=()=>reject(new Error('Image illisible'));
      const r=new FileReader();
      r.onload=e=>{img.src=e.target.result;};
      r.onerror=()=>reject(r.error);
      r.readAsDataURL(file);
    });
  }
  function extractReceiptFields(text){
    const rawLines=text.split('\n').map(l=>l.trim()).filter(Boolean);
    const lines=rawLines.map(l=>l.replace(/\s+/g,' ')).filter(l=>l.length>1);
    const usefulLines=lines.filter(l=>!/(merci|thank|visa|mastercard|twint|terminal|transaction|autorisation|carte|ref|heure|tel|www|CHE-|UID|TVA\s*No)/i.test(l));
    const amounts=[];
    const money=/(\d{1,4}(?:[ '\u00a0]?\d{3})*[.,]\d{2})/g;
    lines.forEach((line,idx)=>{
      let m;
      while((m=money.exec(line))!==null){
        const value=normalizeOCRAmount(m[1]);
        if(!isNaN(value)&&value>0&&value<10000){
          const label=/total|montant|betrag|summe|à payer|a payer|payé|paye|chf/i.test(line);
          const tax=/tva|mwst|vat/i.test(line);
          amounts.push({value,line,idx,score:(label?100:0)+(tax?-60:0)+idx});
        }
      }
    });
    const total=(amounts.filter(a=>a.score>=80).sort((a,b)=>b.score-a.score||b.value-a.value)[0]||amounts.sort((a,b)=>b.value-a.value)[0])?.value||null;
    const taxLine=amounts.filter(a=>/tva|mwst|vat/i.test(a.line)).sort((a,b)=>b.value-a.value)[0];
    const tva=taxLine&&total&&taxLine.value<total?taxLine.value:null;
    let extractedDate=null;
    const dateLine=lines.find(l=>(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/).test(l));
    const dateMatch=dateLine&&dateLine.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if(dateMatch){
      const d=dateMatch[1].padStart(2,'0'),mo=dateMatch[2].padStart(2,'0');
      let y=dateMatch[3];if(y.length===2)y='20'+y;
      const candidate=y+'-'+mo+'-'+d;
      const dt=new Date(candidate);
      if(!isNaN(dt.getTime())&&dt.getFullYear()>=2020&&dt.getFullYear()<=2035)extractedDate=candidate;
    }
    const merchant=(usefulLines.find(l=>/[A-Za-zÀ-ÿ]{3}/.test(l)&&!/^[0-9]/.test(l)&&!money.test(l))||usefulLines[0]||'').replace(/[^A-Za-zÀ-ÿ0-9 '&.-]/g,'').substring(0,50);
    return{merchant,total,tva,date:extractedDate};
  }
  const runOCR=async(imgFile)=>{
    if(!imgFile.type.startsWith('image/'))return;
    setOcrStatus('scanning');setOcrProgress(0);
    try{
      if(!window.Tesseract){
        await new Promise((resolve,reject)=>{
          const s=document.createElement('script');
          s.src='https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
          s.onload=resolve;s.onerror=reject;
          document.head.appendChild(s);
        });
      }
      const prepared=await preprocessReceiptImage(imgFile);
      const result=await window.Tesseract.recognize(prepared,'fra+eng',{
        logger:m=>{if(m.status==='recognizing text')setOcrProgress(Math.round(m.progress*100));},
        tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÂÄÇÉÈÊËÎÏÔÖÙÛÜàâäçéèêëîïôöùûü0123456789.,:/- CHFchfTOTALtotalTVAtvaMWSTmwst '
      });
      const fields=extractReceiptFields(result.data.text||'');
      setForm(f=>({...f,merchant:fields.merchant||f.merchant,amount:fields.total?fields.total.toFixed(2):f.amount,tva:fields.tva?fields.tva.toFixed(2):f.tva,date:fields.date||f.date}));
      setOcrStatus('done');
    }catch(e){console.error('OCR error:',e);setOcrStatus('error');}
  };
`;

    html = html.replace(/  const runOCR=async\(imgFile\)=>\{[\s\S]*?\n  \};\n\n  const handleFile=f=>\{/, boosted + '\n\n  const handleFile=f=>{');
    return html;
  };
})();
