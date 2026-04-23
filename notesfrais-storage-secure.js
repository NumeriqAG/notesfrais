(function(){
  const basePatch=window.patchNotesFrais;
  window.patchNotesFrais=function(html){
    html=basePatch?basePatch(html):html;
    if(html.includes('getSignedReceiptUrl('))return html;

    html=html.replace(/async function deleteById[\s\S]*?function nr\(r\)\{return\{[\s\S]*?\};\}/, `async function deleteById(id,receiptPath){
  const path=extractReceiptPath(receiptPath);
  if(path)await sb.storage.from('receipts').remove([path]);
  const{error}=await sb.from('expenses').delete().eq('id',id);
  if(error)throw error;
}
function extractReceiptPath(value){
  if(!value)return null;
  if(value.startsWith('http')){
    const marker='/receipts/';
    const idx=value.indexOf(marker);
    if(idx>=0)return decodeURIComponent(value.slice(idx+marker.length).split('?')[0]);
    return null;
  }
  return value;
}
async function getSignedReceiptUrl(receiptPath,download=false,receiptName='justificatif'){
  const path=extractReceiptPath(receiptPath);
  if(!path)return null;
  const options=download?{download:receiptName}:undefined;
  const{data,error}=await sb.storage.from('receipts').createSignedUrl(path,300,options);
  if(error)throw error;
  return data.signedUrl;
}
async function uploadReceipt(file){
  const ext=file.name.split('.').pop();
  const name=\`${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}\`;
  const{error}=await sb.storage.from('receipts').upload(name,file,{contentType:file.type});
  if(error)throw error;
  return{path:name,name:file.name};
}
function tr(e){return{date:e.date,merchant:e.merchant,amount:e.amount,amount_chf:e.amountCHF||e.amount,tva:e.tva||0,category:e.category||'autre',currency:e.currency||'CHF',status:e.status||'pending',note:e.note||'',ubs_label:e.ubsRow?.label||'',ubs_date:e.ubsRow?.date||null,amt_diff:e.amtDiff||0,receipt_url:e.receiptPath||extractReceiptPath(e.receiptUrl)||null,receipt_name:e.receiptName||null};}
function nr(r){const receiptPath=extractReceiptPath(r.receipt_url||null);return{id:r.id,date:r.date,merchant:r.merchant,amount:parseFloat(r.amount),amountCHF:parseFloat(r.amount_chf),tva:parseFloat(r.tva||0),category:r.category,currency:r.currency,status:r.status,note:r.note||'',ubsRow:r.ubs_label?{label:r.ubs_label,date:r.ubs_date}:null,amtDiff:parseFloat(r.amt_diff||0),receiptPath,receiptUrl:receiptPath,receiptName:r.receipt_name||null};}`);

    html=html.replace(/function ReceiptViewer\(\{url,name,onClose\}\)\{[\s\S]*?\n\}\n\nfunction Thumb\(\{url,name,onView\}\)\{[\s\S]*?\n\}/, `function ReceiptViewer({path,name,onClose}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const [url,setUrl]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{
    let live=true;
    const load=async()=>{
      try{
        setLoading(true);setError('');
        const signedUrl=await getSignedReceiptUrl(path,false,name);
        if(live)setUrl(signedUrl);
      }catch(e){if(live)setError('Impossible d\\'ouvrir le justificatif.');}
      finally{if(live)setLoading(false);}
    };
    load();
    return()=>{live=false;};
  },[path,name]);
  const downloadFile=async()=>{
    try{
      const downloadUrl=await getSignedReceiptUrl(path,true,name||'justificatif');
      const a=document.createElement('a');
      a.href=downloadUrl;
      a.rel='noreferrer';
      a.click();
    }catch(e){setError('Impossible de télécharger le justificatif.');}
  };
  const openFile=async()=>{
    try{
      const openUrl=url||await getSignedReceiptUrl(path,false,name);
      window.open(openUrl,'_blank','noopener,noreferrer');
    }catch(e){setError('Impossible d\\'ouvrir le justificatif.');}
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',zIndex:3000,padding:isMobile?10:20}}>
      <div style={{width:'100%',maxWidth:640,background:'#fff',borderRadius:16,overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,0.5)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:isMobile?'flex-start':'center',flexDirection:isMobile?'column':'row',gap:isMobile?10:0,padding:'14px 18px',borderBottom:'0.5px solid var(--border)'}}>
          <div>
            <div style={{fontWeight:600,fontSize:14}}>Justificatif</div>
            <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{name}</div>
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',width:isMobile?'100%':'auto'}}>
            <button onClick={downloadFile} style={{...bS,fontSize:12,padding:'7px 12px'}}>⬇ Télécharger</button>
            <button onClick={openFile} style={{...bS,fontSize:12,padding:'7px 12px'}}>🔗 Ouvrir</button>
            <button onClick={onClose} style={{...bS,fontSize:18,lineHeight:1,padding:'6px 12px'}}>×</button>
          </div>
        </div>
        <div style={{maxHeight:'76vh',overflow:'auto',background:'#F5F3EF',display:'flex',alignItems:'center',justifyContent:'center',minHeight:300,padding:8}}>
          {loading?<div style={{fontSize:13,color:'var(--t3)'}}>Chargement sécurisé…</div>:error?<div style={{fontSize:13,color:'var(--red)'}}>{error}</div>:isPDF(url)?<iframe src={url} style={{width:'100%',height:'72vh',border:'none'}} title='justificatif'/>:<img src={url} alt='justificatif' style={{maxWidth:'100%',maxHeight:'72vh',objectFit:'contain',display:'block',borderRadius:8}}/>}
        </div>
      </div>
    </div>
  );
}

function Thumb({path,name,onView}){
  const [url,setUrl]=useState(null);
  useEffect(()=>{
    let live=true;
    const resolved=extractReceiptPath(path);
    if(!resolved||isPDF(resolved))return undefined;
    getSignedReceiptUrl(resolved,false,name).then(signedUrl=>{if(live)setUrl(signedUrl);}).catch(()=>{});
    return()=>{live=false;};
  },[path,name]);
  if(!path)return(
    <div title='Aucun justificatif' style={{width:40,height:40,borderRadius:8,background:'var(--s2)',border:'1.5px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,color:'var(--t3)'}}>📎</div>
  );
  const resolved=extractReceiptPath(path);
  return(
    <div onClick={onView} title={\`Voir: ${name}\`} style={{width:40,height:40,borderRadius:8,overflow:'hidden',border:'1.5px solid var(--accent)',cursor:'pointer',flexShrink:0,background:'var(--al)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
      {isPDF(resolved)?<span style={{fontSize:20}}>📄</span>:url?<img src={url} alt='thumb' style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:14,color:'var(--accent)'}}>…</span>}
    </div>
  );
}`);

    html=html.replace(`let receiptUrl=null,receiptName=null;
      if(file){const u=await uploadReceipt(file);receiptUrl=u.url;receiptName=u.name;}
      await onAdd({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptUrl,receiptName});`, `let receiptPath=null,receiptName=null;
      if(file){const u=await uploadReceipt(file);receiptPath=u.path;receiptName=u.name;}
      await onAdd({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptPath,receiptName});`);

    html=html.replace(`{viewer&&<ReceiptViewer url={viewer.url} name={viewer.name} onClose={()=>setViewer(null)}/>`, `{viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>');
    html=html.replace(/fil\.filter\(e=>e\.receiptUrl\)\.length/g, `fil.filter(e=>e.receiptPath||e.receiptUrl).length`);
    html=html.replace(`const deleteExpense=useCallback(async(id,receiptUrl)=>{try{await deleteById(id,receiptUrl);`, `const deleteExpense=useCallback(async(id,receiptPath)=>{try{await deleteById(id,receiptPath);`);
    html=html.replace(/url=\{e\.receiptUrl\}/g, `path={e.receiptPath||e.receiptUrl}`);
    html=html.replace(/onView=\{e\.receiptUrl\?\(\)=>setViewer\(\{url:e\.receiptUrl,name:e\.receiptName\|\|'justificatif'\}\):null\}/g, `onView={(e.receiptPath||e.receiptUrl)?()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'}):null}`);
    html=html.replace(/\{e\.receiptUrl&&<a href=\{e\.receiptUrl\} download=\{e\.receiptName\|\|'justificatif'\} title="Télécharger le justificatif" style=\{\{color:'var\(--accent\)',fontSize:15,textDecoration:'none',padding:2,lineHeight:1\}\} onClick=\{ev=>ev\.stopPropagation\(\)\}>⬇<\/a>\}/g, `{(e.receiptPath||e.receiptUrl)&&<button onClick={()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'})} title="Voir le justificatif" style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:15,padding:2,lineHeight:1}}>👁</button>}`);
    html=html.replace(/deleteExpense\(e\.id,e\.receiptUrl\)/g, `deleteExpense(e.id,e.receiptPath||e.receiptUrl)`);
    html=html.replace(`{viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>'`, `{viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>');
    return html;
  };
})();
