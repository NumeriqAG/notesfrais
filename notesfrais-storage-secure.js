(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('function extractReceiptPath(')) return html;

    html = html.replace(/async function deleteById\(id,receiptUrl\)\{[\s\S]*?function nr\(r\)\{return\{[\s\S]*?\};\}/, `function extractReceiptPath(value){
  if(!value)return null;
  if(value.startsWith('http')){
    const marker='/receipts/';
    const idx=value.indexOf(marker);
    if(idx<0)return null;
    return decodeURIComponent(value.slice(idx+marker.length).split('?')[0]);
  }
  return value;
}
async function getReceiptUrl(value,download=false,name='justificatif'){
  const path=extractReceiptPath(value);
  if(!path)return null;
  const options=download?{download:name}:undefined;
  const{data,error}=await sb.storage.from('receipts').createSignedUrl(path,300,options);
  if(error)throw error;
  return data.signedUrl;
}
async function deleteById(id,receiptValue){
  const path=extractReceiptPath(receiptValue);
  if(path)await sb.storage.from('receipts').remove([path]);
  const{error}=await sb.from('expenses').delete().eq('id',id);
  if(error)throw error;
}
async function uploadReceipt(file){
  const ext=file.name.split('.').pop();
  const name=Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
  const{error}=await sb.storage.from('receipts').upload(name,file,{contentType:file.type});
  if(error)throw error;
  return{path:name,name:file.name};
}
function tr(e){return{date:e.date,merchant:e.merchant,amount:e.amount,amount_chf:e.amountCHF||e.amount,tva:e.tva||0,category:e.category||'autre',currency:e.currency||'CHF',status:e.status||'pending',note:e.note||'',ubs_label:e.ubsRow?.label||'',ubs_date:e.ubsRow?.date||null,amt_diff:e.amtDiff||0,receipt_url:e.receiptPath||extractReceiptPath(e.receiptUrl)||null,receipt_name:e.receiptName||null};}
function nr(r){const receiptPath=extractReceiptPath(r.receipt_url||null);return{id:r.id,date:r.date,merchant:r.merchant,amount:parseFloat(r.amount),amountCHF:parseFloat(r.amount_chf),tva:parseFloat(r.tva||0),category:r.category,currency:r.currency,status:r.status,note:r.note||'',ubsRow:r.ubs_label?{label:r.ubs_label,date:r.ubs_date}:null,amtDiff:parseFloat(r.amt_diff||0),receiptPath,receiptUrl:receiptPath,receiptName:r.receipt_name||null};}`);

    html = html.replace(/function ReceiptViewer\(\{url,name,onClose\}\)\{[\s\S]*?function AddModal/, `function ReceiptViewer({path,name,onClose}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const [url,setUrl]=useState(null);
  const [downloadUrl,setDownloadUrl]=useState(null);
  const [err,setErr]=useState('');
  useEffect(()=>{
    let live=true;
    setUrl(null);setDownloadUrl(null);setErr('');
    Promise.all([getReceiptUrl(path,false,name),getReceiptUrl(path,true,name)])
      .then(([view,download])=>{if(live){setUrl(view);setDownloadUrl(download);}})
      .catch(()=>{if(live)setErr("Impossible de charger le justificatif.");});
    return()=>{live=false;};
  },[path,name]);
  const stop=e=>e.stopPropagation();
  return(
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(10,10,10,0.88)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:5200,padding:isMobile?8:18}}>
      <div onClick={stop} style={{width:'100%',height:isMobile?'96dvh':'92vh',maxWidth:980,background:'#fff',borderRadius:isMobile?14:18,overflow:'hidden',boxShadow:'0 24px 80px rgba(0,0,0,0.5)',display:'grid',gridTemplateRows:'auto 1fr'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,padding:isMobile?'10px 12px':'12px 16px',borderBottom:'0.5px solid var(--border)',background:'#fff'}}>
          <div style={{minWidth:0}}><div style={{fontWeight:800,fontSize:14}}>Justificatif</div><div style={{fontSize:11,color:'var(--t3)',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{name||'justificatif'}</div></div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
            {downloadUrl&&<a href={downloadUrl} download={name||'justificatif'} style={{...bS,textDecoration:'none',fontSize:12,padding:isMobile?'9px 10px':'8px 12px'}}>Télécharger</a>}
            <button onClick={onClose} aria-label="Fermer le justificatif" style={{border:0,background:'#111',color:'#fff',borderRadius:12,width:42,height:42,fontSize:22,lineHeight:1,cursor:'pointer'}}>×</button>
          </div>
        </div>
        <div style={{background:'#F5F3EF',minHeight:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
          {err?<div style={{fontSize:13,color:'var(--red)',padding:20,textAlign:'center'}}>{err}</div>:!url?<div style={{fontSize:13,color:'var(--t3)'}}>Chargement sécurisé...</div>:isPDF(path)?<iframe src={url+'#toolbar=0&navpanes=0'} style={{width:'100%',height:'100%',border:'none',background:'#fff'}} title="justificatif"/>:<div style={{width:'100%',height:'100%',overflow:'auto',display:'flex',alignItems:'center',justifyContent:'center',padding:isMobile?8:14}}><img src={url} alt="justificatif" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',display:'block',borderRadius:8,boxShadow:'0 10px 28px rgba(0,0,0,.18)'}}/></div>}
        </div>
      </div>
    </div>
  );
}

function Thumb({path,name,onView}){
  const [url,setUrl]=useState(null);
  useEffect(()=>{
    let live=true;
    if(path&&!isPDF(path))getReceiptUrl(path,false,name).then(u=>{if(live)setUrl(u);}).catch(()=>{});
    return()=>{live=false;};
  },[path,name]);
  if(!path)return(<div title="Aucun justificatif" style={{width:46,height:46,borderRadius:10,background:'var(--s2)',border:'1.5px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,color:'var(--t3)'}}>📎</div>);
  return(
    <button type="button" onClick={onView} title={'Voir: '+name} style={{width:46,height:46,borderRadius:10,overflow:'hidden',border:'1.5px solid var(--accent)',cursor:'pointer',flexShrink:0,background:'var(--al)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',padding:0}}>
      {isPDF(path)?<span style={{fontSize:11,fontWeight:900,color:'var(--accent)'}}>PDF</span>:url?<img src={url} alt="thumb" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:12,color:'var(--accent)',fontWeight:800}}>Voir</span>}
      <span style={{position:'absolute',right:2,bottom:2,background:'rgba(17,17,17,.72)',color:'#fff',borderRadius:6,padding:'1px 4px',fontSize:9,fontWeight:800}}>View</span>
    </button>
  );
}

function AddModal`);

    html = html.replace(`let receiptUrl=null,receiptName=null;
      if(file){const u=await uploadReceipt(file);receiptUrl=u.url;receiptName=u.name;}
      await onAdd({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptUrl,receiptName});`, `let receiptPath=null,receiptName=null;
      if(file){const u=await uploadReceipt(file);receiptPath=u.path;receiptName=u.name;}
      await onAdd({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptPath,receiptName});`);

    html = html.replace(`const deleteExpense=useCallback(async(id,receiptUrl)=>{try{await deleteById(id,receiptUrl);`, `const deleteExpense=useCallback(async(id,receiptPath)=>{try{await deleteById(id,receiptPath);`);
    html = html.replace(/\{viewer&&<ReceiptViewer url=\{viewer\.url\} name=\{viewer\.name\} onClose=\{\(\)=>setViewer\(null\)\}\/\>\}/g, `{viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>}`);
    html = html.replace(/fil\.filter\(e=>e\.receiptUrl\)\.length/g, `fil.filter(e=>e.receiptPath||e.receiptUrl).length`);
    html = html.replace(/<Thumb url=\{e\.receiptUrl\} name=\{e\.receiptName\|\|'justificatif'\} onView=\{e\.receiptUrl\?\(\)=>setViewer\(\{url:e\.receiptUrl,name:e\.receiptName\|\|'justificatif'\}\):null\}\/\>/g, `<Thumb path={e.receiptPath||e.receiptUrl} name={e.receiptName||'justificatif'} onView={(e.receiptPath||e.receiptUrl)?()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'}):null}/>`);
    html = html.replace(/<Thumb url=\{e\.receiptUrl\} name=\{e\.receiptName\} onView=\{e\.receiptUrl\?\(\)=>setViewer\(\{url:e\.receiptUrl,name:e\.receiptName\|\|'justificatif'\}\):null\}\/\>/g, `<Thumb path={e.receiptPath||e.receiptUrl} name={e.receiptName} onView={(e.receiptPath||e.receiptUrl)?()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'}):null}/>`);
    html = html.replace(/\{e\.receiptUrl&&<a href=\{e\.receiptUrl\} download=\{e\.receiptName\|\|'justificatif'\} title="Télécharger le justificatif" style=\{\{color:'var\(--accent\)',fontSize:15,textDecoration:'none',padding:2,lineHeight:1\}\} onClick=\{ev=>ev\.stopPropagation\(\)\}>⬇<\/a>\}/g, `{(e.receiptPath||e.receiptUrl)&&<button onClick={()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||'justificatif'})} title="Voir le justificatif" style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:15,padding:2,lineHeight:1}}>Voir</button>}`);
    html = html.replace(/deleteExpense\(e\.id,e\.receiptUrl\)/g, `deleteExpense(e.id,e.receiptPath||e.receiptUrl)`);
    return html;
  };
})();
