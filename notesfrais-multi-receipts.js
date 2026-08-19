(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('NOTESFRAIS_MULTI_RECEIPTS_V1')) return html;

    const helper = String.raw`
const NOTESFRAIS_MULTI_RECEIPTS_V1=true;
function normalizeReceiptItems(value){
  let raw=value;
  if(typeof raw==='string'){
    try{raw=JSON.parse(raw);}catch(_e){raw=[];}
  }
  if(!Array.isArray(raw))raw=[];
  return raw.map(item=>({path:String((item&&(item.path||item.url||item.receiptPath||item.receipt_url))||'').trim(),name:String((item&&(item.name||item.receiptName||item.receipt_name))||'justificatif').trim()||'justificatif'})).filter(item=>item.path);
}
function receiptItemsForExpense(expense){
  const items=normalizeReceiptItems(expense&&expense.receiptItems);
  const fallback=expense&&(expense.receiptPath||expense.receiptUrl)?[{path:expense.receiptPath||expense.receiptUrl,name:expense.receiptName||'justificatif'}]:[];
  const seen=new Set();
  return [...items,...fallback].filter(item=>{
    const key=item.path;
    if(!key||seen.has(key))return false;
    seen.add(key);
    return true;
  });
}
function primaryReceiptItem(expense){
  return receiptItemsForExpense(expense)[0]||null;
}
function receiptPayloadFromItems(items){
  const clean=normalizeReceiptItems(items);
  const first=clean[0]||null;
  return {receipt_items:clean,receipt_url:first?first.path:'',receipt_name:first?first.name:''};
}
function ReceiptThumbs({expense,setViewer}){
  const items=receiptItemsForExpense(expense);
  if(items.length===0)return <Thumb path="" name="receipt" onView={null}/>;
  return <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
    {items.map((item,index)=><div key={item.path} style={{position:'relative'}}>
      <Thumb path={item.path} name={item.name||('receipt '+(index+1))} onView={()=>setViewer&&setViewer({path:item.path,name:item.name||('receipt '+(index+1))})}/>
      {items.length>1&&<span style={{position:'absolute',left:-5,top:-5,minWidth:18,height:18,padding:'0 4px',borderRadius:999,background:'#111',color:'#fff',border:'1px solid #fff',fontSize:10,fontWeight:900,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{index+1}</span>}
    </div>)}
  </div>;
}
function MultiReceiptEditor({items,setItems,setViewer,setRemovedPaths,newFiles,setNewFiles,isMobile}){
  const removeExisting=(index)=>{
    setItems(prev=>{
      const next=[...prev];
      const [removed]=next.splice(index,1);
      if(removed&&removed.path)setRemovedPaths(paths=>paths.includes(removed.path)?paths:[...paths,removed.path]);
      return next;
    });
  };
  const removeNew=(index)=>setNewFiles(prev=>prev.filter((_file,i)=>i!==index));
  return <div style={{display:'grid',gap:10}}>
    <div style={{display:'grid',gap:8}}>
      {items.length===0&&newFiles.length===0?<div style={{border:'0.5px dashed var(--border)',borderRadius:12,padding:14,background:'var(--bg)',fontSize:13,color:'var(--t3)'}}>No receipt attached.</div>:null}
      {items.map((item,index)=><div key={item.path} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',border:'0.5px solid var(--border)',borderRadius:12,padding:10,background:'#fff'}}>
        <div style={{display:'flex',gap:10,alignItems:'center',minWidth:0}}><Thumb path={item.path} name={item.name||'receipt'} onView={()=>setViewer&&setViewer({path:item.path,name:item.name||'receipt'})}/><div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:900}}>Receipt {index+1}</div><div style={{fontSize:12,color:'var(--t3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:isMobile?'210px':'320px'}}>{item.name||item.path}</div></div></div>
        <button type="button" onClick={()=>removeExisting(index)} style={{...bS,color:'var(--red)',borderColor:'#F3C6C6',padding:'8px 10px',fontSize:12}}>Delete</button>
      </div>)}
      {newFiles.map((file,index)=><div key={file.name+'-'+index} style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',border:'0.5px solid #BDEAD9',borderRadius:12,padding:10,background:'var(--gl)'}}>
        <div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:900,color:'var(--green)'}}>New receipt</div><div style={{fontSize:12,color:'var(--t3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:isMobile?'230px':'360px'}}>{file.name}</div></div>
        <button type="button" onClick={()=>removeNew(index)} style={{...bS,padding:'8px 10px',fontSize:12}}>Remove</button>
      </div>)}
    </div>
    <label style={{...bS,justifyContent:'center',cursor:'pointer',width:isMobile?'100%':'auto'}}><input type="file" multiple accept="image/*,application/pdf,.pdf" onChange={e=>{const files=[...(e.target.files||[])];setNewFiles(prev=>[...prev,...files]);e.target.value='';}} style={{display:'none'}}/>+ Add receipt(s)</label>
  </div>;
}
`;

    if(!html.includes('function normalizeReceiptItems(value)')){
      html = html.replace(/function fwFinanceReceiptValue\(e\)\{/, helper + '\nfunction fwFinanceReceiptValue(e){');
    }

    html = html.replace('function tr(e){return{date:e.date,merchant:e.merchant,amount:e.amount,amount_chf:e.amountCHF||e.amount,tva:e.tva||0,category:e.category||\'autre\',currency:e.currency||\'CHF\',status:e.status||\'pending\',note:e.note||\'\',ubs_label:e.ubsRow?.label||\'\',ubs_date:e.ubsRow?.date||null,amt_diff:e.amtDiff||0,receipt_url:e.receiptPath||extractReceiptPath(e.receiptUrl)||null,receipt_name:e.receiptName||null};}', "function tr(e){const receipts=receiptItemsForExpense(e);const first=receipts[0]||null;return{date:e.date,merchant:e.merchant,amount:e.amount,amount_chf:e.amountCHF||e.amount,tva:e.tva||0,category:e.category||'autre',currency:e.currency||'CHF',status:e.status||'pending',note:e.note||'',ubs_label:e.ubsRow?.label||'',ubs_date:e.ubsRow?.date||null,amt_diff:e.amtDiff||0,receipt_url:first?first.path:null,receipt_name:first?first.name:null,receipt_items:receipts};}");
    html = html.replace(/function nr\(r\)\{const receiptPath=extractReceiptPath\(r\.receipt_url\|\|null\);return\{id:r\.id,date:r\.date,merchant:r\.merchant,amount:parseFloat\(r\.amount\),amountCHF:parseFloat\(r\.amount_chf\),tva:parseFloat\(r\.tva\|\|0\),category:r\.category,currency:r\.currency,status:r\.status,note:r\.note\|\|'',ubsRow:r\.ubs_label\?\{label:r\.ubs_label,date:r\.ubs_date\}:null,amtDiff:parseFloat\(r\.amt_diff\|\|0\),receiptPath,receiptUrl:receiptPath,receiptName:r\.receipt_name\|\|null\};\}/, "function nr(r){const receiptPath=extractReceiptPath(r.receipt_url||null);const receiptItems=normalizeReceiptItems(r.receipt_items);const items=receiptItems.length?receiptItems:(receiptPath?[{path:receiptPath,name:r.receipt_name||'justificatif'}]:[]);const first=items[0]||null;return{id:r.id,date:r.date,merchant:r.merchant,amount:parseFloat(r.amount),amountCHF:parseFloat(r.amount_chf),tva:parseFloat(r.tva||0),category:r.category,currency:r.currency,status:r.status,note:r.note||'',ubsRow:r.ubs_label?{label:r.ubs_label,date:r.ubs_date}:null,amtDiff:parseFloat(r.amt_diff||0),receiptPath:first?first.path:null,receiptUrl:first?first.path:null,receiptName:first?first.name:null,receiptItems:items,submissionStatus:r.submission_status||'pending',submittedAt:r.submitted_at||null};}");
    html = html.replace(
      "receiptName:r.receipt_name||null,submissionStatus:r.submission_status||'pending',submittedAt:r.submitted_at||null};}",
      "receiptItems:normalizeReceiptItems(r.receipt_items),receiptName:r.receipt_name||null,submissionStatus:r.submission_status||'pending',submittedAt:r.submitted_at||null};}"
    );

    html = html.replace(/function fwFinanceReceiptValue\(e\)\{return e\.receiptPath\|\|e\.receiptUrl\|\|'';\}/, "function fwFinanceReceiptItems(e){return receiptItemsForExpense(e);}function fwFinanceReceiptValue(e){const first=fwFinanceReceiptItems(e)[0];return first?first.path:'';}function fwFinanceReceiptName(e){const first=fwFinanceReceiptItems(e)[0];return first?first.name:(e.receiptName||'receipt');}function fwFinanceReceiptCount(e){return fwFinanceReceiptItems(e).length;}");
    html = html.replace(/const receiptCount=fil\.filter\(e=>fwFinanceReceiptValue\(e\)\)\.length;/g, "const receiptCount=fil.reduce((sum,e)=>sum+fwFinanceReceiptCount(e),0);");
    html = html.replace(/const periodReceiptCount=mE\.filter\(e=>fwFinanceReceiptValue\(e\)\)\.length;/g, "const periodReceiptCount=mE.reduce((sum,e)=>sum+fwFinanceReceiptCount(e),0);");
    html = html.replace(/const receipts=list\.filter\(e=>fwFinanceReceiptValue\(e\)\)\.length;/g, "const receipts=list.reduce((sum,e)=>sum+fwFinanceReceiptCount(e),0);");
    html = html.replace(/<Thumb path=\{fwFinanceReceiptValue\(e\)\} name=\{e\.receiptName\|\|'receipt'\} onView=\{fwFinanceReceiptValue\(e\)\?\(\)=>setViewer\(\{path:fwFinanceReceiptValue\(e\),name:e\.receiptName\|\|'receipt'\}\):null\}\/>/g, "<ReceiptThumbs expense={e} setViewer={setViewer}/>");

    const editModal = String.raw`function FinanceEditExpenseModal({expense,onClose,onSaved,setViewer}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const [form,setForm]=useState(()=>({
    date:fwFinanceDateInputValue(expense.date),
    merchant:expense.merchant||'',
    amount:String(Number(expense.amountCHF||expense.amount||0).toFixed(2)),
    tva:String(Number(expense.tva||0).toFixed(2)),
    category:expense.category||'autre',
    status:expense.status||'pending',
    note:typeof cleanPaymentCardNote==='function'?cleanPaymentCardNote(expense.note):expense.note||''
  }));
  const [receiptItems,setReceiptItems]=useState(()=>receiptItemsForExpense(expense));
  const [newFiles,setNewFiles]=useState([]);
  const [removedPaths,setRemovedPaths]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const setField=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const save=async()=>{
    if(!form.date||!form.merchant.trim()){setError('Date and merchant are required.');return;}
    const amount=Number(form.amount);
    const vat=Number(form.tva||0);
    if(!Number.isFinite(amount)||amount<0){setError('Amount is invalid.');return;}
    setBusy(true);setError('');
    try{
      const uploaded=[];
      for(const file of newFiles){
        const out=await uploadReceipt(file);
        uploaded.push({path:out.path||out.url,name:out.name||file.name});
      }
      const nextReceipts=normalizeReceiptItems([...receiptItems,...uploaded]);
      const receiptPayload=receiptPayloadFromItems(nextReceipts);
      const updated=await fwUpdateFinanceExpense(expense.id,{
        date:form.date,
        merchant:form.merchant.trim(),
        amount:amount,
        amount_chf:amount,
        tva:Number.isFinite(vat)?vat:0,
        category:form.category,
        status:form.status,
        note:form.note||'',
        ...receiptPayload
      });
      if(removedPaths.length>0){
        await sb.storage.from('receipts').remove(removedPaths).catch(()=>{});
      }
      onSaved&&onSaved({...updated,receiptItems:nextReceipts,receiptPath:nextReceipts[0]?nextReceipts[0].path:null,receiptUrl:nextReceipts[0]?nextReceipts[0].path:null,receiptName:nextReceipts[0]?nextReceipts[0].name:null});
      onClose&&onClose();
    }catch(err){
      setError(err.message||String(err));
    }finally{
      setBusy(false);
    }
  };
  return <div style={{position:'fixed',inset:0,background:'rgba(10,16,32,0.45)',zIndex:2600,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',padding:isMobile?0:20}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:isMobile?'18px 18px 0 0':18,width:isMobile?'100%':560,maxHeight:isMobile?'88dvh':'calc(100dvh - 60px)',overflowY:'auto',boxShadow:'0 24px 80px rgba(10,16,32,0.22)',padding:isMobile?18:22}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:900}}>Edit expense</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>Finance can correct the record and manage several receipts.</div></div>
        <button onClick={onClose} style={{...bS,width:38,height:38,padding:0,justifyContent:'center'}}>x</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12}}>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Date<input type="date" value={form.date} onChange={e=>setField('date',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Amount CHF<input type="number" step="0.01" value={form.amount} onChange={e=>setField('amount',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Merchant<input value={form.merchant} onChange={e=>setField('merchant',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>VAT CHF<input type="number" step="0.01" value={form.tva} onChange={e=>setField('tva',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Status<select value={form.status} onChange={e=>setField('status',e.target.value)} style={{...inp,fontSize:isMobile?16:14,background:'#fff'}}><option value="pending">Pending</option><option value="reconciled">Reconciled</option></select></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Category<select value={form.category} onChange={e=>setField('category',e.target.value)} style={{...inp,fontSize:isMobile?16:14,background:'#fff'}}>{CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <div style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:8}}>
          <div style={{fontSize:12,fontWeight:800,color:'var(--t2)'}}>Receipts</div>
          <MultiReceiptEditor items={receiptItems} setItems={setReceiptItems} setViewer={setViewer} setRemovedPaths={setRemovedPaths} newFiles={newFiles} setNewFiles={setNewFiles} isMobile={isMobile}/>
        </div>
        <label style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Note<textarea value={form.note} onChange={e=>setField('note',e.target.value)} rows={3} style={{...inp,fontSize:isMobile?16:14,resize:'vertical'}}/></label>
      </div>
      {error&&<div style={{marginTop:12,background:'var(--rl)',color:'var(--red)',borderRadius:12,padding:10,fontSize:12,fontWeight:800}}>{error}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18,flexDirection:isMobile?'column-reverse':'row'}}><button onClick={onClose} style={{...bS,justifyContent:'center'}}>Cancel</button><button disabled={busy} onClick={save} style={{...bP,justifyContent:'center',opacity:busy?0.65:1}}>{busy?'Saving...':'Save changes'}</button></div>
    </div>
  </div>;
}
`;
    html = html.replace(/function FinanceEditExpenseModal\([\s\S]*?\n\}\nfunction FinanceExpensesTab/, editModal + '\nfunction FinanceExpensesTab');

    const zipFunction = String.raw`async function downloadFinanceReceiptsZip(expenses,label,setBusy){
  const receiptRows=(expenses||[]).flatMap(expense=>receiptItemsForExpense(expense).map((receipt,receiptIndex)=>({expense,receipt,receiptIndex})));
  if(receiptRows.length===0)return;
  setBusy(true);
  try{
    const JSZip=await ensureNotesFraisZip();
    const zip=new JSZip();
    const failures=[];
    for(let i=0;i<receiptRows.length;i++){
      const {expense:e,receipt,receiptIndex}=receiptRows[i];
      try{
        const value=receipt.path;
        const path=typeof extractReceiptPath==='function'?extractReceiptPath(value):(!/^https?:\/\//i.test(String(value||''))?value:null);
        const url=path?('/api/receipts?raw=1&path='+encodeURIComponent(path)+'&name='+encodeURIComponent(receipt.name||'justificatif')):(/^https?:\/\//i.test(String(value||''))?value:null);
        if(!url)throw new Error('Chemin de recu non recuperable');
        const res=await fetch(url);
        if(!res.ok)throw new Error('HTTP '+res.status);
        const blob=await res.blob();
        const ext=receiptExtension({receiptName:receipt.name,receiptPath:receipt.path});
        const name=[String(i+1).padStart(2,'0'),zipReceiptDate(e.date),safeZipPart(e.merchant),'recu-'+String(receiptIndex+1),zipReceiptBaseName(receipt.name||'recu')].filter(Boolean).join('_')+'.'+ext;
        zip.file(name,blob);
      }catch(err){
        failures.push((e.date||'date')+' - '+(e.merchant||receipt.name||('recu '+(i+1)))+' - '+(err.message||err));
      }
    }
    if(Object.keys(zip.files).length===0){
      zip.file('_A_LIRE_erreurs.txt','Aucun justificatif telechargeable pour cette periode.\n\n'+failures.join('\n'));
    }else if(failures.length>0){
      zip.file('_A_LIRE_erreurs.txt','Justificatifs non recuperes:\n'+failures.join('\n'));
    }
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
}`;
    html = html.replace(/async function downloadFinanceReceiptsZip\(expenses,label,setBusy\)\{[\s\S]*?\n\}/, zipFunction);

    return html;
  };
})();
