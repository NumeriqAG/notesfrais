(function(){
  const basePatch=window.patchNotesFrais;
  window.patchNotesFrais=function(html){
    html=basePatch?basePatch(html):html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('NOTESFRAIS_USER_EDIT_V1'))return html;

    const component=String.raw`
const NOTESFRAIS_USER_EDIT_V1=true;
function userExpensePaymentCard(note){
  const value=String(note||'');
  const raw=(value.match(/(?:Carte utilisee|Card used|Payment card):\s*(entreprise|perso|company|personal)/i)||[])[1]||'';
  return /entreprise|company/i.test(raw)?'entreprise':/perso|personal/i.test(raw)?'perso':'';
}
function userExpenseMealWith(note,category){
  const value=String(note||'');
  const explicit=((value.match(/^(?:With|Avec):\s*(.+)$/im)||[])[1]||'').trim();
  if(explicit||category!=='repas')return explicit;
  return (value.split(/\n+/).map(line=>line.trim()).find(line=>
    line&&!/^(?:Carte utilisee|Card used|Payment card):/i.test(line)
  )||'').trim();
}
function userExpenseCleanNote(note,category){
  const mealWith=userExpenseMealWith(note,category);
  let removedLegacyMeal=false;
  return String(note||'').split(/\n+/).map(line=>line.trim()).filter(line=>{
    if(!line||/^(?:Carte utilisee|Card used|Payment card):/i.test(line)||/^(?:With|Avec):/i.test(line))return false;
    if(category==='repas'&&mealWith&&!removedLegacyMeal&&line===mealWith){removedLegacyMeal=true;return false;}
    return true;
  }).join('\n');
}
async function updateUserExpense(id,values){
  const {data,error}=await sb.from('expenses').update(values).eq('id',id);
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  return typeof nr==='function'?nr(row):row;
}
function UserReceiptPreview({expense,setViewer}){
  const items=receiptItemsForExpense(expense);
  const first=items[0]||null;
  if(!first)return <Thumb url="" path="" name="receipt" onView={null}/>;
  return <div className="nf-user-receipt-preview" title={items.length>1?items.length+' receipts':'1 receipt'}>
    <Thumb url={first.path} path={first.path} name={first.name||'receipt'} onView={()=>items.length>1?setViewer({items,index:0,name:(expense.merchant||'Receipts')}):setViewer({url:first.path,path:first.path,name:first.name||'receipt'})}/>
    {items.length>1&&<span className="nf-user-receipt-count">+{items.length-1}</span>}
  </div>;
}
function UserReceiptGallery({items,index=0,title,onClose}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const cleanItems=normalizeReceiptItems(items);
  const [current,setCurrent]=useState(Math.max(0,Math.min(Number(index)||0,cleanItems.length-1)));
  const item=cleanItems[current]||null;
  const [url,setUrl]=useState(null);
  const [downloadUrl,setDownloadUrl]=useState(null);
  const [err,setErr]=useState('');
  useEffect(()=>{
    let live=true;
    setUrl(null);setDownloadUrl(null);setErr('');
    if(!item){setErr('No receipt to display.');return()=>{live=false;};}
    Promise.all([getReceiptUrl(item.path,false,item.name),getReceiptUrl(item.path,true,item.name)])
      .then(([view,download])=>{if(live){setUrl(view);setDownloadUrl(download);}})
      .catch(()=>{if(live)setErr('Unable to load this receipt.');});
    return()=>{live=false;};
  },[item&&item.path,item&&item.name]);
  const go=delta=>setCurrent(prev=>(prev+delta+cleanItems.length)%cleanItems.length);
  const stop=e=>e.stopPropagation();
  return <div className="nf-user-gallery" onClick={onClose} style={{position:'fixed',inset:0,zIndex:6500,background:'rgba(0,0,0,.94)',display:'grid',gridTemplateRows:'auto 1fr auto'}}>
    <div onClick={stop} className="nf-user-gallery-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:isMobile?'calc(10px + env(safe-area-inset-top)) 12px 10px':'12px 16px',color:'#fff',borderBottom:'0.5px solid rgba(255,255,255,.16)',background:'rgba(18,18,18,.92)'}}>
      <div style={{minWidth:0}}><div style={{fontSize:16,fontWeight:900,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title||'Receipts'}</div><div style={{fontSize:12,color:'#aeaeb2',marginTop:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Receipt {current+1} of {cleanItems.length}{item&&item.name?' · '+item.name:''}</div></div>
      <button type="button" onClick={onClose} aria-label="Close receipts" style={{width:40,height:40,border:0,borderRadius:20,background:'#2c2c2e',color:'#fff',fontSize:24,lineHeight:1}}>x</button>
    </div>
    <div onClick={stop} style={{minHeight:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',padding:isMobile?8:14}}>
      {err?<div style={{color:'#fff',fontSize:14,textAlign:'center'}}>{err}</div>:!url?<div style={{color:'#aeaeb2',fontSize:13}}>Loading receipt...</div>:isPDF(item.path)?<iframe src={url+'#toolbar=0&navpanes=0'} style={{width:'100%',height:'100%',border:0,background:'#fff',borderRadius:isMobile?0:10}} title="gallery file"/>:<img src={url} alt="gallery file" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',display:'block',borderRadius:isMobile?0:10}}/>}
    </div>
    <div onClick={stop} className="nf-user-gallery-actions" style={{display:'grid',gridTemplateColumns:'44px 1fr 44px',gap:10,alignItems:'center',padding:isMobile?'10px 12px calc(12px + env(safe-area-inset-bottom))':'12px 16px',background:'rgba(18,18,18,.92)',borderTop:'0.5px solid rgba(255,255,255,.16)'}}>
      <button type="button" onClick={()=>go(-1)} disabled={cleanItems.length<2} aria-label="Previous receipt" style={{height:44,border:0,borderRadius:22,background:cleanItems.length<2?'#2c2c2e':'#fff',color:cleanItems.length<2?'#777':'#111',fontSize:24}}>‹</button>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,minWidth:0}}>
        {downloadUrl&&<a href={downloadUrl} download={(item&&item.name)||'receipt'} style={{color:'#fff',textDecoration:'none',fontSize:13,fontWeight:800,background:'#2c2c2e',borderRadius:12,padding:'12px 14px'}}>Download</a>}
        <div style={{color:'#aeaeb2',fontSize:12,fontWeight:700}}>{current+1}/{cleanItems.length}</div>
      </div>
      <button type="button" onClick={()=>go(1)} disabled={cleanItems.length<2} aria-label="Next receipt" style={{height:44,border:0,borderRadius:22,background:cleanItems.length<2?'#2c2c2e':'#fff',color:cleanItems.length<2?'#777':'#111',fontSize:24}}>›</button>
    </div>
  </div>;
}
function UserEditExpenseModal({expense,onClose,onSaved,setViewer}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const [form,setForm]=useState(()=>({
    date:String(expense.date||'').slice(0,10),
    merchant:expense.merchant||'',
    amount:String(Number(expense.amountCHF||expense.amount||0).toFixed(2)),
    tva:String(Number(expense.tva||0).toFixed(2)),
    category:expense.category||'autre',
    paymentCard:userExpensePaymentCard(expense.note),
    mealWith:userExpenseMealWith(expense.note,expense.category),
    note:userExpenseCleanNote(expense.note,expense.category)
  }));
  const [receiptItems,setReceiptItems]=useState(()=>receiptItemsForExpense(expense));
  const [newFiles,setNewFiles]=useState([]);
  const [removedPaths,setRemovedPaths]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const setField=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const save=async()=>{
    const amount=Number(form.amount);
    const vat=Number(form.tva||0);
    if(!form.date||!form.merchant.trim()){setError('Date and merchant are required.');return;}
    if(!Number.isFinite(amount)||amount<0){setError('Amount is invalid.');return;}
    if(!form.paymentCard){setError('Choose the payment card.');return;}
    if(form.category==='repas'&&!form.mealWith.trim()){setError('Who was this meal with?');return;}
    setBusy(true);setError('');
    try{
      const uploaded=[];
      for(const file of newFiles){
        const out=await uploadReceipt(file);
        uploaded.push({path:out.path||out.url,name:out.name||file.name});
      }
      const nextReceipts=normalizeReceiptItems([...receiptItems,...uploaded]);
      const cardNote=form.paymentCard==='entreprise'?'Carte utilisee: entreprise':'Carte utilisee: perso';
      const mealNote=form.category==='repas'?'With: '+form.mealWith.trim():'';
      const updated=await updateUserExpense(expense.id,{
        date:form.date,
        merchant:form.merchant.trim(),
        amount,
        amount_chf:amount,
        tva:Number.isFinite(vat)?vat:0,
        category:form.category,
        note:[cardNote,mealNote,form.note.trim()].filter(Boolean).join('\n'),
        ...receiptPayloadFromItems(nextReceipts)
      });
      if(removedPaths.length){
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
  return <div className="nf-user-edit-overlay" style={{position:'fixed',inset:0,background:'rgba(10,16,32,0.48)',zIndex:5000,display:'flex',alignItems:isMobile?'stretch':'center',justifyContent:'center',padding:isMobile?0:20}} onClick={onClose}>
    <div className="nf-user-edit-panel" onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:isMobile?0:18,width:isMobile?'100%':560,height:isMobile?'100dvh':'auto',maxHeight:isMobile?'100dvh':'calc(100dvh - 50px)',overflowY:'auto',boxShadow:'0 24px 80px rgba(10,16,32,0.24)',padding:isMobile?0:22}}>
      <div className="nf-user-edit-header" style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:isMobile?0:16}}>
        <div><div style={{fontSize:19,fontWeight:900}}>Edit expense</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>Changes are allowed until the month is submitted.</div></div>
        <button className="nf-user-edit-close" type="button" onClick={onClose} aria-label="Close" style={{...bS,width:40,height:40,padding:0,justifyContent:'center',fontSize:22}}>x</button>
      </div>
      <div className="nf-user-edit-form" style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:12}}>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Date<input type="date" value={form.date} onChange={e=>setField('date',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Amount CHF<input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setField('amount',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Merchant<input value={form.merchant} onChange={e=>setField('merchant',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>VAT CHF<input type="number" min="0" step="0.01" value={form.tva} onChange={e=>setField('tva',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Payment card<select value={form.paymentCard} onChange={e=>setField('paymentCard',e.target.value)} style={{...inp,fontSize:isMobile?16:14,background:'#fff'}}><option value="">Choose card...</option><option value="entreprise">Company card</option><option value="perso">Personal card</option></select></label>
        <label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Category<select value={form.category} onChange={e=>setField('category',e.target.value)} style={{...inp,fontSize:isMobile?16:14,background:'#fff'}}>{CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        {form.category==='repas'&&<label style={{display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Who with? *<input value={form.mealWith} onChange={e=>setField('mealWith',e.target.value)} placeholder="Client, colleagues, team..." style={{...inp,fontSize:isMobile?16:14}}/></label>}
        <div style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:8}}>
          <div style={{fontSize:12,fontWeight:800,color:'var(--t2)'}}>Receipts</div>
          <MultiReceiptEditor items={receiptItems} setItems={setReceiptItems} setViewer={setViewer} setRemovedPaths={setRemovedPaths} newFiles={newFiles} setNewFiles={setNewFiles} isMobile={isMobile}/>
        </div>
        <label style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Note<textarea value={form.note} onChange={e=>setField('note',e.target.value)} rows={3} style={{...inp,fontSize:isMobile?16:14,resize:'vertical'}}/></label>
      </div>
      {error&&<div className="nf-user-edit-error" style={{marginTop:12,background:'var(--rl)',color:'var(--red)',borderRadius:12,padding:10,fontSize:12,fontWeight:800}}>{error}</div>}
      <div className="nf-user-edit-actions" style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18,flexDirection:isMobile?'column-reverse':'row'}}><button type="button" onClick={onClose} style={{...bS,justifyContent:'center'}}>Cancel</button><button type="button" disabled={busy} onClick={save} style={{...bP,justifyContent:'center',opacity:busy?0.65:1}}>{busy?'Saving...':'Save changes'}</button></div>
    </div>
  </div>;
}
`;

    const style=String.raw`<style id="notesfrais-user-edit-v1">
@media(max-width:859px){
  body.nf-ios-mike .nf-user-gallery{
    position:fixed!important;
    inset:0!important;
    width:100vw!important;
    height:100dvh!important;
    z-index:7000!important;
    display:grid!important;
    grid-template-rows:auto minmax(0,1fr) auto!important;
    background:#000!important;
  }
  body.nf-ios-mike .nf-user-gallery-header{
    min-height:calc(58px + env(safe-area-inset-top))!important;
  }
  body.nf-ios-mike .nf-user-gallery-actions{
    min-height:calc(64px + env(safe-area-inset-bottom))!important;
  }
  body.nf-ios-mike .nf-user-receipt-preview{
    position:relative!important;
    width:64px!important;
    height:64px!important;
    min-width:64px!important;
  }
  body.nf-ios-mike .nf-user-receipt-preview>button{
    width:64px!important;
    height:64px!important;
    border-radius:14px!important;
  }
  body.nf-ios-mike .nf-ios-expense-receipt .nf-user-receipt-count{
    position:absolute!important;
    right:3px!important;
    top:3px!important;
    z-index:3!important;
    min-width:25px!important;
    height:25px!important;
    padding:0 6px!important;
    border-radius:999px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    background:#007aff!important;
    color:#fff!important;
    border:2px solid #fff!important;
    box-shadow:0 3px 9px rgba(0,122,255,.32)!important;
    font-size:11px!important;
    font-weight:800!important;
    line-height:1!important;
  }
  body.nf-ios-mike .nf-user-edit-overlay{
    z-index:6000!important;
    align-items:stretch!important;
    padding:0!important;
    background:#fff!important;
    width:100vw!important;
    max-width:100vw!important;
    overflow:hidden!important;
    overscroll-behavior-x:none!important;
  }
  body.nf-ios-mike .nf-user-edit-panel{
    width:100%!important;
    max-width:100vw!important;
    height:100dvh!important;
    max-height:100dvh!important;
    border-radius:0!important;
    padding:0!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    overscroll-behavior:contain;
    touch-action:pan-y!important;
    box-shadow:none!important;
    background:#f2f2f7!important;
  }
  body.nf-ios-mike .nf-user-edit-header{
    position:sticky!important;
    top:0!important;
    z-index:4!important;
    min-height:76px!important;
    margin:0!important;
    padding:calc(12px + env(safe-area-inset-top)) 64px 12px 16px!important;
    background:rgba(249,249,249,.96)!important;
    border-bottom:.5px solid rgba(60,60,67,.22)!important;
    backdrop-filter:saturate(180%) blur(22px);
    -webkit-backdrop-filter:saturate(180%) blur(22px);
  }
  body.nf-ios-mike .nf-user-edit-header>div>div:first-child{
    font-size:22px!important;
    line-height:1.15!important;
  }
  body.nf-ios-mike .nf-user-edit-close{
    position:absolute!important;
    top:calc(12px + env(safe-area-inset-top))!important;
    right:14px!important;
    width:40px!important;
    height:40px!important;
    border:0!important;
    border-radius:50%!important;
    background:#e5e5ea!important;
    color:#3c3c43!important;
    font-size:23px!important;
    line-height:1!important;
    z-index:5!important;
  }
  body.nf-ios-mike .nf-user-edit-form{
    width:100%!important;
    min-width:0!important;
    padding:16px 16px 8px!important;
    gap:14px!important;
    overflow:hidden!important;
  }
  body.nf-ios-mike .nf-user-edit-form label{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    font-size:13px!important;
  }
  body.nf-ios-mike .nf-user-edit-form input,
  body.nf-ios-mike .nf-user-edit-form select,
  body.nf-ios-mike .nf-user-edit-form textarea{
    display:block!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:48px!important;
    border-radius:12px!important;
    background:#fff!important;
  }
  body.nf-ios-mike .nf-user-edit-form>div,
  body.nf-ios-mike .nf-user-edit-form>div>div{
    min-width:0!important;
    max-width:100%!important;
  }
  body.nf-ios-mike .nf-user-edit-form button{
    max-width:100%!important;
  }
  body.nf-ios-mike .nf-user-edit-error{
    margin:8px 16px 0!important;
  }
  body.nf-ios-mike .nf-user-edit-actions{
    position:sticky!important;
    bottom:0!important;
    z-index:4!important;
    display:grid!important;
    grid-template-columns:1fr 1.35fr!important;
    gap:10px!important;
    margin:12px 0 0!important;
    padding:12px 16px calc(12px + env(safe-area-inset-bottom))!important;
    background:rgba(249,249,249,.97)!important;
    border-top:.5px solid rgba(60,60,67,.22)!important;
    backdrop-filter:saturate(180%) blur(22px);
    -webkit-backdrop-filter:saturate(180%) blur(22px);
    width:100%!important;
    max-width:100vw!important;
    overflow:hidden!important;
  }
  body.nf-ios-mike .nf-user-edit-actions button{
    min-height:48px!important;
    width:100%!important;
    border-radius:12px!important;
    font-size:15px!important;
  }
}
@media(min-width:860px){
  .nf-user-receipt-preview{position:relative;display:inline-flex}
  .nf-user-receipt-count{position:absolute;right:-7px;top:-7px;z-index:2;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:#1A3FB5;color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;box-shadow:0 3px 8px rgba(26,63,181,.28)}
}
.nf-submission-progress{
  position:fixed;
  left:50%;
  bottom:24px;
  transform:translateX(-50%);
  z-index:7000;
  width:min(420px,calc(100vw - 32px));
  background:#fff;
  border:.5px solid rgba(60,60,67,.2);
  border-radius:16px;
  padding:14px 16px;
  box-shadow:0 18px 50px rgba(26,26,26,.18);
}
.nf-submission-progress-title{font-size:13px;font-weight:900;margin-bottom:4px;color:#1a1a1a}
.nf-submission-progress-text{font-size:12px;color:var(--t3);line-height:1.35}
.nf-submission-progress-track{height:5px;background:var(--s2);border-radius:999px;overflow:hidden;margin-top:11px}
.nf-submission-progress-bar{height:100%;width:42%;border-radius:999px;background:var(--accent);animation:nfSubmissionSlide 1.15s ease-in-out infinite}
@keyframes nfSubmissionSlide{0%{transform:translateX(-110%)}55%{transform:translateX(80%)}100%{transform:translateX(245%)}}
@media(max-width:859px){
  .nf-submission-progress{bottom:calc(86px + env(safe-area-inset-bottom));width:calc(100vw - 28px);padding:13px 14px}
}
</style>`;

    const submitMonthAction = String.raw`disabled={mE.length===0||syncing||mE.some(e=>e.submissionStatus==='submitted')} onClick={async()=>{if(mE.length===0||syncing||mE.some(e=>e.submissionStatus==='submitted'))return;let timers=[];setSyncing(true);setSubmissionStep('Preparing receipt ZIP');try{timers=[setTimeout(()=>setSubmissionStep('Sending email to finance'),1400),setTimeout(()=>setSubmissionStep('Closing the month'),5200)];const out=await notesFraisApi('/api/monthly-submission',{method:'POST',body:JSON.stringify({month}),timeoutMs:90000});const ids=new Set((out.data||[]).map(item=>String(item.id)));setExpenses(prev=>prev.map(item=>ids.has(String(item.id))?{...item,submissionStatus:'submitted',submittedAt:out.submittedAt}:item));setSubmissionStep('Done');notify('Month submitted to finance. Receipt ZIP sent.');}catch(err){const msg='Submission failed: '+(err&&err.message?err.message:String(err));notify(msg);alert(msg);}finally{timers.forEach(clearTimeout);setTimeout(()=>setSubmissionStep(''),650);setSyncing(false);}}}`;
    const submitMonthLabel = String.raw`>{mE.some(e=>e.submissionStatus==='submitted')?'Already submitted':syncing?(submissionStep||'Submitting...'):'Submit '+ML}</button>`;

    html=html.replace('function App(){',component+'\nfunction App(){');
    html=html.replace(
      '  const [viewer,setViewer]=useState(null);',
      '  const [viewer,setViewer]=useState(null);\n  const [editingExpense,setEditingExpense]=useState(null);\n  const [submissionStep,setSubmissionStep]=useState(\'\');'
    );
    html=html.replace(
      '<button onClick={()=>deleteExpense(e.id,e.receiptPath||e.receiptUrl)} style={{background:\'none\',border:\'none\',cursor:\'pointer\',color:\'var(--t3)\',fontSize:14,padding:2}} title="Delete">🗑</button>',
      `{e.submissionStatus==='submitted'?<span style={{fontSize:11,fontWeight:800,color:'var(--t3)',background:'var(--s2)',padding:'6px 9px',borderRadius:999}}>Closed</span>:<><button type="button" onClick={()=>setEditingExpense(e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,fontWeight:800,padding:4}} title="Edit">Edit</button><button onClick={()=>deleteExpense(e.id,e.receiptPath||e.receiptUrl)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:14,padding:2}} title="Delete">🗑</button></>}`
    );
    html=html.replace(
      '<Thumb path={e.receiptPath||e.receiptUrl} name={e.receiptName||\'receipt\'} onView={(e.receiptPath||e.receiptUrl)?()=>setViewer({path:e.receiptPath||e.receiptUrl,name:e.receiptName||\'receipt\'}):null}/>',
      '<UserReceiptPreview expense={e} setViewer={setViewer}/>'
    );
    html=html.replace(
      /<button onClick=\{\(\)=>deleteExpense\(e\.id,e\.receiptUrl\)\} style=\{\{background:'none',border:'none',cursor:'pointer',color:'var\(--t3\)',fontSize:14,padding:2\}\} title="Supprimer">[^<]*<\/button>/,
      `{e.submissionStatus==='submitted'?<span style={{fontSize:11,fontWeight:800,color:'var(--t3)',background:'var(--s2)',padding:'6px 9px',borderRadius:999}}>Closed</span>:<><button type="button" onClick={()=>setEditingExpense(e)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,fontWeight:800,padding:4}} title="Edit">Edit</button><button onClick={()=>deleteExpense(e.id,e.receiptUrl)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t3)',fontSize:14,padding:2}} title="Delete">Delete</button></>}`
    );
    html=html.replace(
      '<Thumb url={e.receiptUrl} name={e.receiptName||\'justificatif\'} onView={e.receiptUrl?()=>setViewer({url:e.receiptUrl,name:e.receiptName||\'justificatif\'}):null}/>',
      '<UserReceiptPreview expense={e} setViewer={setViewer}/>'
    );
    html=html.replace(
      '      {viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>}',
      '      {submissionStep&&<div className="nf-submission-progress"><div className="nf-submission-progress-title">{submissionStep}</div><div className="nf-submission-progress-text">Keep this page open. NotesFrais is preparing the receipts, sending the email, then closing the month.</div><div className="nf-submission-progress-track"><div className="nf-submission-progress-bar"/></div></div>}\n      {viewer&&viewer.items?<UserReceiptGallery items={viewer.items} index={viewer.index||0} title={viewer.name} onClose={()=>setViewer(null)}/>:viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>}'
    );
    html=html.replace(
      '      {viewer&&<ReceiptViewer url={viewer.url} name={viewer.name} onClose={()=>setViewer(null)}/>}',
      '      {submissionStep&&<div className="nf-submission-progress"><div className="nf-submission-progress-title">{submissionStep}</div><div className="nf-submission-progress-text">Keep this page open. NotesFrais is preparing the receipts, sending the email, then closing the month.</div><div className="nf-submission-progress-track"><div className="nf-submission-progress-bar"/></div></div>}\n      {viewer&&viewer.items?<UserReceiptGallery items={viewer.items} index={viewer.index||0} title={viewer.name} onClose={()=>setViewer(null)}/>:viewer&&<ReceiptViewer url={viewer.url||viewer.path} path={viewer.path||viewer.url} name={viewer.name} onClose={()=>setViewer(null)}/>}'
    );
    html=html.replace(
      '      {viewer&&viewer.items?<UserReceiptGallery items={viewer.items} index={viewer.index||0} title={viewer.name} onClose={()=>setViewer(null)}/>:viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>}',
      '      {viewer&&viewer.items?<UserReceiptGallery items={viewer.items} index={viewer.index||0} title={viewer.name} onClose={()=>setViewer(null)}/>:viewer&&<ReceiptViewer path={viewer.path} name={viewer.name} onClose={()=>setViewer(null)}/>}\n      {editingExpense&&<UserEditExpenseModal expense={editingExpense} onClose={()=>setEditingExpense(null)} setViewer={setViewer} onSaved={updated=>setExpenses(prev=>prev.map(item=>String(item.id)===String(updated.id)?updated:item))}/>}'
    );
    html=html.replace(
      '      {viewer&&viewer.items?<UserReceiptGallery items={viewer.items} index={viewer.index||0} title={viewer.name} onClose={()=>setViewer(null)}/>:viewer&&<ReceiptViewer url={viewer.url||viewer.path} path={viewer.path||viewer.url} name={viewer.name} onClose={()=>setViewer(null)}/>}',
      '      {viewer&&viewer.items?<UserReceiptGallery items={viewer.items} index={viewer.index||0} title={viewer.name} onClose={()=>setViewer(null)}/>:viewer&&<ReceiptViewer url={viewer.url||viewer.path} path={viewer.path||viewer.url} name={viewer.name} onClose={()=>setViewer(null)}/>}\n      {editingExpense&&<UserEditExpenseModal expense={editingExpense} onClose={()=>setEditingExpense(null)} setViewer={setViewer} onSaved={updated=>setExpenses(prev=>prev.map(item=>String(item.id)===String(updated.id)?updated:item))}/>}'
    );
    if(!html.includes('data-user-submit-placement')){
      html=html.replace(
        "<PeriodHeader title={'Expenses'} subtitle={ML+' · '+fil.length+' expenses · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' with receipt'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>",
        "<PeriodHeader title={'Expenses'} subtitle={ML+' · '+fil.length+' expenses · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' with receipt'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>{window.notesFraisRole!=='finance'&&periodMode==='month'&&<div data-user-submit-placement=\"true\" style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?14:16,marginBottom:14,display:'flex',alignItems:isMobile?'stretch':'center',justifyContent:'space-between',gap:12,flexDirection:isMobile?'column':'row',boxShadow:'0 8px 24px rgba(26,26,26,0.04)'}}><div><div style={{fontSize:15,fontWeight:900}}>Ready to close {ML}?</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{mE.length+' expenses · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' receipts'}</div></div><button type=\"button\" onClick={()=>{}} style={{...bP,justifyContent:'center',minWidth:isMobile?'100%':210}}>Submit {ML}</button></div>}"
      );
      html=html.replace(
        "monthCounts={monthCounts}/>{tab==='history'&&<div data-submit-month-card",
        "monthCounts={monthCounts}/>{window.notesFraisRole!=='finance'&&periodMode==='month'&&<div data-user-submit-placement=\"true\" style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:16,padding:isMobile?14:16,marginBottom:14,display:'flex',alignItems:isMobile?'stretch':'center',justifyContent:'space-between',gap:12,flexDirection:isMobile?'column':'row',boxShadow:'0 8px 24px rgba(26,26,26,0.04)'}}><div><div style={{fontSize:15,fontWeight:900}}>Ready to close {ML}?</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{mE.length+' expenses · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' receipts'}</div></div><button type=\"button\" onClick={()=>{}} style={{...bP,justifyContent:'center',minWidth:isMobile?'100%':210}}>Submit {ML}</button></div>}{tab==='history'&&<div data-submit-month-card"
      );
    }
    html=html
      .split('<button type="button" onClick={()=>{}} style={{...bP,justifyContent:\'center\',minWidth:isMobile?\'100%\':210}}>Submit {ML}</button>')
      .join('<button type="button" '+submitMonthAction+' style={{...bP,justifyContent:\'center\',minWidth:isMobile?\'100%\':210,opacity:(mE.length===0||mE.some(e=>e.submissionStatus===\'submitted\'))?0.6:1}}'+submitMonthLabel);
    return html.replace('</head>',style+'</head>');
  };
})();
