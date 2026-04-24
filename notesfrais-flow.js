(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_DRAFT_KEY')) return html;

    const draftHelpers = String.raw`
const NOTESFRAIS_DRAFT_KEY='notesfrais:add-draft:v1';
function saveExpenseDraft(form){try{localStorage.setItem(NOTESFRAIS_DRAFT_KEY,JSON.stringify({form,ts:Date.now()}));}catch(e){}}
function loadExpenseDraft(){try{const raw=localStorage.getItem(NOTESFRAIS_DRAFT_KEY);if(!raw)return null;const d=JSON.parse(raw);if(!d||!d.form||Date.now()-Number(d.ts||0)>7*86400000)return null;return d.form;}catch(e){return null;}}
function clearExpenseDraft(){try{localStorage.removeItem(NOTESFRAIS_DRAFT_KEY);}catch(e){}}
`;
    html = html.replace('const lbl={display:', draftHelpers + '\nconst lbl={display:');

    html = html.replace(
      `  const [form,setForm]=useState({merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',note:''});`,
      `  const [form,setForm]=useState(()=>loadExpenseDraft()||{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',note:''});
  useEffect(()=>{saveExpenseDraft(form);},[form]);`
    );

    html = html.replace(/onClose\(\);/g, `clearExpenseDraft();onClose();`);
    html = html.replace(
      `<button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t2)',fontSize:24,lineHeight:1}}>×</button>`,
      `<button onClick={()=>{saveExpenseDraft(form);onClose();}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--t2)',fontSize:24,lineHeight:1}}>×</button>`
    );
    html = html.replace(
      `<button onClick={onClose} style={{...bS,justifyContent:'center'}}>Annuler</button>`,
      `<button onClick={()=>{saveExpenseDraft(form);onClose();}} style={{...bS,justifyContent:'center'}}>Garder en brouillon</button>`
    );

    html = html.replace(
      `  const [showAdd,setShowAdd]=useState(false);`,
      `  const [showAdd,setShowAdd]=useState(false);
  const [quickAdd,setQuickAdd]=useState(false);`
    );
    html = html.replace(
      `const addExpense=useCallback(async(e)=>{setSyncing(true);try{const s=await insertExpense(e);setExpenses(p=>[s,...p]);notify('✅ Frais enregistré !');}catch(e){notify('❌ '+e.message);}finally{setSyncing(false);}},[]);`,
      `const addExpense=useCallback(async(e)=>{setSyncing(true);try{const s=await insertExpense(e);setExpenses(p=>[s,...p]);notify('✅ Frais enregistré !');setQuickAdd(true);}catch(e){notify('❌ '+e.message);}finally{setSyncing(false);}},[]);`
    );
    html = html.replace(
      `window.addEventListener('notesfrais-offline-queued',()=>{refresh();notify('📴 Frais gardé sur cet iPhone. Sync dès retour internet.');});`,
      `window.addEventListener('notesfrais-offline-queued',()=>{refresh();setQuickAdd(true);notify('📴 Frais gardé sur cet iPhone. Sync dès retour internet.');});`
    );
    html = html.replace(
      `{showUBS&&<UBSModal onClose={()=>setShowUBS(false)} onImport={handleUBS}/>}
      {showAdd&&<AddModal`,
      `{quickAdd&&<div style={{position:'fixed',left:isMobile?14:'50%',right:isMobile?14:'auto',bottom:isMobile?'calc(92px + env(safe-area-inset-bottom))':24,transform:isMobile?'none':'translateX(-50%)',background:'#111',color:'#fff',borderRadius:18,padding:'12px 14px',zIndex:2200,boxShadow:'0 16px 44px rgba(0,0,0,0.24)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,minWidth:isMobile?'auto':360}}><div><div style={{fontWeight:700,fontSize:13}}>Frais gardé</div><div style={{fontSize:12,opacity:.72}}>Tu peux scanner le suivant.</div></div><button onClick={()=>{setQuickAdd(false);setShowAdd(true);}} style={{...bP,padding:'9px 12px',fontSize:12}}>Scanner un autre</button><button onClick={()=>setQuickAdd(false)} style={{background:'transparent',border:0,color:'#fff',fontSize:18,cursor:'pointer'}}>×</button></div>}
      {showUBS&&<UBSModal onClose={()=>setShowUBS(false)} onImport={handleUBS}/>}
      {showAdd&&<AddModal`
    );

    html = html.replace(
      `const [filterCat,setFilterCat]=useState('all');`,
      `const [filterCat,setFilterCat]=useState('all');
  const [search,setSearch]=useState('');`
    );
    html = html.replace(
      `const fil=useMemo(()=>mE.filter(e=>filterCat==='all'||e.category===filterCat),[mE,filterCat]);`,
      `const fil=useMemo(()=>mE.filter(e=>filterCat==='all'||e.category===filterCat).filter(e=>{const q=search.trim().toLowerCase();if(!q)return true;return [e.merchant,e.note,e.category,e.amountCHF,e.amount,e.receiptName].join(' ').toLowerCase().includes(q);}),[mE,filterCat,search]);`
    );
    html = html.replace(
      `</div><div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>{[{id:'all',label:'Tous',icon:''},...CATS].map(c=>`,
      `<div style={{marginBottom:12}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un reçu, montant, commerçant..." style={{...inp,background:'#fff',fontSize:isMobile?16:13,padding:isMobile?'12px 14px':'9px 12px'}}/></div><div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>{[{id:'all',label:'Tous',icon:''},...CATS].map(c=>`
    );

    return html;
  };
})();
