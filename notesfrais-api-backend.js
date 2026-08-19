(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_API_BACKEND_V1')) return html;

    html = html.replace(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\/dist\/umd\/supabase\.js"><\/script>\s*/g, '');

    const client = String.raw`const NOTESFRAIS_API_BACKEND_V1=true;
function notesFraisReadFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(file);
  });
}
async function notesFraisPrepareUpload(file){
  const maxBytes=2.6*1024*1024;
  if(!file||!file.size||file.size<=maxBytes)return file;
  if(!file.type||!file.type.startsWith('image/')){
    throw new Error('Ce fichier depasse la limite de 2.6 Mo. Les photos sont compressees automatiquement, mais ce PDF doit etre reduit.');
  }
  let bitmap;
  let objectUrl='';
  try{
    bitmap=await new Promise((resolve,reject)=>{
      if(window.createImageBitmap){
        createImageBitmap(file).then(resolve).catch(()=>{
          const img=new Image();
          objectUrl=URL.createObjectURL(file);
          img.onload=()=>resolve(img);
          img.onerror=reject;
          img.src=objectUrl;
        });
      }else{
        const img=new Image();
        objectUrl=URL.createObjectURL(file);
        img.onload=()=>resolve(img);
        img.onerror=reject;
        img.src=objectUrl;
      }
    });
    const width=bitmap.width||bitmap.naturalWidth;
    const height=bitmap.height||bitmap.naturalHeight;
    if(!width||!height)throw new Error('Dimensions de photo invalides');
    const baseName=(file.name||'receipt').replace(/\.[^.]+$/,'');
    const attempts=[
      {side:2200,quality:.82},
      {side:1900,quality:.74},
      {side:1600,quality:.68},
      {side:1400,quality:.60}
    ];
    for(const attempt of attempts){
      const scale=Math.min(1,attempt.side/Math.max(width,height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(width*scale));
      canvas.height=Math.max(1,Math.round(height*scale));
      const context=canvas.getContext('2d');
      context.fillStyle='#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',attempt.quality));
      if(blob&&blob.size<=maxBytes){
        return new File([blob],baseName+'-optimized.jpg',{type:'image/jpeg',lastModified:Date.now()});
      }
    }
    throw new Error('La photo reste trop lourde apres compression');
  }catch(error){
    throw new Error('Impossible de compresser cette photo. Essayez une capture d ecran du recu.');
  }finally{
    if(bitmap&&bitmap.close)bitmap.close();
    if(objectUrl)URL.revokeObjectURL(objectUrl);
  }
}
async function notesFraisApi(path,options){
  const controller=new AbortController();
  const timeoutMs=(options&&options.timeoutMs)||30000;
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  let response;
  try{
    response=await fetch(path,{credentials:'same-origin',...(options||{}),signal:controller.signal,headers:{'Content-Type':'application/json',...((options&&options.headers)||{})}});
  }catch(error){
    if(error&&error.name==='AbortError')throw new Error('Upload trop long. Reessayez avec une photo plus legere ou un PDF plus petit.');
    throw error;
  }finally{
    clearTimeout(timer);
  }
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false){
    const err=new Error(data.error||('HTTP '+response.status));
    err.status=response.status;
    throw err;
  }
  return data;
}
function notesFraisFilterParams(filters){
  const params=new URLSearchParams();
  const gte=filters.find(f=>f.op==='gte'&&f.column==='date');
  const lte=filters.find(f=>f.op==='lte'&&f.column==='date');
  if(gte)params.set('from',gte.value);
  if(lte)params.set('to',lte.value);
  return params;
}
function nfIsoDay(value){
  if(!value)return value;
  if(value instanceof Date)return value.toISOString().slice(0,10);
  const text=String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text)?text.slice(0,10):text;
}
function nfNormalizeRow(row){
  if(!row||typeof row!=='object')return row;
  const out={...row};
  if('date' in out)out.date=nfIsoDay(out.date);
  if('ubs_date' in out)out.ubs_date=nfIsoDay(out.ubs_date);
  return out;
}
// Neon renvoie les colonnes 'date' en horodatage ISO complet, la ou Supabase
// renvoyait 'AAAA-MM-JJ'. Le front compare ces dates comme des CHAINES : un
// frais du dernier jour du mois echouait le test date<=periodEnd et
// disparaissait de la vue, du total et de la soumission.
function nfNormalizeData(data){
  if(Array.isArray(data))return data.map(nfNormalizeRow);
  return nfNormalizeRow(data);
}
function makeNotesFraisBuilder(table){
  const state={table,action:'select',filters:[],values:null,single:false,maybeSingle:false};
  const builder={
    select(){state.action=state.action==='insert'?'insert':'select';return builder;},
    gte(column,value){state.filters.push({op:'gte',column,value});return builder;},
    lte(column,value){state.filters.push({op:'lte',column,value});return builder;},
    eq(column,value){state.filters.push({op:'eq',column,value});return builder;},
    in(column,values){state.filters.push({op:'in',column,values});return builder;},
    order(){return builder;},
    insert(values){state.action='insert';state.values=values;return builder;},
    update(values){state.action='update';state.values=values;return builder;},
    delete(){state.action='delete';return builder;},
    single(){state.single=true;return builder.execute();},
    maybeSingle(){state.maybeSingle=true;return builder.execute();},
    then(resolve,reject){return builder.execute().then(resolve,reject);},
    catch(reject){return builder.execute().catch(reject);},
    async execute(){
      try{
        if(table==='app_profiles'){
          const session=await notesFraisApi('/api/session');
          const data=session.profile||null;
          return {data,error:null};
        }
        if(table!=='expenses')throw new Error('Table non supportee: '+table);
        if(state.action==='select'){
          const params=notesFraisFilterParams(state.filters);
          const out=await notesFraisApi('/api/expenses?'+params.toString());
          return {data:nfNormalizeData(out.data||[]),error:null};
        }
        if(state.action==='insert'){
          const value=Array.isArray(state.values)?state.values[0]:state.values;
          const out=await notesFraisApi('/api/expenses',{method:'POST',body:JSON.stringify(value)});
          return {data:nfNormalizeData(out.data),error:null};
        }
        if(state.action==='update'){
          const idFilter=state.filters.find(f=>f.op==='eq'&&f.column==='id');
          const inFilter=state.filters.find(f=>f.op==='in'&&f.column==='id');
          const payload={values:state.values};
          if(idFilter)payload.id=idFilter.value;
          if(inFilter)payload.ids=inFilter.values;
          const out=await notesFraisApi('/api/expenses',{method:'PATCH',body:JSON.stringify(payload)});
          return {data:nfNormalizeData(out.data),error:null};
        }
        if(state.action==='delete'){
          const idFilter=state.filters.find(f=>f.op==='eq'&&f.column==='id');
          const params=new URLSearchParams({id:String(idFilter&&idFilter.value||'')});
          const out=await notesFraisApi('/api/expenses?'+params.toString(),{method:'DELETE'});
          return {data:nfNormalizeData(out.data),error:null};
        }
      }catch(error){
        return {data:null,error};
      }
    }
  };
  return builder;
}
const notesFraisAuthListeners=new Set();
function notesFraisNotifyAuth(event,session){
  notesFraisAuthListeners.forEach(listener=>{
    try{listener(event,session||null);}catch(e){setTimeout(()=>{throw e;},0);}
  });
}
const sb={
  from(table){return makeNotesFraisBuilder(table);},
  auth:{
    async getSession(){const out=await notesFraisApi('/api/session');return {data:{session:out.session},error:null};},
    onAuthStateChange(callback){
      notesFraisAuthListeners.add(callback);
      return {data:{subscription:{unsubscribe(){notesFraisAuthListeners.delete(callback);}}}};
    },
    async signInWithPassword({email,password}){try{const out=await notesFraisApi('/api/session',{method:'POST',body:JSON.stringify({email,password})});notesFraisNotifyAuth('SIGNED_IN',out.session);return {data:{session:out.session},error:null};}catch(error){return {data:null,error};}},
    async signOut(){await notesFraisApi('/api/session',{method:'DELETE'});notesFraisNotifyAuth('SIGNED_OUT',null);return {error:null};},
    async getUser(){const out=await notesFraisApi('/api/session');const user=out.session&&out.session.user?out.session.user:null;return {data:{user},error:null};}
  },
  storage:{
    from(){
      return {
        async upload(path,file,options){
          try{
            const prepared=await notesFraisPrepareUpload(file);
            const dataUrl=await notesFraisReadFile(prepared);
            await notesFraisApi('/api/receipts',{method:'POST',body:JSON.stringify({path,fileName:prepared.name,mimeType:prepared.type||(options&&options.contentType)||file.type,dataUrl,channel:window.NOTESFRAIS_CHANNEL||'mike'})});
            return {data:{path},error:null};
          }catch(error){return {data:null,error};}
        },
        async createSignedUrl(path,_seconds,options){
          try{
            const params=new URLSearchParams({path,name:(options&&options.download)||'receipt'});
            const out=await notesFraisApi('/api/receipts?'+params.toString());
            return {data:{signedUrl:out.signedUrl},error:null};
          }catch(error){return {data:null,error};}
        },
        async remove(paths){
          try{await notesFraisApi('/api/receipts',{method:'DELETE',body:JSON.stringify({paths})});return {data:null,error:null};}
          catch(error){return {data:null,error};}
        },
        getPublicUrl(path){return {data:{publicUrl:path}};}
      };
    }
  }
};`;

    html = html.replace(/const SUPABASE_URL='[^']*';\s*const SUPABASE_KEY='[^']*';\s*const sb=supabase\.createClient\(SUPABASE_URL,SUPABASE_KEY\);/, client);
    html = html.replace(
      /let receiptUrl=null,receiptName=null;\s*if\(file\)\{const u=await uploadReceipt\(file\);receiptUrl=u\.url;receiptName=u\.name;\}/g,
      "let receiptPath=null,receiptName=null;\n      if(file){const u=await uploadReceipt(file);receiptPath=u.path||u.url;receiptName=u.name;}"
    );
    html = html.replace(
      "await onAdd({...form,note:finalNote,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptUrl,receiptName});",
      "await onAdd({...form,note:finalNote,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptPath,receiptName});"
    );
    html = html.replace(
      "await onAdd({...form,note:[cardLabel,form.note].filter(Boolean).join('\\n'),currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptUrl,receiptName});",
      "await onAdd({...form,note:[cardLabel,form.note].filter(Boolean).join('\\n'),currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptPath,receiptName});"
    );
    html = html.replace(
      "await queueOfflineExpense({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptName:file?file.name:null},file);",
      "const offlineFile=file?await notesFraisPrepareUpload(file):null;\n        await queueOfflineExpense({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptName:offlineFile?offlineFile.name:null},offlineFile);"
    );
    if(!html.includes('data-period-sidebar-block')){
      html = html.replace(
        /        <div style=\{\{padding:isMobile\?'0 12px 10px':'0 12px 12px'\}\}>[\s\S]*?\n        <div style=\{\{height:'0\.5px',background:'var\(--border\)',margin:'0 16px'\}\}\/>/,
        "        {/* data-period-sidebar-block removed: period controls live in page headers */}"
      );
    }
    if(!html.includes('data-submit-month-card')){
      html = html.replace(
        "<PeriodHeader title={'Expenses'} subtitle={ML+' · '+fil.length+' expenses · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' with receipt'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>",
        "<PeriodHeader title={'Expenses'} subtitle={ML+' · '+fil.length+' expenses · '+fil.filter(e=>e.receiptPath||e.receiptUrl).length+' with receipt'} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>{tab==='history'&&<div data-submit-month-card=\"true\" style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:12,padding:isMobile?14:16,marginBottom:16,display:'flex',alignItems:isMobile?'stretch':'center',justifyContent:'space-between',gap:12,flexDirection:isMobile?'column':'row'}}><div><div style={{fontWeight:800,fontSize:15}}>Monthly submission</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{periodMode==='month'?ML+' · '+mE.length+' expenses ready':'Choose a month before submitting to finance'}</div></div><button disabled={mE.length===0||syncing||submissionStatus==='submitted'} onClick={()=>{if(periodMode!=='month'){setPeriodMode('month');notify('Choose the month to submit');return;}setShowSubmitSummary(true);}} style={{...bP,justifyContent:'center',opacity:(mE.length===0||syncing||submissionStatus==='submitted')?0.55:1,minWidth:isMobile?'100%':220}}>{submissionStatus==='submitted'?'Already submitted':syncing?'Submitting...':'Submit to finance'}</button></div>}"
      );
    }
    html = html.replace(
      "<button onClick={()=>setShowSubmitSummary(true)} style={{...bP,width:isMobile?'100%':'auto',justifyContent:'center',padding:'14px 24px',background:submitted?'var(--green)':'var(--accent)',transition:'background 0.3s',fontSize:14}}>{submitted?'✓ Expenses submitted!':'📤 Submit monthly expenses'}</button>",
      "<button disabled={mE.length===0||submissionStatus==='submitted'} onClick={()=>setShowSubmitSummary(true)} style={{...bP,width:isMobile?'100%':'auto',justifyContent:'center',padding:'14px 24px',background:submitted||submissionStatus==='submitted'?'var(--green)':'var(--accent)',transition:'background 0.3s',fontSize:14,opacity:(mE.length===0||submissionStatus==='submitted')?0.72:1}}>{submissionStatus==='submitted'?'✓ Already submitted':submitted?'✓ Expenses submitted!':'📤 Submit monthly expenses'}</button>"
    );
    html = html.replace(
      "setShowSubmitSummary(false);\n      setSubmitted(true);",
      "try{if(typeof clearExpenseDraft==='function')clearExpenseDraft();window.dispatchEvent(new Event('notesfrais-offline-queued'));}catch(_e){}\n      setShowSubmitSummary(false);\n      setSubmitted(true);"
    );
    if(!html.includes('NOTESFRAIS_FINANCE_WORKBENCH_V1')){
      const financeWorkbench = String.raw`
const NOTESFRAIS_FINANCE_WORKBENCH_V1=true;
function fwFinanceAmount(value){return Math.abs(Number(value||0));}
function normalizePeriodRange(from,to){
  const start=from||MONTHS[0].v;
  const end=to||start;
  return start<=end?{from:start,to:end}:{from:end,to:start};
}
function periodLabelFor(mode,month,from,to){
  const label=value=>(MONTHS.find(m=>m.v===value)||{}).l||value;
  if(mode==='year')return 'Year 2026';
  if(mode==='range'){const range=normalizePeriodRange(from,to);return label(range.from)+' - '+label(range.to);}
  return label(month);
}
function PeriodInsideTabs({periodMode,setPeriodMode,month,setMonth,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const btn=(id,label)=><button onClick={()=>setPeriodMode(id)} style={{border:periodMode===id?'1.5px solid var(--accent)':'0.5px solid var(--border)',background:periodMode===id?'var(--al)':'#fff',color:periodMode===id?'var(--accent)':'var(--t2)',borderRadius:999,padding:'8px 12px',fontSize:12,fontWeight:800,cursor:'pointer'}}>{label}</button>;
  const selectStyle={...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'11px 12px':'9px 12px'};
  return <div data-period-selector="true" style={{display:'grid',gap:8}}>
    <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>{btn('month','Month')}{btn('range','Range')}{btn('year','Full year')}</div>
    {periodMode==='month'&&<select value={month} onChange={e=>{setMonth(e.target.value);setPeriodFrom(e.target.value);setPeriodTo(e.target.value);}} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}{monthCounts&&monthCounts[m.v]?' ('+monthCounts[m.v]+')':''}</option>)}</select>}
    {periodMode==='range'&&<div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:8}}><select value={periodFrom} onChange={e=>setPeriodFrom(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select><select value={periodTo} onChange={e=>setPeriodTo(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select></div>}
    {periodMode==='year'&&<div style={{...selectStyle,color:'var(--accent)',fontWeight:800}}>Year 2026 · {Object.values(monthCounts||{}).reduce((s,n)=>s+Number(n||0),0)} expenses</div>}
  </div>;
}
function PeriodHeader({title,subtitle,periodMode,setPeriodMode,month,setMonth,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  return <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'stretch':'flex-start',flexDirection:isMobile?'column':'row',marginBottom:18}}><div><h1 style={{fontSize:isMobile?24:28,fontWeight:900,marginBottom:4}}>{title}</h1>{subtitle&&<div style={{fontSize:13,color:'var(--t3)'}}>{subtitle}</div>}</div><div style={{minWidth:isMobile?'auto':280}}><PeriodInsideTabs periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/></div></div>;
}
function FinanceMonthPicker({periodMode,setPeriodMode,month,setMonth,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts,isMobile}){
  const mode=['month','range','year'].includes(periodMode)?periodMode:'month';
  const selectStyle={...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 13px':'10px 12px'};
  const chooseMonth=value=>{
    setMonth(value);
    if(typeof setPeriodMode==='function')setPeriodMode('month');
    if(typeof setPeriodFrom==='function')setPeriodFrom(value);
    if(typeof setPeriodTo==='function')setPeriodTo(value);
  };
  const chooseMode=value=>{
    if(typeof setPeriodMode==='function')setPeriodMode(value);
    if(value==='month')chooseMonth(month||MONTHS[0].v);
    if(value==='year'){
      if(typeof setPeriodFrom==='function')setPeriodFrom(MONTHS[0].v);
      if(typeof setPeriodTo==='function')setPeriodTo(MONTHS[MONTHS.length-1].v);
    }
    if(value==='range'){
      if(typeof setPeriodFrom==='function')setPeriodFrom(periodFrom||month||MONTHS[0].v);
      if(typeof setPeriodTo==='function')setPeriodTo(periodTo||month||MONTHS[MONTHS.length-1].v);
    }
  };
  const totalYear=Object.values(monthCounts||{}).reduce((sum,n)=>sum+Number(n||0),0);
  return <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:isMobile?14:16,marginBottom:14,display:'grid',gridTemplateColumns:isMobile?'1fr':'190px 1fr',gap:12,alignItems:'end'}}>
    <label style={{display:'grid',gap:6,fontSize:12,fontWeight:900,color:'var(--t2)'}}><span>Review period</span><select value={mode} onChange={e=>chooseMode(e.target.value)} style={selectStyle}><option value="month">One month</option><option value="range">From month to month</option><option value="year">Full year</option></select></label>
    {mode==='month'&&<label style={{display:'grid',gap:6,fontSize:12,fontWeight:900,color:'var(--t2)'}}><span>Month</span><select value={month} onChange={e=>chooseMonth(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}{monthCounts&&monthCounts[m.v]?' - '+monthCounts[m.v]+' expenses':''}</option>)}</select></label>}
    {mode==='range'&&<div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10}}><label style={{display:'grid',gap:6,fontSize:12,fontWeight:900,color:'var(--t2)'}}><span>From</span><select value={periodFrom||month} onChange={e=>setPeriodFrom(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select></label><label style={{display:'grid',gap:6,fontSize:12,fontWeight:900,color:'var(--t2)'}}><span>To</span><select value={periodTo||month} onChange={e=>setPeriodTo(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}</option>)}</select></label></div>}
    {mode==='year'&&<div style={{...selectStyle,color:'var(--accent)',fontWeight:900,display:'flex',alignItems:'center'}}>Full year 2026 - {totalYear} expenses</div>}
  </div>;
}
function fwFinanceMonthStatus(month,items){
  const list=Array.isArray(items)?items:[];
  const now=new Date();
  const current=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  if(list.length>0&&list.every(e=>(e.submissionStatus||'pending')==='submitted'))return 'submitted';
  return month<current?'to_submit':'pending';
}
function fwFinanceStatusMeta(status){
  if(status==='submitted')return{label:'Submitted',hint:'Ready for finance review',bg:'var(--gl)',color:'var(--green)',border:'#BDEAD9'};
  if(status==='to_submit')return{label:'Expected',hint:'Month ended, not submitted',bg:'var(--aml)',color:'var(--amber)',border:'#F0D391'};
  return{label:'Open',hint:'Current month',bg:'var(--al)',color:'var(--accent)',border:'#C7D5FF'};
}
function fwFinanceReceiptValue(e){return e.receiptPath||e.receiptUrl||'';}
function fwFinanceCardLabel(e){return typeof getPaymentCardLabel==='function'?(getPaymentCardLabel(e.note)||'Missing card'):'Missing card';}
function fwFinanceIssueList(e){
  const issues=[];
  if(!fwFinanceReceiptValue(e))issues.push({label:'No receipt',tone:'red'});
  if((e.status||'pending')!=='reconciled')issues.push({label:'UBS pending',tone:'amber'});
  if(!getPaymentCardLabel(e.note))issues.push({label:'No card',tone:'amber'});
  if(Number(e.tva||0)<=0)issues.push({label:'No VAT',tone:'muted'});
  return issues;
}
function fwFinanceCsvCell(value){
  const text=String(value==null?'':value).replace(/\r?\n/g,' ');
  return /[",;]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
}
function fwDownloadFinanceCsv(items,label){
  const rows=[['Date','Merchant','Category','Card','Amount CHF','VAT CHF','UBS status','Receipt','Notes','Submission status']];
  (items||[]).forEach(e=>rows.push([
    fd(e.date),
    e.merchant||'',
    (CMAP[e.category]&&CMAP[e.category].label)||e.category||'',
    fwFinanceCardLabel(e),
    Number(e.amountCHF||e.amount||0).toFixed(2),
    Number(e.tva||0).toFixed(2),
    e.status||'pending',
    fwFinanceReceiptValue(e)?'yes':'no',
    typeof cleanPaymentCardNote==='function'?cleanPaymentCardNote(e.note):e.note||'',
    e.submissionStatus||'pending'
  ]));
  const csv=rows.map(row=>row.map(fwFinanceCsvCell).join(';')).join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  const url=URL.createObjectURL(blob);
  a.href=url;
  a.download='finance_review_'+String(label||'period').replace(/[^a-z0-9_-]+/gi,'-')+'.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function FinanceDashboardTab({expenses,months,setMonth,setTab,setPeriodMode}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const all=Array.isArray(expenses)?expenses:[];
  const rows=months.map(m=>{
    const list=all.filter(e=>e.date&&e.date.startsWith(m.v));
    const total=list.reduce((s,e)=>s+fwFinanceAmount(e.amountCHF||e.amount),0);
    const tva=list.reduce((s,e)=>s+Number(e.tva||0),0);
    const receipts=list.filter(e=>fwFinanceReceiptValue(e)).length;
    const missingReceipt=list.length-receipts;
    const pendingUbs=list.filter(e=>(e.status||'pending')!=='reconciled').length;
    const issues=list.reduce((sum,e)=>sum+fwFinanceIssueList(e).length,0);
    const status=fwFinanceMonthStatus(m.v,list);
    const submittedAt=(list.find(e=>e.submittedAt)||{}).submittedAt||null;
    return {...m,list,total,tva,receipts,missingReceipt,pendingUbs,issues,status,submittedAt};
  }).filter(r=>r.list.length>0||r.status!=='pending').sort((a,b)=>b.v.localeCompare(a.v));
  const submitted=rows.filter(r=>r.status==='submitted');
  const reviewItems=submitted.reduce((sum,r)=>sum+r.list.length,0);
  const reviewAmount=submitted.reduce((sum,r)=>sum+r.total,0);
  const issueCount=submitted.reduce((sum,r)=>sum+r.issues,0);
  const openMonth=(value)=>{setMonth(value);if(typeof setPeriodMode==='function')setPeriodMode('month');setTab('finance_expenses');};
  const kpi={background:'#fff',border:'0.5px solid var(--border)',borderRadius:12,padding:isMobile?14:16};
  return <div style={{maxWidth:1120,paddingBottom:isMobile?180:40}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:14,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row',marginBottom:18}}>
      <div><div style={{fontSize:11,color:'var(--accent)',letterSpacing:'0.08em',fontWeight:900,marginBottom:6}}>FINANCE WORKBENCH</div><h1 style={{fontSize:isMobile?24:28,fontWeight:900,marginBottom:5}}>Review submitted months</h1><div style={{fontSize:13,color:'var(--t3)',lineHeight:1.45}}>Inbox for monthly expense packages, receipt checks, UBS reconciliation and exports.</div></div>
      <button onClick={()=>setTab('finance_expenses')} style={{...bP,justifyContent:'center'}}>Open month review</button>
    </div>
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:16}}>
      <div style={kpi}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>SUBMITTED MONTHS</div><div style={{fontSize:24,fontWeight:900,fontFamily:'DM Mono',color:'var(--green)'}}>{submitted.length}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>ready for review</div></div>
      <div style={kpi}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>EXPENSES</div><div style={{fontSize:24,fontWeight:900,fontFamily:'DM Mono'}}>{reviewItems}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>in submitted months</div></div>
      <div style={kpi}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>AMOUNT</div><div style={{fontSize:24,fontWeight:900,fontFamily:'DM Mono'}}>CHF {fmt(reviewAmount)}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>to control</div></div>
      <div style={kpi}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:7}}>ISSUES</div><div style={{fontSize:24,fontWeight:900,fontFamily:'DM Mono',color:issueCount?'var(--amber)':'var(--green)'}}>{issueCount}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>receipt / UBS / card</div></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1.35fr .65fr',gap:14,alignItems:'start'}}>
      <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
        <div style={{padding:16,borderBottom:'0.5px solid var(--border)',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><div><div style={{fontSize:16,fontWeight:900}}>Submitted packages</div><div style={{fontSize:12,color:'var(--t3)',marginTop:2}}>Click a month to review expenses and receipts.</div></div></div>
        {rows.length===0?<div style={{padding:34,textAlign:'center',color:'var(--t3)',fontSize:13}}>No expenses yet.</div>:rows.map(r=>{const meta=fwFinanceStatusMeta(r.status);return <button key={r.v} onClick={()=>openMonth(r.v)} style={{width:'100%',textAlign:'left',background:r.status==='submitted'?'#fff':'var(--bg)',border:0,borderBottom:'0.5px solid var(--border)',padding:isMobile?14:16,cursor:'pointer',display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 132px 110px',gap:12,alignItems:'center'}}>
          <div style={{minWidth:0}}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span style={{fontWeight:900,fontSize:15}}>{r.l}</span><span style={{background:meta.bg,color:meta.color,border:'0.5px solid '+meta.border,borderRadius:999,padding:'4px 9px',fontSize:11,fontWeight:900}}>{meta.label}</span></div><div style={{fontSize:12,color:'var(--t3)',marginTop:5}}>{r.list.length} expenses · {r.receipts}/{r.list.length} receipts · {r.pendingUbs} UBS pending{r.submittedAt?' · submitted '+fd(r.submittedAt.slice(0,10)):''}</div></div>
          <div style={{fontFamily:'DM Mono',fontWeight:900}}>CHF {fmt(r.total)}</div>
          <div style={{fontSize:12,fontWeight:900,color:r.issues?'var(--amber)':'var(--green)'}}>{r.issues?r.issues+' issue(s)':'Clean'}</div>
        </button>})}
      </div>
      <div style={{display:'grid',gap:12}}>
        <div style={{background:'#0B1F4D',color:'#fff',borderRadius:14,padding:16}}><div style={{fontSize:11,letterSpacing:'0.08em',opacity:.7,marginBottom:8}}>NEXT ACTION</div><div style={{fontSize:18,fontWeight:900,lineHeight:1.25}}>{submitted.length?'Review the submitted month':'Wait for a monthly submission'}</div><div style={{fontSize:12,opacity:.72,lineHeight:1.45,marginTop:7}}>Open the package, check issues, preview receipts, then export CSV and receipt ZIP.</div></div>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:16}}><div style={{fontSize:15,fontWeight:900,marginBottom:10}}>Controls to run</div>{['Receipts present','Card type assigned','UBS reconciliation','VAT amount plausible','Export CSV + receipts'].map((x,i)=><div key={x} style={{display:'flex',gap:9,alignItems:'center',padding:'8px 0',borderBottom:i<4?'0.5px solid var(--border)':'none'}}><span style={{width:18,height:18,borderRadius:99,background:'var(--al)',color:'var(--accent)',display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900}}>{i+1}</span><span style={{fontSize:13,fontWeight:700}}>{x}</span></div>)}</div>
      </div>
    </div>
  </div>;
}
function fwFinanceDateInputValue(value){return value?String(value).slice(0,10):new Date().toISOString().slice(0,10);}
async function fwUpdateFinanceExpense(id,values){
  const {data,error}=await sb.from('expenses').update(values).eq('id',id);
  if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;
  return typeof nr==='function'?nr(row):row;
}
function FinanceEditExpenseModal({expense,onClose,onSaved,setViewer}){
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
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [receiptFile,setReceiptFile]=useState(null);
  const setField=(key,value)=>setForm(prev=>({...prev,[key]:value}));
  const save=async()=>{
    if(!form.date||!form.merchant.trim()){setError('Date and merchant are required.');return;}
    const amount=Number(form.amount);
    const vat=Number(form.tva||0);
    if(!Number.isFinite(amount)||amount<0){setError('Amount is invalid.');return;}
    setBusy(true);setError('');
    try{
      let receiptUpdate={};
      if(receiptFile){
        const uploaded=await uploadReceipt(receiptFile);
        receiptUpdate={receipt_url:uploaded.path||uploaded.url,receipt_name:uploaded.name||receiptFile.name};
      }
      const updated=await fwUpdateFinanceExpense(expense.id,{
        date:form.date,
        merchant:form.merchant.trim(),
        amount:amount,
        amount_chf:amount,
        tva:Number.isFinite(vat)?vat:0,
        category:form.category,
        status:form.status,
        note:form.note||'',
        ...receiptUpdate
      });
      onSaved&&onSaved(updated);
      onClose&&onClose();
    }catch(err){
      setError(err.message||String(err));
    }finally{
      setBusy(false);
    }
  };
  return <div style={{position:'fixed',inset:0,background:'rgba(10,16,32,0.45)',zIndex:2600,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',padding:isMobile?0:20}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:isMobile?'18px 18px 0 0':18,width:isMobile?'100%':520,maxHeight:isMobile?'88dvh':'calc(100dvh - 60px)',overflowY:'auto',boxShadow:'0 24px 80px rgba(10,16,32,0.22)',padding:isMobile?18:22}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',marginBottom:16}}>
        <div><div style={{fontSize:18,fontWeight:900}}>Edit expense</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>Finance control can correct the submitted record.</div></div>
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
          <div style={{fontSize:12,fontWeight:800,color:'var(--t2)'}}>Receipt</div>
          <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',flexDirection:isMobile?'column':'row',border:'0.5px solid var(--border)',borderRadius:12,padding:12,background:'var(--bg)'}}>
            <div style={{display:'flex',gap:10,alignItems:'center',minWidth:0,width:isMobile?'100%':'auto'}}><Thumb path={fwFinanceReceiptValue(expense)} name={expense.receiptName||'receipt'} onView={fwFinanceReceiptValue(expense)?()=>setViewer&&setViewer({path:fwFinanceReceiptValue(expense),name:expense.receiptName||'receipt'}):null}/><div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:900}}>{fwFinanceReceiptValue(expense)?'Current receipt':'No receipt attached'}</div><div style={{fontSize:12,color:'var(--t3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:isMobile?'260px':'310px'}}>{receiptFile?receiptFile.name:(expense.receiptName||'Choose a file to attach one')}</div></div></div>
            <label style={{...bS,justifyContent:'center',cursor:'pointer',width:isMobile?'100%':'auto'}}><input type="file" accept="image/*,.pdf" onChange={e=>setReceiptFile(e.target.files&&e.target.files[0]?e.target.files[0]:null)} style={{display:'none'}}/>Add / replace receipt</label>
          </div>
        </div>
        <label style={{gridColumn:isMobile?'auto':'1 / -1',display:'grid',gap:6,fontSize:12,fontWeight:800,color:'var(--t2)'}}>Note<textarea value={form.note} onChange={e=>setField('note',e.target.value)} rows={3} style={{...inp,fontSize:isMobile?16:14,resize:'vertical'}}/></label>
      </div>
      {error&&<div style={{marginTop:12,background:'var(--rl)',color:'var(--red)',borderRadius:12,padding:10,fontSize:12,fontWeight:800}}>{error}</div>}
      <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:18,flexDirection:isMobile?'column-reverse':'row'}}><button onClick={onClose} style={{...bS,justifyContent:'center'}}>Cancel</button><button disabled={busy} onClick={save} style={{...bP,justifyContent:'center',opacity:busy?0.65:1}}>{busy?'Saving...':'Save changes'}</button></div>
    </div>
  </div>;
}
function FinanceExpensesTab({mE,fil,rec,pend,mT,tva,pct,bycat,isMobile,filterCat,setFilterCat,search,setSearch,setShowAdd,setShowSubmitSummary,submitted,deleteExpense,setViewer,month,setMonth,periodMode,setPeriodMode,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts,ML,setTab,setExpenses}){
  const receiptCount=fil.filter(e=>fwFinanceReceiptValue(e)).length;
  const periodReceiptCount=mE.filter(e=>fwFinanceReceiptValue(e)).length;
  const [downloadingReceipts,setDownloadingReceipts]=useState(false);
  const [editing,setEditing]=useState(null);
  const submittedAt=(mE.find(e=>e.submittedAt)||{}).submittedAt||null;
  const submissionStatus=fwFinanceMonthStatus(month,mE);
  const issues=mE.flatMap(e=>fwFinanceIssueList(e).map(issue=>({expense:e,...issue})));
  const cardRows=Object.entries(mE.reduce((acc,e)=>{const label=fwFinanceCardLabel(e);acc[label]=(acc[label]||0)+fwFinanceAmount(e.amountCHF||e.amount);return acc;},{})).sort((a,b)=>b[1]-a[1]);
  const issueTone=tone=>tone==='red'?{bg:'var(--rl)',color:'var(--red)'}:tone==='amber'?{bg:'var(--aml)',color:'var(--amber)'}:{bg:'var(--s2)',color:'var(--t2)'};
  const saveEdited=updated=>{if(updated&&setExpenses)setExpenses(prev=>prev.map(item=>String(item.id)===String(updated.id)?updated:item));};
  return <div style={{maxWidth:1120,paddingBottom:isMobile?180:40}}>
    <FinanceMonthPicker periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts} isMobile={isMobile}/>
    <div style={{marginBottom:18}}><h1 style={{fontSize:isMobile?24:28,fontWeight:900,marginBottom:4}}>Expense review</h1><div style={{fontSize:13,color:'var(--t3)'}}>{periodLabelFor(periodMode,month,periodFrom,periodTo)+' · '+fil.length+' visible expenses · '+receiptCount+' receipts'}</div></div>
    <div style={{background:submissionStatus==='submitted'?'var(--gl)':'#fff',border:'0.5px solid '+(submissionStatus==='submitted'?'#BDEAD9':'var(--border)'),borderRadius:14,padding:isMobile?14:16,marginBottom:14,display:'flex',justifyContent:'space-between',gap:12,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row'}}>
      <div><div style={{fontSize:16,fontWeight:900,color:submissionStatus==='submitted'?'var(--green)':'var(--text)'}}>{submissionStatus==='submitted'?'Submitted package':'Month not submitted'}</div><div style={{fontSize:12,color:'var(--t3)',marginTop:3}}>{submittedAt?'Submitted '+fd(submittedAt.slice(0,10))+' · ':''}{mE.length} expenses · CHF {fmt(mT)}</div></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button onClick={()=>setTab&&setTab('finance')} style={{...bS,justifyContent:'center'}}>Back inbox</button><button onClick={()=>setShowAdd(true)} style={{...bS,justifyContent:'center'}}>+ Add expense</button><button onClick={()=>fwDownloadFinanceCsv(mE,ML)} style={{...bS,justifyContent:'center'}}>Export CSV</button><button disabled={periodReceiptCount===0||downloadingReceipts} onClick={()=>downloadFinanceReceiptsZip(mE,ML,setDownloadingReceipts)} style={{...bP,justifyContent:'center',opacity:(periodReceiptCount===0||downloadingReceipts)?0.55:1}}>{downloadingReceipts?'ZIP...':'Receipt ZIP ('+periodReceiptCount+')'}</button></div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:14}}>
      {[{l:'Total',v:'CHF '+fmt(mT),s:mE.length+' expenses',c:'var(--text)'},{l:'VAT',v:'CHF '+fmt(tva),s:'recoverable',c:'var(--text)'},{l:'Receipts',v:periodReceiptCount+'/'+mE.length,s:mE.length-periodReceiptCount+' missing',c:periodReceiptCount===mE.length?'var(--green)':'var(--amber)'},{l:'Issues',v:issues.length,s:'to review',c:issues.length?'var(--amber)':'var(--green)'}].map(k=><div key={k.l} style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:12,padding:14}}><div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.05em',marginBottom:6}}>{k.l.toUpperCase()}</div><div style={{fontSize:21,fontWeight:900,fontFamily:'DM Mono',color:k.c}}>{k.v}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:3}}>{k.s}</div></div>)}
    </div>
    <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 320px',gap:14,alignItems:'start'}}>
      <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
        <div style={{padding:14,borderBottom:'0.5px solid var(--border)',display:'grid',gap:10}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search merchant, amount, receipt..." style={{...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'10px 12px'}}/><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{[{id:'all',label:'All',icon:''},...CATS].map(c=><button key={c.id} onClick={()=>setFilterCat(c.id)} style={{padding:'7px 13px',borderRadius:20,fontSize:12,cursor:'pointer',border:filterCat===c.id?'2px solid var(--accent)':'0.5px solid var(--border)',background:filterCat===c.id?'var(--al)':'#fff',color:filterCat===c.id?'var(--accent)':'var(--t2)',fontWeight:filterCat===c.id?800:600}}>{c.icon?c.icon+' '+c.label:c.label}</button>)}</div></div>
        {fil.length===0?<div style={{padding:42,textAlign:'center',color:'var(--t3)'}}>No expenses for this period.</div>:fil.map((e,i)=>{const rowIssues=fwFinanceIssueList(e);return <div key={e.id} style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'92px 1fr 118px 166px',gap:12,alignItems:'center',padding:14,borderBottom:i<fil.length-1?'0.5px solid var(--border)':'none'}}>
          <div style={{fontSize:12,color:'var(--t3)'}}>{fd(e.date)}</div>
          <div style={{minWidth:0}}><div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><span style={{fontWeight:900,fontSize:14}}>{e.merchant}</span><Badge status={e.status}/><span style={{fontSize:10,fontWeight:900,background:'var(--al)',color:'var(--accent)',borderRadius:999,padding:'3px 7px'}}>{fwFinanceCardLabel(e)}</span></div><div style={{fontSize:12,color:'var(--t3)',marginTop:4}}>{(CMAP[e.category]&&CMAP[e.category].label)||e.category}{cleanPaymentCardNote(e.note)&&' · '+cleanPaymentCardNote(e.note)}</div><div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:7}}>{rowIssues.length===0?<span style={{fontSize:10,fontWeight:900,background:'var(--gl)',color:'var(--green)',borderRadius:999,padding:'3px 7px'}}>OK</span>:rowIssues.map((issue,idx)=>{const t=issueTone(issue.tone);return <span key={idx} style={{fontSize:10,fontWeight:900,background:t.bg,color:t.color,borderRadius:999,padding:'3px 7px'}}>{issue.label}</span>})}</div></div>
          <div style={{fontFamily:'DM Mono',fontWeight:900,textAlign:isMobile?'left':'right'}}>CHF {fmt(e.amountCHF||e.amount)}<div style={{fontSize:11,color:'var(--t3)',fontWeight:600}}>VAT {fmt(e.tva||0)}</div></div>
          <div style={{display:'flex',gap:8,justifyContent:isMobile?'flex-start':'flex-end',alignItems:'center',flexWrap:'wrap'}}><Thumb path={fwFinanceReceiptValue(e)} name={e.receiptName||'receipt'} onView={fwFinanceReceiptValue(e)?()=>setViewer({path:fwFinanceReceiptValue(e),name:e.receiptName||'receipt'}):null}/><button onClick={()=>setEditing(e)} style={{...bS,padding:'7px 10px',fontSize:12}}>Edit</button><button onClick={()=>deleteExpense(e.id,fwFinanceReceiptValue(e))} style={{...bS,padding:'7px 10px',fontSize:12,color:'var(--red)',borderColor:'#F3C6C6'}}>Delete</button></div>
        </div>})}
      </div>
      <div style={{display:'grid',gap:12}}>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:16}}><div style={{fontSize:15,fontWeight:900,marginBottom:10}}>Anomaly panel</div>{issues.length===0?<div style={{fontSize:13,color:'var(--green)',background:'var(--gl)',borderRadius:12,padding:12,fontWeight:800}}>No anomaly detected for this month.</div>:issues.slice(0,9).map((issue,i)=>{const t=issueTone(issue.tone);return <div key={i} style={{display:'grid',gap:3,padding:'9px 0',borderBottom:i<Math.min(issues.length,9)-1?'0.5px solid var(--border)':'none'}}><div style={{fontSize:12,fontWeight:900,color:t.color}}>{issue.label}</div><div style={{fontSize:12,color:'var(--t3)'}}>{fd(issue.expense.date)} · {issue.expense.merchant} · CHF {fmt(issue.expense.amountCHF||issue.expense.amount)}</div></div>})}</div>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:16}}><div style={{fontSize:15,fontWeight:900,marginBottom:10}}>By card</div>{cardRows.map(([label,total],i)=><div key={label} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'8px 0',borderBottom:i<cardRows.length-1?'0.5px solid var(--border)':'none'}}><span style={{fontSize:13,fontWeight:800}}>{label}</span><span style={{fontFamily:'DM Mono',fontWeight:900,fontSize:13}}>CHF {fmt(total)}</span></div>)}</div>
      </div>
    </div>
    {editing&&<FinanceEditExpenseModal expense={editing} onClose={()=>setEditing(null)} onSaved={saveEdited} setViewer={setViewer}/>}
  </div>;
}
`;
      html = html.replace(/function FinanceDashboardTab\([\s\S]*?function safeZipPart/, financeWorkbench + '\nfunction safeZipPart');
      html = html.replace(/function FinanceExpensesTab\([\s\S]*?\n\}\nfunction hardHideStatsPeriodSelector/, 'function hardHideStatsPeriodSelector');
      const zipHelperIndex=html.indexOf('function safeZipPart');
      const oldFinanceExpensesIndex=html.indexOf('function FinanceExpensesTab', zipHelperIndex);
      const appMarkerIndex=html.indexOf('const NOTESFRAIS_FINANCE_SUBMISSIONS_TEST_V5', oldFinanceExpensesIndex);
      const appFunctionIndex=html.indexOf('function App(){', oldFinanceExpensesIndex);
      const oldFinanceEndIndex=appMarkerIndex>=0?appMarkerIndex:appFunctionIndex;
      if(oldFinanceExpensesIndex>=0&&oldFinanceEndIndex>oldFinanceExpensesIndex){
        html=html.slice(0,oldFinanceExpensesIndex)+html.slice(oldFinanceEndIndex);
      }
      html = html.replace(/monthCounts=\{monthCounts\} ML=\{ML\} setTab=\{setTab\}\/>(?=\})/, 'monthCounts={monthCounts} ML={ML} setTab={setTab} setExpenses={setExpenses}/>');
      html = html.replace(/window\.notesExpensesRole/g, 'window.notesFraisRole');
    }
    if(false&&!html.includes('notesfrais-finance-capture-hide')){
      html = html.replace('</body>', `<script id="notesfrais-finance-capture-hide">(function(){
function hideFinanceCaptureActions(){
  const bodyText=document.body?document.body.innerText||'':'';
  const isFinanceView=window.notesFraisRole==='finance'||/FINANCE WORKBENCH|Submitted packages|💼 Finance|\\bFinance\\b/.test(bodyText);
  if(!isFinanceView)return;
  document.querySelectorAll('button').forEach(btn=>{
    const text=(btn.textContent||'').trim();
    if(/Import relev/i.test(text)||/Scan receipt/i.test(text)){
      btn.style.display='none';
      btn.setAttribute('aria-hidden','true');
    }
  });
}
setInterval(hideFinanceCaptureActions,500);
window.addEventListener('focus',hideFinanceCaptureActions);
setTimeout(hideFinanceCaptureActions,300);
})();</script></body>`);
    }
    return html;
  };
})();
