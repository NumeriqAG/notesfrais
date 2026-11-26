(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_DESK_WORKSPACE_V1')) return html;

    // Une vraie version ordinateur pour Mike (nov. 2026).
    //
    // Jusqu'ici, l'ordinateur affichait la mise en page de l'iPhone elargie :
    // une colonne de 1100 px au milieu d'un ecran de 1900, beaucoup de vide,
    // et chaque recu ne se voyait qu'en ouvrant une fenetre. Thomas : « on a
    // plus d'espace et de possibilites, autant les utiliser a fond ».
    //
    // Sur un ecran d'au moins 1100 px, l'onglet Expenses de Mike devient un
    // espace de travail qui occupe toute la hauteur :
    // - en haut, la periode (« August 2026 ⌄ », fleches mois precedent et
    //   suivant), « Add receipts » et la soumission ;
    // - un bandeau compact du mois : total, TVA, justificatifs, releve, statut ;
    // - a gauche, la liste des frais en tableau (tri, recherche, categories,
    //   filtres « No receipt », « To fix », « Not matched »), fleches du clavier ;
    // - a droite, le frais selectionne : le justificatif EN GRAND (PDF ou
    //   photo, plusieurs pages), sa fiche, le fil de la finance, Edit / Fix /
    //   Delete. Sur tres grand ecran, recu et fiche se mettent cote a cote.
    //
    // Entre 860 et 1100 px, l'ancienne mise en page ordinateur reste. L'iPhone
    // et la finance ne changent pas. La soumission reutilise le code exact du
    // bouton existant (extrait ci-dessous), pas une copie.
    //
    // Les PDF ne peuvent pas s'afficher depuis l'URL signee R2 : la CSP
    // n'autorise les cadres que depuis 'self' et blob:. On les lit donc par
    // /api/receipts?raw=1 (meme origine, meme controle d'acces) et on les
    // affiche en blob:.
    //
    // Charge apres desktop.js, en anglais ; chaque cible manquante leve une
    // erreur au lieu d'un no-op silencieux.
    const rep = (label, target, replacement, count = 1) => {
      const n = html.split(target).length - 1;
      if(n !== count) throw new Error('desk-workspace: cible '+label+' trouvee '+n+' fois au lieu de '+count);
      html = html.split(target).join(replacement);
    };

    // ── 0. Le code de soumission du bouton existant, sans le recopier ──────
    const S0 = "onClick={async()=>{if(mE.length===0||syncing||mE.some(e=>e.submissionStatus==='submitted'))return;";
    const S1 = "}} style={{...bP,justifyContent:'center',minWidth:isMobile?'100%':210";
    if(html.split(S0).length !== 2 || html.split(S1).length !== 2) throw new Error('desk-workspace: bouton de soumission introuvable');
    const i0 = html.indexOf(S0) + 'onClick={async()=>{'.length;
    const i1 = html.indexOf(S1);
    if(i1 <= i0) throw new Error('desk-workspace: bouton de soumission dans le desordre');
    const submitBody = html.slice(i0, i1);
    if(!submitBody.includes("/api/monthly-submission")) throw new Error('desk-workspace: la soumission ne passe plus par /api/monthly-submission');

    // ── 1. Les composants ──────────────────────────────────────────────────
    rep('App', '\nfunction App(){', String.raw`
// NOTESFRAIS_DESK_WORKSPACE_V1 : l'espace de travail de Mike sur ordinateur.
const NF_WS_TINT={repas:['#E5F3EA','#17663F'],transport:['#E6F1FA','#0F5E92'],hotel:['#FDF0E3','#A04A06'],materiel:['#EEEAF7','#5B4B8A'],autre:['#EEF1F4','#5B6875']};
function NfWsIcon({name,size=18}){
  const P={
    repas:<><path d="M7 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3"/><path d="M9 12v9"/><path d="M17 21V3c-2 1.2-3 3.6-3 6.5V13h3"/></>,
    transport:<><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14"/><path d="M8.5 13.2h.01M15.5 13.2h.01"/><path d="M8 19l-2 2.5M16 19l2 2.5"/></>,
    hotel:<><path d="M3 6v14"/><path d="M3 16h18v4"/><path d="M21 16v-3.5A3.5 3.5 0 0 0 17.5 9H11v7"/><circle cx="7" cy="12" r="2"/></>,
    materiel:<><rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19.5h20"/></>,
    autre:<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></>,
    expenses:<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
    stats:<><path d="M5 20V11M12 20V4M19 20v-6"/></>,
    recon:<><path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/></>,
    upload:<><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    open:<><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></>,
    trash:<><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></>,
    edit:<><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></>,
    search:<><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></>,
    chevL:<><path d="M15 5l-7 7 7 7"/></>,
    chevR:<><path d="M9 5l7 7-7 7"/></>,
    chevD:<><path d="M6 9l6 6 6-6"/></>,
    clip:<><path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1L13 4.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4L14.5 7.4"/></>,
    check:<><path d="M5 12.5l4.5 4.5L19 7.5"/></>,
    plus:<><path d="M12 5v14M5 12h14"/></>,
    chat:<><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/></>,
    logout:<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{flex:'none',display:'block'}}>{P[name]||P.autre}</svg>;
}
function NfWsCat({cat,size=34}){
  const t=NF_WS_TINT[cat]||NF_WS_TINT.autre;
  return <span className="nfw-cat" style={{width:size,height:size,background:t[0],color:t[1]}} title={(CMAP[cat]&&CMAP[cat].label)||'Other'}><NfWsIcon name={NF_WS_TINT[cat]?cat:'autre'} size={Math.round(size*0.52)}/></span>;
}
function nfWsDay(date){
  const d=new Date(String(date||'')+'T12:00:00');
  return isNaN(d)?(date||'—'):d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
}
function nfWsHasReceipt(e){return receiptItemsForExpense(e).length>0;}
function nfWsMatched(e){return !!(e&&(e.ubsRow||e.status==='reconciled'));}
function nfWsModalOpen(){
  return !!document.querySelector('[role="dialog"],[data-nf-delete-confirm],[data-nf-period-sheet],.nf-desk-overlay')||
    [...document.querySelectorAll('div[style*="position: fixed"]')].some(el=>/inset: 0/.test(el.getAttribute('style')||''));
}

// Le justificatif en grand : photo (URL signee) ou PDF (blob: via raw=1).
function NfDeskReceipt({expense,setViewer,canEdit,onEdit}){
  const items=receiptItemsForExpense(expense);
  const [idx,setIdx]=useState(0);
  const [src,setSrc]=useState(null);
  const [err,setErr]=useState('');
  const [zoom,setZoom]=useState(false);
  useEffect(()=>{setIdx(0);setZoom(false);},[expense.id]);
  const item=items[Math.min(idx,Math.max(0,items.length-1))]||null;
  const path=item&&item.path;
  const pdf=!!item&&isPDF(String(item.path||'')+' '+String(item.name||''));
  useEffect(()=>{
    let live=true,made=null;
    setSrc(null);setErr('');
    if(!path)return;
    (async()=>{
      try{
        if(pdf){
          const qs=new URLSearchParams({path,name:item.name||'receipt.pdf',raw:'1'});
          const r=await fetch('/api/receipts?'+qs.toString(),{credentials:'same-origin'});
          if(!r.ok)throw new Error('HTTP '+r.status);
          const b=await r.blob();
          made=URL.createObjectURL(new Blob([b],{type:'application/pdf'}));
          if(live)setSrc(made);
        }else{
          const u=await getReceiptUrl(path,false,item.name||'receipt');
          if(!u)throw new Error('no url');
          if(live)setSrc(u);
        }
      }catch(e){if(live)setErr('The receipt could not be loaded.');}
    })();
    return()=>{live=false;if(made)setTimeout(()=>{try{URL.revokeObjectURL(made);}catch(_){}} ,1000);};
  },[path,pdf]);
  if(!items.length)return <div className="nfw-rc nfw-rc-empty" data-nf-ws-receipt="none">
    <div className="nfw-rc-empty-ico"><NfWsIcon name="clip" size={26}/></div>
    <b>No receipt attached</b>
    <span>{canEdit?'Attach the PDF or photo so finance can check it.':'This expense has no receipt.'}</span>
    {canEdit&&<button type="button" className="nfw-btn nfw-btn-ghost" onClick={onEdit}>Attach a receipt</button>}
  </div>;
  const openFull=()=>{
    if(pdf){
      if(src){window.open(src,'_blank','noopener');return;}
      // Repli (PDF trop lourd pour raw=1, reseau) : l'URL signee dans un
      // nouvel onglet. L'onglet s'ouvre tout de suite, pendant le clic, sinon
      // le navigateur le bloquerait comme une fenetre surgissante.
      const w=window.open('','_blank');
      getReceiptUrl(item.path,false,item.name||'receipt.pdf').then(u=>{if(w&&u){w.opener=null;w.location.href=u;}else if(w)w.close();}).catch(()=>{if(w)w.close();});
      return;
    }
    if(items.length>1)setViewer({items,index:idx,name:expense.merchant||'Receipts'});
    else setViewer({url:item.path,path:item.path,name:item.name||'receipt'});
  };
  return <div className={'nfw-rc'+(pdf?' nfw-rc-pdf':'')} data-nf-ws-receipt={pdf?'pdf':'image'}>
    <div className="nfw-rc-bar">
      <span className="nfw-rc-name" title={item.name||''}>{item.name||(pdf?'Receipt.pdf':'Receipt')}</span>
      {items.length>1&&<span className="nfw-rc-pager">
        <button type="button" aria-label="Previous receipt" disabled={idx===0} onClick={()=>setIdx(i=>Math.max(0,i-1))}><NfWsIcon name="chevL" size={14}/></button>
        <span>{(idx+1)+' / '+items.length}</span>
        <button type="button" aria-label="Next receipt" disabled={idx>=items.length-1} onClick={()=>setIdx(i=>Math.min(items.length-1,i+1))}><NfWsIcon name="chevR" size={14}/></button>
      </span>}
      <button type="button" className="nfw-rc-open" onClick={openFull} disabled={pdf&&!src&&!err} title="Open in full size"><NfWsIcon name="open" size={14}/><span>Open</span></button>
    </div>
    <div className={'nfw-rc-view'+(zoom?' nfw-rc-zoom':'')}>
      {err?<div className="nfw-rc-msg">{err}</div>
        :!src?<div className="nfw-rc-msg">Loading the receipt…</div>
        :pdf?<iframe title="Receipt" src={src+'#view=FitH&toolbar=0&navpanes=0'}/>
        :<img src={src} alt="Receipt" onClick={()=>setZoom(z=>!z)} title={zoom?'Fit to the panel':'Zoom in'}/>}
    </div>
  </div>;
}

function NfDeskDetail({expense,ubsLoaded,onEdit,onDelete,setViewer,onUpdated}){
  const e=expense;
  const closed=e.submissionStatus==='submitted';
  const canFix=closed&&e.reviewStatus==='to_fix';
  const canEdit=!closed||canFix;
  const cat=CMAP[e.category]||CMAP.autre||{label:'Other'};
  const card=getPaymentCardLabel(e.note);
  const note=cleanPaymentCardNote(e.note);
  const thread=nfCommentsOf(e).filter(c=>c.kind!=='status');
  const foreign=nfIsForeign(e);
  const facts=[
    ['Date',nfLongDate(e.date)],
    ['Category',cat.label],
    card&&['Paid with',card],
    ['VAT',e.tva>0?((foreign?e.currency:'CHF')+' '+fmt(e.tva)):'None'],
    foreign&&['Original amount',nfOriginalAmount(e)],
    note&&['Note',note],
    ['Statement',e.ubsRow?('Matched · '+e.ubsRow.label):nfWsMatched(e)?'Matched':ubsLoaded?'No match in the statement':'Not imported yet']
  ].filter(Boolean);
  return <div className="nfw-dt" data-nf-ws-detail={String(e.id)}>
    <div className="nfw-dt-head">
      <NfWsCat cat={e.category} size={44}/>
      <div className="nfw-dt-title">
        <div className="nfw-dt-merchant" title={e.merchant||''}>{e.merchant||'Expense'}</div>
        <div className="nfw-dt-sub">{nfLongDate(e.date)+' · '+cat.label}</div>
      </div>
      <div className="nfw-dt-amt">
        <div className="nfw-dt-chf">{'CHF '+fmt(e.amountCHF||e.amount)}</div>
        {foreign&&<div className="nfw-dt-orig">{nfOriginalAmount(e)}</div>}
      </div>
    </div>
    <div className="nfw-dt-actions">
      {!closed&&<button type="button" className="nfw-btn nfw-btn-ghost" data-nf-act="edit" onClick={()=>onEdit(e)}><NfWsIcon name="edit" size={15}/>Edit</button>}
      {canFix&&<button type="button" className="nfw-btn nfw-btn-warn" data-nf-act="fix" onClick={()=>onEdit(e)}><NfWsIcon name="edit" size={15}/>Fix this expense</button>}
      <span className="nfw-dt-comments"><NfWsIcon name="chat" size={15}/><NfCommentsButton expense={e} onUpdated={onUpdated}/></span>
      <span style={{flex:1}}/>
      {closed&&!canFix&&<span className="nfw-dt-lock">With finance · read only</span>}
      {!closed&&<button type="button" className="nfw-icon-btn nfw-del" data-nf-act="delete" title="Delete this expense" aria-label="Delete this expense" onClick={()=>onDelete(e)}><NfWsIcon name="trash" size={17}/></button>}
    </div>
    {canFix&&<div className="nfw-dt-tofix"><b>Finance asked for a change.</b> Fix the expense, then reply in the thread.</div>}
    <div className="nfw-dt-body">
      <NfDeskReceipt expense={e} setViewer={setViewer} canEdit={canEdit} onEdit={()=>onEdit(e)}/>
      <div className="nfw-dt-side">
        <div className="nfw-dt-facts">{facts.map(([k,v])=><div key={k} className="nfw-dt-fact"><span>{k}</span><b className={k==='Statement'&&nfWsMatched(e)?'nfw-ok':''}>{v}</b></div>)}</div>
        <div className="nfw-dt-thread">
          <div className="nfw-dt-thread-h"><span>Finance thread</span>{(e.reviewStatus==='to_fix'||thread.length>0)&&<NfReviewChips expense={e}/>}</div>
          {thread.length===0?<div className="nfw-dt-thread-empty">No messages. Finance writes here when something needs a change.</div>
            :<div className="nfw-dt-msgs">{thread.slice(-4).map(c=><div key={c.id||c.at} className={'nfw-msg'+(c.role==='finance'?' nfw-msg-fin':' nfw-msg-me')}><div className="nfw-msg-h"><b>{nfCommentAuthor(c)}</b><span>{nfCommentTime(c.at)}</span></div><div className="nfw-msg-b">{c.body}</div></div>)}</div>}
        </div>
      </div>
    </div>
  </div>;
}

function NfDeskWorkspace(p){
  const {mE,fil,filterCat,setFilterCat,search,setSearch,month,setMonth,periodMode,periodFrom,periodTo,setPeriodFrom,setPeriodTo,ML,mT,tva,ubsLoaded,syncing,submissionStatus,reviews,setShowAdd,setShowUBS,setEditingExpense,deleteExpense,setViewer,setExpenses,onSubmit,submissionStep}=p;
  const [sel,setSel]=useState(null);
  const [flag,setFlag]=useState('all');
  const [sort,setSort]=useState({k:'date',d:-1});
  const fileRef=useRef(null);
  const listRef=useRef(null);
  const counts={
    all:fil.length,
    missing:fil.filter(e=>!nfWsHasReceipt(e)).length,
    fix:fil.filter(e=>e.reviewStatus==='to_fix').length,
    unmatched:fil.filter(e=>!nfWsMatched(e)).length
  };
  const shown=useMemo(()=>{
    const l=fil.filter(e=>flag==='missing'?!nfWsHasReceipt(e):flag==='fix'?e.reviewStatus==='to_fix':flag==='unmatched'?!nfWsMatched(e):true);
    const val=e=>sort.k==='amount'?Number(e.amountCHF||e.amount||0):sort.k==='merchant'?String(e.merchant||'').toLowerCase():String(e.date||'');
    return [...l].sort((a,b)=>{const x=val(a),y=val(b);const c=x<y?-1:x>y?1:(Number(a.id)||0)-(Number(b.id)||0);return c*sort.d;});
  },[fil,flag,sort]);
  const selected=shown.find(e=>String(e.id)===String(sel))||null;
  useEffect(()=>{if(!selected&&shown.length)setSel(shown[0].id);},[shown,selected]);
  const nav=useRef({shown,sel});nav.current={shown,sel};
  useEffect(()=>{
    const onKey=ev=>{
      if(ev.altKey||ev.ctrlKey||ev.metaKey||ev.defaultPrevented)return;
      if(ev.key!=='ArrowDown'&&ev.key!=='ArrowUp')return;
      const t=ev.target;
      if(t&&t.closest&&t.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(nfWsModalOpen())return;
      const {shown:l,sel:s}=nav.current;if(!l.length)return;
      ev.preventDefault();
      const i=l.findIndex(e=>String(e.id)===String(s));
      const n=l[Math.max(0,Math.min(l.length-1,(i<0?0:i)+(ev.key==='ArrowDown'?1:-1)))];
      setSel(n.id);
      setTimeout(()=>{const row=listRef.current&&listRef.current.querySelector('[data-nf-ws-row="'+n.id+'"]');if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'});},0);
    };
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);

  const monthMode=periodMode==='month';
  const mi=MONTHS.findIndex(m=>m.v===month);
  const goMonth=d=>{const m=MONTHS[mi+d];if(!m)return;setMonth(m.v);setPeriodFrom(m.v);setPeriodTo(m.v);};
  const title=typeof nfPeriodTitle==='function'?nfPeriodTitle(periodMode,month,periodFrom,periodTo):ML;
  const withR=mE.filter(nfWsHasReceipt).length;
  const missing=mE.length-withR;
  const matched=mE.filter(nfWsMatched).length;
  const closed=monthMode&&mE.length>0&&mE.some(e=>e.submissionStatus==='submitted');
  const review=monthMode?(reviews[month]||null):null;
  const state=nfMonthReviewState(review,submissionStatus==='submitted');
  const foreignN=mE.filter(nfIsForeign).length;
  const onUpdated=upd=>setExpenses(prev=>prev.map(item=>String(item.id)===String(upd.id)?{...item,comments:upd.comments,reviewStatus:upd.reviewStatus}:item));
  const pick=()=>fileRef.current&&fileRef.current.click();
  const sortBy=k=>setSort(s=>s.k===k?{k,d:-s.d}:{k,d:k==='merchant'?1:-1});
  const arrow=k=>sort.k===k?(sort.d>0?' ↑':' ↓'):'';
  const shownTotal=shown.reduce((t,e)=>t+(Number(e.amountCHF||e.amount)||0),0);
  const FLAGS=[['all','All'],['missing','No receipt'],['fix','To fix'],['unmatched','Unmatched']].filter(([k])=>k==='all'||counts[k]>0||flag===k);

  return <div data-nf-ws="true" className="nfw">
    <div className="nfw-top">
      <div className="nfw-period">
        <div className="nfw-over">Expenses</div>
        <div className="nfw-period-row">
          <button type="button" className="nfw-period-title" data-nf-ws-period="true" onClick={()=>window.dispatchEvent(new Event('nf-period-open'))} title="Choose a period"><h1>{title}</h1><NfWsIcon name="chevD" size={20}/></button>
          {monthMode&&<span className="nfw-period-nav">
            <button type="button" aria-label="Previous month" disabled={mi<=0} onClick={()=>goMonth(-1)}><NfWsIcon name="chevL" size={16}/></button>
            <button type="button" aria-label="Next month" disabled={mi<0||mi>=MONTHS.length-1} onClick={()=>goMonth(1)}><NfWsIcon name="chevR" size={16}/></button>
          </span>}
        </div>
      </div>
      <div className="nfw-top-actions">
        <span data-nf-desk-import="true" style={{display:'contents'}}>
          <input ref={fileRef} type="file" multiple accept="image/*,.pdf,application/pdf" style={{display:'none'}} onChange={ev=>{const l=[...(ev.target.files||[])];ev.target.value='';if(l.length)nfDeskFeed(l,()=>setShowAdd(true));}}/>
          <button type="button" className="nfw-btn nfw-btn-ghost" onClick={pick} title="PDFs or photos, several at once"><NfWsIcon name="upload" size={16}/>Add receipts</button>
        </span>
        <button type="button" className="nfw-btn nfw-btn-ghost" onClick={()=>setShowAdd(true)}><NfWsIcon name="plus" size={16}/>New expense</button>
        {monthMode&&(closed
          ?<span className="nfw-submitted" data-nf-ws-submitted="true"><NfWsIcon name="check" size={16}/>Submitted</span>
          :<button type="button" data-nf-ws-submit="true" className={'nfw-btn '+(missing>0?'nfw-btn-quiet':'nfw-btn-primary')} disabled={mE.length===0||syncing} onClick={onSubmit} title={missing>0?(missing+' receipt'+(missing>1?'s':'')+' missing'):'Send the month to finance'}>{syncing&&submissionStep?submissionStep:'Submit '+ML}</button>)}
      </div>
    </div>

    <NfdPushOptIn/>
    {monthMode&&<NfUserMonthReviewBanner review={review} submitted={submissionStatus==='submitted'} ML={ML}/>}

    <div className="nfw-kpis" data-nf-ws-kpis="true">
      <div className="nfw-kpi">
        <span className="nfw-k">{monthMode?'Total this month':'Total'}</span>
        <b className="nfw-v nfw-v-big">{'CHF '+fmt(mT)}</b>
        <span className="nfw-s">{mE.length+' expense'+(mE.length===1?'':'s')}</span>
      </div>
      <div className="nfw-kpi">
        <span className="nfw-k">VAT recoverable</span>
        <b className="nfw-v">{'CHF '+fmt(tva)}</b>
        <span className="nfw-s">{foreignN?'Excl. '+foreignN+' in foreign currency':'On CHF receipts'}</span>
      </div>
      <button type="button" className={'nfw-kpi nfw-kpi-go'+(flag==='missing'?' nfw-kpi-on':'')} onClick={()=>setFlag(f=>f==='missing'||!missing?'all':'missing')} disabled={!mE.length}>
        <span className="nfw-k">Receipts</span>
        <b className="nfw-v">{withR+' of '+mE.length}</b>
        <span className={'nfw-s '+(missing?'nfw-warn':mE.length?'nfw-ok':'')}>{!mE.length?'—':missing?(missing+' missing · show'):'All attached'}</span>
      </button>
      <button type="button" className="nfw-kpi nfw-kpi-go" data-nf-ubs-open={closed?undefined:'true'} onClick={()=>{if(!closed)setShowUBS(true);}} disabled={closed}>
        <span className="nfw-k">Card statement</span>
        <b className="nfw-v">{(ubsLoaded||matched>0)?(matched+' of '+mE.length+' matched'):closed?'—':'Not imported'}</b>
        {(ubsLoaded||matched>0)?<span className="nfw-track"><i style={{width:(mE.length?Math.round(matched/mE.length*100):0)+'%'}}/></span>:<span className="nfw-s nfw-link">{closed?'Month closed':'Import a statement ›'}</span>}
      </button>
      <div className="nfw-kpi">
        <span className="nfw-k">Status</span>
        <span className="nfw-v">{monthMode?<NfMonthReviewPill state={state}/>:<span className="nfw-s">Choose a month</span>}</span>
        <span className="nfw-s">{!monthMode?'to submit it':state==='open'?(!mE.length?'Nothing to submit yet':missing?'Receipts missing':'Ready to submit'):state==='submitted'?'Finance is checking it':state==='sent_back'?'Fix, then submit again':state==='approved'?'To be reimbursed':'Paid back'}</span>
      </div>
    </div>

    <div className="nfw-split">
      <section className="nfw-list" aria-label="Expenses">
        <div className="nfw-tools">
          <div className="nfw-flags" role="tablist">
            {FLAGS.map(([k,l])=><button key={k} type="button" role="tab" aria-selected={flag===k} data-nf-ws-flag={k} className={flag===k?'nfw-on':''} onClick={()=>setFlag(k)}>{l}<span>{counts[k]}</span></button>)}
          </div>
          <div className="nfw-search">
            <NfWsIcon name="search" size={15}/>
            <input value={search} onChange={ev=>setSearch(ev.target.value)} placeholder="Search merchant, amount, note…" aria-label="Search expenses"/>
          </div>
          <select className="nfw-catsel" value={filterCat} onChange={ev=>setFilterCat(ev.target.value)} aria-label="Category">
            <option value="all">All categories</option>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="nfw-thead" role="row">
          <button type="button" className="nfw-c-date" onClick={()=>sortBy('date')}>{'Date'+arrow('date')}</button>
          <span className="nfw-c-main"><button type="button" className="nfw-h-narrow" onClick={()=>sortBy('date')}>{'Date'+arrow('date')}</button><button type="button" onClick={()=>sortBy('merchant')}>{'Merchant'+arrow('merchant')}</button></span>
          <span className="nfw-c-card">Paid with</span>
          <span className="nfw-c-st">Statement</span>
          <span className="nfw-c-rc">Receipt</span>
          <button type="button" className="nfw-c-amt" onClick={()=>sortBy('amount')}>{'Amount'+arrow('amount')}</button>
        </div>
        <div className="nfw-rows" ref={listRef}>
          {shown.length===0?<div className="nfw-empty">
            {mE.length===0?<><b>{'No expenses in '+ML+' yet'}</b><span>Drop PDF invoices or photos anywhere on this page. Each one is read for you, then you check and confirm.</span></>
              :<><b>Nothing matches</b><span>No expense fits these filters.</span><button type="button" className="nfw-btn nfw-btn-ghost" onClick={()=>{setFlag('all');setSearch('');setFilterCat('all');}}>Clear filters</button></>}
          </div>:shown.map(e=>{
            const on=selected&&String(selected.id)===String(e.id);
            const card=getPaymentCardLabel(e.note);
            const note=cleanPaymentCardNote(e.note);
            const r=nfWsHasReceipt(e);
            const st=nfWsMatched(e);
            return <div key={e.id} role="row" tabIndex={-1} aria-selected={!!on} data-nf-ws-row={String(e.id)} className={'nfw-row'+(on?' nfw-sel':'')} onClick={()=>setSel(e.id)}>
              <span className="nfw-c-date">{nfWsDay(e.date)}</span>
              <span className="nfw-c-main">
                <NfWsCat cat={e.category}/>
                <span className="nfw-main-txt">
                  <span className="nfw-merchant">{e.merchant||'Expense'}</span>
                  <span className="nfw-sub">
                    <span className="nfw-sub-narrow">{nfWsDay(e.date)}{card?' · '+card:''}</span>
                    {note&&<span className="nfw-note">{note}</span>}
                    {(e.reviewStatus==='to_fix'||nfCommentsOf(e).length>0)&&<NfReviewChips expense={e}/>}
                    {e.submissionStatus==='submitted'&&e.reviewStatus!=='to_fix'&&<span className="nfw-chip nfw-chip-grey">Closed</span>}
                  </span>
                </span>
              </span>
              <span className="nfw-c-card">{card||<i className="nfw-dim">—</i>}</span>
              <span className="nfw-c-st">{st?<span className="nfw-chip nfw-chip-ok"><NfWsIcon name="check" size={12}/>Matched</span>:ubsLoaded?<span className="nfw-chip nfw-chip-amber">No match</span>:<i className="nfw-dim">—</i>}</span>
              <span className="nfw-c-rc" title={r?'Receipt attached':'No receipt'}>{r?<span className="nfw-rc-yes"><NfWsIcon name="clip" size={15}/></span>:<span className="nfw-rc-no">Missing</span>}</span>
              <span className="nfw-c-amt"><b>{'CHF '+fmt(e.amountCHF||e.amount)}</b>{nfIsForeign(e)&&<small>{nfOriginalAmount(e)}</small>}</span>
            </div>;
          })}
        </div>
        <div className="nfw-foot">
          <span>{shown.length+' expense'+(shown.length===1?'':'s')+(shown.length!==mE.length?' of '+mE.length:'')}</span>
          <span className="nfw-foot-hint">↑ ↓ to browse · drop receipts anywhere on the page</span>
          <b>{'CHF '+fmt(shownTotal)}</b>
        </div>
      </section>

      <section className="nfw-detail" aria-label="Selected expense">
        {selected?<NfDeskDetail key={selected.id} expense={selected} ubsLoaded={ubsLoaded} setViewer={setViewer} onUpdated={onUpdated}
          onEdit={x=>setEditingExpense(x)} onDelete={x=>deleteExpense(x.id,x.receiptPath||x.receiptUrl)}/>
          :<div className="nfw-drop" onClick={pick} role="button" tabIndex={0}>
            <div className="nfw-drop-ico"><NfWsIcon name="upload" size={30}/></div>
            <b>Drop your receipts here</b>
            <span>PDF invoices from email or portals, scans, photos. Several at once: each one is read for you, then you check and confirm.</span>
            <span className="nfw-drop-btns"><button type="button" className="nfw-btn nfw-btn-primary" onClick={ev=>{ev.stopPropagation();pick();}}>Choose files</button><button type="button" className="nfw-btn nfw-btn-ghost" onClick={ev=>{ev.stopPropagation();setShowAdd(true);}}>Enter one by hand</button></span>
          </div>}
      </section>
    </div>
  </div>;
}

function App(){`);

    // ── 2. Dans App : la soumission partagee, le seuil, la classe du body ──
    rep('isMobile App', '  const isMobile=viewportWidth<860;\n',
      "  const isMobile=viewportWidth<860;\n" +
      "  const nfDeskWide=!isMobile&&viewportWidth>=1100&&!!window.notesFraisRole&&window.notesFraisRole!=='finance';\n" +
      "  React.useEffect(()=>{document.body.classList.toggle('nf-desk-wide',nfDeskWide);},[nfDeskWide]);\n" +
      "  const nfDeskSubmit=async()=>{" + submitBody + "};\n");

    // ── 3. L'onglet Expenses de Mike sur grand ecran ───────────────────────
    rep('onglet expenses', "{(tab==='history'||(tab==='expenses'&&window.notesFraisRole!=='finance'))&&<div data-nfm-expenses=\"1\"",
      "{nfDeskWide&&tab==='expenses'&&<NfDeskWorkspace mE={mE} fil={fil} filterCat={filterCat} setFilterCat={setFilterCat} search={search} setSearch={setSearch} month={month} setMonth={setMonth} periodMode={periodMode} periodFrom={periodFrom} periodTo={periodTo} setPeriodFrom={setPeriodFrom} setPeriodTo={setPeriodTo} ML={ML} mT={mT} tva={tva} ubsLoaded={ubsLoaded} syncing={syncing} submissionStatus={submissionStatus} reviews={nfMonthReviews} setShowAdd={setShowAdd} setShowUBS={setShowUBS} setEditingExpense={setEditingExpense} deleteExpense={deleteExpense} setViewer={setViewer} setExpenses={setExpenses} onSubmit={nfDeskSubmit} submissionStep={submissionStep}/>}" +
      "{!(nfDeskWide&&tab==='expenses')&&(tab==='history'||(tab==='expenses'&&window.notesFraisRole!=='finance'))&&<div data-nfm-expenses=\"1\"");

    // La feuille de periode (period-compact.js) sert aussi sur grand ecran.
    rep('feuille periode', "{isMobile&&window.notesFraisRole!=='finance'&&<NfPeriodSheet",
      "{(isMobile||nfDeskWide)&&window.notesFraisRole!=='finance'&&<NfPeriodSheet");

    // ── 4. La barre laterale ───────────────────────────────────────────────
    rep('barre laterale', "<div style={{width:isMobile?'100%':220,background:'#fff'",
      "<div data-nf-side=\"true\" style={{width:isMobile?'100%':220,background:'#fff'");
    rep('logo laterale', "<div style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:4}}>EXPENSES</div>",
      "{nfDeskWide&&<div className=\"nfw-side-brand\"><img src=\"/logo-numeriq-mark.png\" alt=\"\"/><span>Numeriq Payroll</span></div>}<div className=\"nfw-side-over\" style={{fontSize:10,color:'var(--t3)',letterSpacing:'0.1em',marginBottom:4}}>EXPENSES</div>");
    rep('icones menu', '<span>{ic} {lb}</span>',
      "<span className=\"nfw-side-item\">{nfDeskWide?<NfWsIcon name={id} size={17}/>:ic} {lb}</span>{nfDeskWide&&id==='expenses'&&mE.length>0&&<span className=\"nfw-side-count\">{mE.length}</span>}");
    // Le bouton flottant « Mike » (changer d'acces) chevauchait l'en-tete :
    // sur grand ecran, il devient une ligne en bas de la barre laterale.
    rep('pied laterale', "{ubsLoaded?'✓ UBS loaded':'🏦 Import UBS statement'}</button></div>",
      "{nfDeskWide?<span className=\"nfw-side-btn\"><NfWsIcon name=\"recon\" size={15}/>{ubsLoaded?'Statement loaded':'Import statement'}</span>:(ubsLoaded?'✓ UBS loaded':'🏦 Import UBS statement')}</button>{nfDeskWide&&<button type=\"button\" className=\"nfw-side-out\" onClick={()=>{const b=document.querySelector('button[title=\"Change access\"]');if(b)b.click();}}><NfWsIcon name=\"logout\" size={15}/>Sign out</button>}</div>");

    // ── 5. Styles ──────────────────────────────────────────────────────────
    const css = `<style id="nf-ws-css">
/* NOTESFRAIS_DESK_WORKSPACE_V1 */
body.nf-desk-wide button[title="Change access"]{display:none!important}
body.nf-desk-wide #numeriq-brand-card{display:none!important}
body.nf-desk-wide [data-nf-side]{width:236px!important;background:#FBFCFD!important}
body.nf-desk-wide [data-nf-side]>div:first-child{padding:20px 18px 14px!important}
.nfw-side-brand{display:flex;align-items:center;gap:8px;margin:0 0 18px;font-size:13px;font-weight:700;color:#2E3E4F;letter-spacing:-.005em}
.nfw-side-brand img{width:34px;height:auto;display:block}
body.nf-desk-wide .nfw-side-over{font-size:11px!important;letter-spacing:.06em!important;color:#6B7785!important}
body.nf-desk-wide [data-nf-side] button .nfw-side-item{display:inline-flex;align-items:center;gap:10px}
body.nf-desk-wide [data-nf-side] div[style*="flex-direction: column"]>button{padding:9px 12px!important;font-size:14px!important;border-radius:9px!important;margin-bottom:3px!important;color:#4A5866}
body.nf-desk-wide [data-nf-side] div[style*="flex-direction: column"]>button[style*="var(--al)"]{color:#0F5E92!important;font-weight:600!important}
.nfw-side-count{font-size:11px;font-weight:600;background:#fff;border:0.5px solid #DDE4EA;color:#4A5866;border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}
.nfw-side-btn{display:inline-flex;align-items:center;gap:7px}
body.nf-desk-wide [data-nf-side]>div:last-child>button{font-size:13px!important;border-radius:10px!important;min-height:38px}
.nfw-side-out{display:flex;align-items:center;justify-content:center;gap:7px;border:0;background:none;color:#6B7785;font:inherit;font-size:12px;padding:6px;cursor:pointer;border-radius:8px}
.nfw-side-out:hover{color:#1E2B38;background:#EEF2F6}
body.nf-desk-wide [data-nf-main]:has(>[data-nf-ws]){padding:0!important;overflow:hidden!important}
body.nf-desk-user [data-nf-main]>[data-nf-ws].nfw{max-width:none!important;margin:0!important}

.nfw{height:100vh;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;padding:22px 28px 22px;color:#1E2B38;min-width:0}
.nfw>*{flex:none}
.nfw>.nfw-split{flex:1 1 auto}
.nfw *{box-sizing:border-box}
.nfw button{font-family:inherit}
.nfw-top{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.nfw-over{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6B7785;margin-bottom:2px}
.nfw-period-row{display:flex;align-items:center;gap:12px}
.nfw-period-title{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:2px 6px 2px 0;margin:0;cursor:pointer;color:#1E2B38;border-radius:8px}
.nfw-period-title h1{font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.02em;margin:0;color:#1E2B38}
.nfw-period-title svg{color:#0F5E92;margin-top:3px}
.nfw-period-title:hover h1{color:#0F5E92}
.nfw-period-nav{display:inline-flex;gap:4px}
.nfw-period-nav button,.nfw-icon-btn{width:32px;height:32px;border-radius:9px;border:0.5px solid #DDE4EA;background:#fff;color:#2E3E4F;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.nfw-period-nav button:hover:not(:disabled),.nfw-icon-btn:hover{border-color:#0F5E92;color:#0F5E92}
.nfw-period-nav button:disabled{opacity:.35;cursor:default}
.nfw-top-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.nfw-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:38px;padding:0 15px;border-radius:10px;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap;border:0.5px solid transparent;transition:background .12s,border-color .12s,color .12s}
.nfw-btn:disabled{opacity:.5;cursor:default}
.nfw-btn-primary{background:#0F5E92;color:#fff;border-color:#0F5E92}
.nfw-btn-primary:hover:not(:disabled){background:#0C4F7B}
.nfw-btn-ghost{background:#fff;color:#1E2B38;border-color:#D5DEE6}
.nfw-btn-ghost:hover:not(:disabled){border-color:#0F5E92;color:#0F5E92}
.nfw-btn-quiet{background:#E6F1FA;color:#0F5E92;border-color:#C9DDED}
.nfw-btn-quiet:hover:not(:disabled){background:#D9EAF7}
.nfw-btn-warn{background:#FDF0E3;color:#A04A06;border-color:#F2D3B1}
.nfw-submitted{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:10px;background:#E5F3EA;color:#17663F;font-size:13.5px;font-weight:600}

.nfw>[data-nf-month-review-banner]{margin:0!important}
.nfw-kpis{display:grid;grid-template-columns:1.25fr 1fr 1fr 1.2fr 1.1fr;background:#fff;border:0.5px solid #DDE4EA;border-radius:14px;box-shadow:0 1px 2px rgba(30,43,56,.04);overflow:hidden}
.nfw-kpi{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:13px 18px;border:0;border-left:0.5px solid #E4EAF0;background:none;text-align:left;font:inherit;color:inherit;min-width:0}
.nfw-kpi:first-child{border-left:0}
.nfw-kpi-go{cursor:pointer}
.nfw-kpi-go:hover:not(:disabled){background:#F6F9FC}
.nfw-kpi-go:disabled{cursor:default}
.nfw-kpi-on{background:#FDF6EE}
.nfw-k{font-size:12px;color:#5B6875;font-weight:500}
.nfw-v{font-size:17px;font-weight:650;color:#1E2B38;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.nfw-v-big{font-size:22px;font-weight:700;letter-spacing:-.01em}
.nfw-s{font-size:12px;color:#6B7785;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.nfw-warn{color:#A04A06;font-weight:600}
.nfw-ok{color:#17663F!important;font-weight:600}
.nfw-link{color:#0F5E92;font-weight:600}
.nfw-track{display:block;width:100%;height:4px;border-radius:99px;background:#E9EEF3;overflow:hidden;margin-top:6px}
.nfw-track i{display:block;height:100%;border-radius:99px;background:#17663F}

.nfw-split{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(420px,1fr);gap:16px;min-height:0}
.nfw-list,.nfw-detail{background:#fff;border:0.5px solid #DDE4EA;border-radius:14px;box-shadow:0 1px 2px rgba(30,43,56,.04);min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.nfw-list{container-type:inline-size;container-name:nfwlist}
.nfw-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 14px;border-bottom:0.5px solid #E4EAF0}
.nfw-flags{display:inline-flex;gap:1px;background:#EEF2F6;border-radius:10px;padding:3px;margin-right:auto}
.nfw-flags button{display:inline-flex;align-items:center;gap:5px;border:0;background:none;border-radius:8px;padding:5px 9px;font-size:12.5px;font-weight:500;color:#4A5866;cursor:pointer;white-space:nowrap}
.nfw-flags button span{font-size:11px;font-weight:600;color:#6B7785;font-variant-numeric:tabular-nums}
.nfw-flags button.nfw-on{background:#fff;color:#1E2B38;font-weight:600;box-shadow:0 1px 3px rgba(30,43,56,.12)}
.nfw-flags button[data-nf-ws-flag="missing"] span,.nfw-flags button[data-nf-ws-flag="fix"] span{color:#A04A06}
.nfw-search{display:flex;align-items:center;gap:7px;height:34px;border:0.5px solid #D5DEE6;border-radius:9px;padding:0 10px;color:#6B7785;background:#fff;flex:1 1 96px;max-width:280px;min-width:96px}
.nfw-search:focus-within{border-color:#0F5E92;box-shadow:0 0 0 3px rgba(15,94,146,.12)}
.nfw-search input{border:0;outline:0;background:none;font:inherit;font-size:13px;color:#1E2B38;width:100%;min-width:0;padding:0}
.nfw-catsel{height:34px;border:0.5px solid #D5DEE6;border-radius:9px;padding:0 10px;font:inherit;font-size:13px;color:#1E2B38;background:#fff;cursor:pointer}

.nfw-thead,.nfw-row{display:grid;grid-template-columns:minmax(0,1fr) 92px 112px;align-items:center;column-gap:14px;padding:0 16px}
.nfw-thead{height:34px;border-bottom:0.5px solid #E4EAF0;background:#FAFBFC}
.nfw-thead{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6B7785}
.nfw-thead>*{border:0;background:none;padding:0;text-align:left;white-space:nowrap}
.nfw-thead button{cursor:pointer;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit;border:0;background:none;padding:0}
.nfw-thead .nfw-c-main{gap:14px}
.nfw-thead button:hover{color:#0F5E92}
.nfw-c-date,.nfw-c-card,.nfw-c-st{display:none}
.nfw-c-amt{text-align:right!important;justify-self:end}
.nfw-c-rc{justify-self:start}
.nfw-rows{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.nfw-row{min-height:60px;padding-top:9px;padding-bottom:9px;border-bottom:0.5px solid #EEF2F6;cursor:pointer;position:relative}
.nfw-row:hover{background:#F7FAFC}
.nfw-row.nfw-sel{background:#EEF5FB}
.nfw-row.nfw-sel:before{content:"";position:absolute;left:0;top:6px;bottom:6px;width:3px;border-radius:0 3px 3px 0;background:#0F5E92}
.nfw-c-main{display:flex;align-items:center;gap:12px;min-width:0}
.nfw-cat{display:inline-flex;align-items:center;justify-content:center;border-radius:10px;flex:none}
.nfw-main-txt{display:flex;flex-direction:column;gap:3px;min-width:0}
.nfw-merchant{font-size:14px;font-weight:600;color:#1E2B38;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nfw-sub{display:flex;align-items:center;gap:6px;font-size:12px;color:#6B7785;min-width:0;white-space:nowrap;overflow:hidden}
.nfw-note{overflow:hidden;text-overflow:ellipsis}
.nfw-sub-narrow+.nfw-note:before{content:"· "}
.nfw-c-card{font-size:12.5px;color:#4A5866;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nfw-c-date{font-size:12.5px;color:#4A5866;white-space:nowrap;font-variant-numeric:tabular-nums}
.nfw-c-amt b{display:block;font-size:14px;font-weight:650;color:#1E2B38;font-variant-numeric:tabular-nums;white-space:nowrap}
.nfw-c-amt small{display:block;font-size:11.5px;color:#6B7785;font-variant-numeric:tabular-nums;white-space:nowrap;margin-top:1px}
.nfw-dim{color:#B3BDC7;font-style:normal}
.nfw-chip{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;border-radius:999px;padding:3px 8px;white-space:nowrap}
.nfw-chip-ok{background:#E5F3EA;color:#17663F}
.nfw-chip-amber{background:#FDF0E3;color:#A04A06}
.nfw-chip-grey{background:#EEF1F4;color:#5B6875;padding:2px 7px;font-size:10.5px}
.nfw-rc-yes{display:inline-flex;width:28px;height:28px;border-radius:8px;background:#E6F1FA;color:#0F5E92;align-items:center;justify-content:center}
.nfw-rc-no{display:inline-block;font-size:11px;font-weight:600;color:#A04A06;background:#FDF0E3;border-radius:999px;padding:3px 8px;white-space:nowrap}
@container nfwlist (min-width: 700px){
  .nfw-thead,.nfw-row{grid-template-columns:86px minmax(0,1fr) 72px 112px}
  .nfw-c-date{display:block}
  .nfw-sub-narrow,.nfw-h-narrow{display:none}
  .nfw-sub-narrow+.nfw-note:before{content:none}
}
@container nfwlist (min-width: 830px){
  .nfw-thead,.nfw-row{grid-template-columns:86px minmax(0,1fr) 116px 104px 72px 116px}
  .nfw-c-card,.nfw-c-st{display:block}
}
.nfw-foot{display:flex;align-items:center;gap:14px;padding:10px 16px;border-top:0.5px solid #E4EAF0;background:#FAFBFC;font-size:12.5px;color:#5B6875}
.nfw-foot b{margin-left:auto;font-size:14px;color:#1E2B38;font-variant-numeric:tabular-nums}
.nfw-foot-hint{color:#97A3AF;font-size:12px}
@container nfwlist (max-width: 620px){.nfw-foot-hint{display:none}}
@container nfwlist (max-width: 640px){.nfw-flags{margin-right:0}.nfw-catsel{margin-left:auto}.nfw-search{order:3;flex-basis:100%;max-width:none}}
.nfw-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:56px 28px;color:#5B6875;font-size:13.5px;line-height:1.5}
.nfw-empty b{font-size:16px;color:#1E2B38}
.nfw-empty span{max-width:380px}
.nfw-empty .nfw-btn{margin-top:8px}

.nfw-detail{container-type:inline-size;container-name:nfwdt}
.nfw-dt{display:flex;flex-direction:column;min-height:0;flex:1}
.nfw-dt-head{display:flex;align-items:center;gap:14px;padding:16px 18px 12px}
.nfw-dt-title{flex:1;min-width:0}
.nfw-dt-merchant{font-size:19px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nfw-dt-sub{font-size:12.5px;color:#6B7785;margin-top:2px}
.nfw-dt-amt{text-align:right;flex:none}
.nfw-dt-chf{font-size:22px;font-weight:700;letter-spacing:-.01em;font-variant-numeric:tabular-nums;white-space:nowrap}
.nfw-dt-orig{font-size:12.5px;color:#6B7785;font-variant-numeric:tabular-nums}
.nfw-dt-actions{display:flex;align-items:center;gap:8px;padding:0 18px 12px;border-bottom:0.5px solid #E4EAF0}
.nfw-dt-actions .nfw-btn{height:34px;padding:0 12px;font-size:13px}
.nfw-dt-comments{display:inline-flex;align-items:center;gap:2px;height:34px;padding:0 6px 0 10px;border:0.5px solid #D5DEE6;border-radius:10px;color:#0F5E92;background:#fff}
.nfw-dt-comments button{font-size:13px!important;font-weight:600!important;padding:4px 4px!important}
.nfw-dt-lock{font-size:12px;color:#6B7785;background:#EEF1F4;border-radius:999px;padding:5px 10px}
.nfw-del{color:#8A96A3}
.nfw-del:hover{color:#A32D2D!important;border-color:#E9B4B4!important}
.nfw-dt-tofix{margin:12px 18px 0;background:#FDF0E3;color:#7A3A06;border-radius:10px;padding:9px 12px;font-size:13px}
.nfw-dt-body{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:14px 18px 18px}
.nfw-rc{display:flex;flex-direction:column;background:#F3F6F9;border:0.5px solid #DDE4EA;border-radius:12px;overflow:hidden;height:clamp(300px,calc(100vh - 360px),640px);flex:none}
.nfw-rc-bar{display:flex;align-items:center;gap:8px;padding:7px 8px 7px 12px;background:#fff;border-bottom:0.5px solid #E4EAF0;min-height:40px}
.nfw-rc-name{flex:1;min-width:0;font-size:12px;color:#5B6875;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nfw-rc-pager{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#4A5866;font-variant-numeric:tabular-nums}
.nfw-rc-pager button{width:24px;height:24px;border:0.5px solid #DDE4EA;border-radius:7px;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#2E3E4F;padding:0}
.nfw-rc-pager button:disabled{opacity:.35;cursor:default}
.nfw-rc-open{display:inline-flex;align-items:center;gap:5px;border:0.5px solid #D5DEE6;background:#fff;border-radius:8px;height:26px;padding:0 9px;font-size:12px;font-weight:600;color:#0F5E92;cursor:pointer}
.nfw-rc-open:disabled{opacity:.5;cursor:default}
.nfw-rc-view{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden}
.nfw-rc-view iframe{width:100%;height:100%;border:0;background:#fff}
.nfw-rc-view img{max-width:100%;max-height:100%;object-fit:contain;display:block;cursor:zoom-in;padding:12px}
.nfw-rc-view.nfw-rc-zoom{overflow:auto;align-items:flex-start;justify-content:flex-start}
.nfw-rc-view.nfw-rc-zoom img{max-width:none;max-height:none;width:160%;cursor:zoom-out;padding:0}
.nfw-rc-msg{font-size:13px;color:#6B7785;padding:20px;text-align:center}
.nfw-rc-empty{align-items:center;justify-content:center;gap:6px;text-align:center;padding:26px;border-style:dashed;border-width:1.5px;border-color:#C9D4DE;background:#FAFBFC;color:#5B6875;font-size:13px;height:auto;min-height:220px}
.nfw-rc-empty b{color:#1E2B38;font-size:15px}
.nfw-rc-empty .nfw-btn{margin-top:8px}
.nfw-rc-empty-ico{width:48px;height:48px;border-radius:12px;background:#EEF2F6;color:#5B6875;display:flex;align-items:center;justify-content:center;margin-bottom:4px}
.nfw-dt-side{display:flex;flex-direction:column;gap:14px;min-width:0}
.nfw-dt-facts{display:grid;grid-template-columns:1fr;border:0.5px solid #E4EAF0;border-radius:12px;overflow:hidden}
.nfw-dt-fact{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:9px 12px;border-top:0.5px solid #EEF2F6;font-size:13px}
.nfw-dt-fact:first-child{border-top:0}
.nfw-dt-fact span{color:#6B7785;flex:none}
.nfw-dt-fact b{font-weight:550;color:#1E2B38;text-align:right;min-width:0;overflow-wrap:anywhere}
.nfw-dt-thread{border:0.5px solid #E4EAF0;border-radius:12px;padding:10px 12px}
.nfw-dt-thread-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;font-weight:600;color:#5B6875;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.nfw-dt-thread-empty{font-size:12.5px;color:#8A96A3;line-height:1.45}
.nfw-dt-msgs{display:flex;flex-direction:column;gap:8px}
.nfw-msg{border-radius:10px;padding:8px 10px;font-size:13px;line-height:1.45}
.nfw-msg-fin{background:#F3F6F9}
.nfw-msg-me{background:#E6F1FA}
.nfw-msg-h{display:flex;justify-content:space-between;gap:8px;font-size:11.5px;color:#6B7785;margin-bottom:2px}
.nfw-msg-h b{color:#1E2B38;font-weight:600}
.nfw-msg-b{white-space:pre-wrap;overflow-wrap:anywhere;color:#1E2B38}
@container nfwdt (min-width: 680px){
  .nfw-dt-body{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(250px,1fr);align-items:stretch;overflow:hidden}
  .nfw-rc{height:auto;min-height:0}
  .nfw-rc-empty{height:auto}
  .nfw-dt-side{overflow-y:auto;min-height:0}
}
.nfw-drop{flex:1;margin:14px;border:2px dashed #C9D4DE;border-radius:14px;background:#FAFBFC;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:30px;cursor:pointer;color:#5B6875;font-size:13.5px;line-height:1.5}
.nfw-drop:hover{border-color:#0F5E92;background:#F5F9FC}
.nfw-drop b{font-size:17px;color:#1E2B38}
.nfw-drop>span{max-width:380px}
.nfw-drop-ico{width:60px;height:60px;border-radius:16px;background:#E6F1FA;color:#0F5E92;display:flex;align-items:center;justify-content:center;margin-bottom:6px}
.nfw-drop-btns{display:flex;gap:8px;margin-top:10px}

/* Choix de periode : la feuille de period-compact.js (stylee pour l'iPhone
   seulement) devient un panneau sous le titre. */
body.nf-desk-wide .nfm-period-scrim{position:fixed;inset:0;z-index:6500;background:rgba(30,43,56,.18);display:flex;align-items:flex-start;justify-content:flex-start}
body.nf-desk-wide .nfm-period-sheet{width:440px;max-height:80vh;overflow-y:auto;margin:84px 0 0 258px;background:#fff;color:#1E2B38;border-radius:16px;padding:6px 18px 18px;box-shadow:0 24px 60px rgba(30,43,56,.24);font-size:14px}
body.nf-desk-wide .nfm-period-grab{display:none}
body.nf-desk-wide .nfm-period-head{display:flex;align-items:center;justify-content:space-between;min-height:44px}
body.nf-desk-wide .nfm-period-head b{font-size:16px;font-weight:650}
body.nf-desk-wide .nfm-period-done{border:0;background:none;color:#0F5E92;font:inherit;font-size:14px;font-weight:600;padding:6px 4px;cursor:pointer}
body.nf-desk-wide .nfm-period-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:3px;background:#EEF2F6;border-radius:10px;margin:2px 0 12px}
body.nf-desk-wide .nfm-period-seg button{border:0;background:transparent;border-radius:8px;min-height:32px;font:inherit;font-size:13px;font-weight:500;color:#4A5866;cursor:pointer}
body.nf-desk-wide .nfm-period-seg button.nfm-period-on{background:#fff;color:#1E2B38;font-weight:600;box-shadow:0 1px 3px rgba(30,43,56,.12)}
body.nf-desk-wide .nfm-period-years{display:flex;gap:6px;margin:0 0 12px}
body.nf-desk-wide .nfm-period-years button{border:0;background:#EEF2F6;color:#1E2B38;border-radius:999px;min-height:30px;padding:0 14px;font:inherit;font-size:13px;font-weight:500;cursor:pointer}
body.nf-desk-wide .nfm-period-years button.nfm-period-on{background:#0F5E92;color:#fff;font-weight:600}
body.nf-desk-wide .nfm-period-hint{font-size:13px;color:#5B6875;margin:0 2px 10px}
body.nf-desk-wide .nfm-period-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
body.nf-desk-wide .nfm-period-grid button{min-height:52px;border:0;border-radius:10px;background:#F3F6F9;color:#1E2B38;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:6px 4px;cursor:pointer}
body.nf-desk-wide .nfm-period-grid button:hover:not(.nfm-period-sel){background:#E3EDF6}
body.nf-desk-wide .nfm-period-m{font-size:14px;font-weight:600}
body.nf-desk-wide .nfm-period-n{font-size:11px;color:#6B7785;font-variant-numeric:tabular-nums;white-space:nowrap}
body.nf-desk-wide .nfm-period-grid button.nfm-period-now .nfm-period-m{color:#0F5E92}
body.nf-desk-wide .nfm-period-grid button.nfm-period-in{background:#E6F1FA}
body.nf-desk-wide .nfm-period-grid button.nfm-period-sel{background:#0F5E92}
body.nf-desk-wide .nfm-period-grid button.nfm-period-sel .nfm-period-m,body.nf-desk-wide .nfm-period-grid button.nfm-period-sel .nfm-period-n{color:#fff}
body.nf-desk-wide .nfm-period-yearcard{display:flex;align-items:baseline;justify-content:space-between;gap:12px;background:#F3F6F9;border-radius:12px;padding:14px 16px}
body.nf-desk-wide .nfm-period-yearcard-y{font-size:18px;font-weight:700}
body.nf-desk-wide .nfm-period-yearcard-n{font-size:13px;color:#5B6875}
</style>`;
    rep('head', '</head>', css + '</head>');
    return html;
  };
})();
