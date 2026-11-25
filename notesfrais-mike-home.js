(function(){
  // Accueil de Mike, deuxieme partie de la refonte validee sur maquette
  // (nov. 2026) : frais groupes par jour, fiche detaillee d'un frais, acces
  // au releve UBS depuis la carte du mois.
  //
  // Charge apres brand.js. Comme lui, chaque cible manquante LEVE une erreur
  // au lieu d'un no-op silencieux, et les textes sont ecrits en anglais.
  // Tout est limite au mobile (isMobile) : l'espace finance et le bureau ne
  // changent pas.
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_MIKE_HOME_V1')) return html;

    const swap = (from, to, label) => {
      const n = html.split(from).length - 1;
      if(n !== 1) throw new Error('mike-home: cible ' + (n ? 'en ' + n + ' exemplaires' : 'introuvable') + ' (' + label + ')');
      html = html.replace(from, () => to);
    };

    // ── 1. Composants : la fiche d'un frais ────────────────────────────────
    const components = `
const NOTESFRAIS_MIKE_HOME_V1=true;
const nfByDateDesc=(a,b)=>String(b.date||'').localeCompare(String(a.date||''));
function nfHomeIso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function nfDayLabel(date){
  if(!date)return 'No date';
  const now=new Date();
  const y=new Date(now);y.setDate(now.getDate()-1);
  if(date===nfHomeIso(now))return 'Today';
  if(date===nfHomeIso(y))return 'Yesterday';
  const d=new Date(date+'T12:00:00');
  if(isNaN(d))return date;
  return d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'});
}
function nfLongDate(date){
  const d=new Date(String(date||'')+'T12:00:00');
  return isNaN(d)?(date||'-'):d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function NfDetailPhoto({items,onOpen}){
  const first=items[0]||null;
  const [url,setUrl]=useState(null);
  useEffect(()=>{
    let live=true;setUrl(null);
    if(first&&!isPDF(first.path))getReceiptUrl(first.path,false,first.name).then(u=>{if(live)setUrl(u);}).catch(()=>{});
    return()=>{live=false;};
  },[first&&first.path]);
  if(!first)return <div className="nfm-dt-nophoto"><b>No receipt photo</b><span>Edit the expense to add one.</span></div>;
  return <button type="button" className="nfm-dt-photo" onClick={onOpen} aria-label="Open receipt">
    {isPDF(first.path)?<span className="nfm-dt-photo-msg">PDF receipt · tap to open</span>:url?<img src={url} alt="Receipt"/>:<span className="nfm-dt-photo-msg">Loading receipt…</span>}
    {items.length>1&&<span className="nfm-dt-count">{items.length} receipts</span>}
  </button>;
}
function NfExpenseDetail({expense,backLabel,ubsLoaded,onClose,onEdit,onDelete,setViewer,onUpdated}){
  useEffect(()=>{
    document.body.classList.add('nfm-detail-open');
    return()=>document.body.classList.remove('nfm-detail-open');
  },[]);
  if(!expense)return null;
  const e=expense;
  const items=receiptItemsForExpense(e);
  const openPhoto=()=>{
    if(!items.length)return;
    if(items.length>1)setViewer({items,index:0,name:e.merchant||'Receipts'});
    else setViewer({url:items[0].path,path:items[0].path,name:items[0].name||'receipt'});
  };
  const closed=e.submissionStatus==='submitted';
  const canFix=closed&&e.reviewStatus==='to_fix';
  const card=getPaymentCardLabel(e.note);
  const note=cleanPaymentCardNote(e.note);
  const ubs=e.ubsRow?('Matched · '+e.ubsRow.label):ubsLoaded?'No match in the statement':'Not imported yet';
  const rows=[
    ['Date',nfLongDate(e.date)],
    ['Category',(CMAP[e.category]&&CMAP[e.category].label)||'Other'],
    card&&['Paid with',card],
    ['VAT',e.tva>0?'CHF '+fmt(e.tva):'None'],
    e.currency&&e.currency!=='CHF'&&['Original amount',e.currency+' '+fmt(e.amount)],
    note&&['Note',note],
    ['UBS statement',ubs]
  ].filter(Boolean);
  // Portee sur <body>, comme la feuille de capture : un ancetre transforme
  // ferait sinon de position:fixed un cadre rogne.
  return ReactDOM.createPortal(<div className="nfm-detail" data-nf-detail="true" role="dialog" aria-label={'Expense '+(e.merchant||'')}>
    <div className="nfm-dt-bar">
      <button type="button" className="nfm-dt-back" onClick={onClose} data-nf-detail-close="true">{'‹ '+backLabel}</button>
      {!closed&&<button type="button" className="nfm-dt-edit" onClick={()=>onEdit(e)} data-nf-act="edit">Edit</button>}
      {canFix&&<button type="button" className="nfm-dt-edit" onClick={()=>onEdit(e)} data-nf-act="fix">Fix</button>}
    </div>
    <div className="nfm-dt-scroll">
      <NfDetailPhoto items={items} onOpen={openPhoto}/>
      <div className="nfm-dt-head">
        <div className="nfm-dt-merchant">{e.merchant||'Expense'}</div>
        <div className="nfm-dt-amount">{'CHF '+fmt(e.amountCHF||e.amount)}</div>
      </div>
      <div className="nfm-dt-list">{rows.map(([k,v])=><div key={k} className="nfm-dt-row"><span className="nfm-dt-k">{k}</span><span className={'nfm-dt-v'+(k==='UBS statement'&&e.ubsRow?' nfm-dt-ok':'')}>{v}</span></div>)}</div>
      {(e.reviewStatus==='to_fix'||nfCommentsOf(e).length>0)&&<div className="nfm-dt-review"><NfReviewChips expense={e}/></div>}
      {canFix&&<div className="nfm-dt-tofix">Finance asked for a change. Fix the expense, then reply in the thread.</div>}
      <div className="nfm-dt-thread"><NfCommentsButton expense={e} onUpdated={onUpdated}/></div>
      {closed&&!canFix&&<div className="nfm-dt-closed">This month is with finance, so the expense can't be changed.</div>}
      {!closed&&<button type="button" className="nfm-dt-delete" onClick={()=>onDelete(e)} data-nf-act="delete">Delete expense</button>}
    </div>
  </div>,document.body);
}
`;
    swap('function UserReceiptPreview({expense,setViewer}){', components + 'function UserReceiptPreview({expense,setViewer}){', 'composant de la fiche');

    // ── 2. Etat : quel frais est ouvert ────────────────────────────────────
    swap('const [editingExpense,setEditingExpense]=useState(null);',
         'const [editingExpense,setEditingExpense]=useState(null);const [nfDetailId,setNfDetailId]=useState(null);',
         'etat de la fiche');

    // ── 3. Liste groupee par jour, une ligne ouvre la fiche ────────────────
    swap("<div style={{background:'#fff',borderRadius:12,border:'0.5px solid var(--border)',overflow:'hidden'}}>{fil.map((e,i)=><div key={e.id} className=\"nf-ios-expense-row\" style={{display:'flex',gap:14,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row',padding:'14px 18px',borderBottom:i<fil.length-1?'0.5px solid var(--border)':'none'}}>",
         "<div className={isMobile?'nfm-daylist':''} style={{background:'#fff',borderRadius:12,border:'0.5px solid var(--border)',overflow:'hidden'}}>{(isMobile?[...fil].sort(nfByDateDesc):fil).map((e,i,arr)=><React.Fragment key={e.id}>{isMobile&&(i===0||arr[i-1].date!==e.date)&&<div className=\"nfm-day\" data-nfm-day={e.date||''}>{nfDayLabel(e.date)}</div>}<div className=\"nf-ios-expense-row\" data-nfm-g={((i===0||arr[i-1].date!==e.date)?'first ':'')+((i===arr.length-1||arr[i+1].date!==e.date)?'last':'')} onClick={ev=>{if(isMobile&&!(ev.target.closest&&ev.target.closest('button,a,input,select,textarea')))setNfDetailId(e.id);}} style={{display:'flex',gap:14,alignItems:isMobile?'stretch':'center',flexDirection:isMobile?'column':'row',padding:'14px 18px',borderBottom:(i<arr.length-1&&!(isMobile&&arr[i+1].date!==e.date))?'0.5px solid var(--border)':'none'}}>",
         'debut de la liste des frais');
    swap('title="Delete">🗑</button></>}</div></div></div>)}</div>}</div>}',
         'title="Delete">🗑</button></>}</div></div></div></React.Fragment>)}</div>}</div>}',
         'fin de la liste des frais');

    // ── 4. La fiche, au-dessus de la liste et sous la barre du bas ─────────
    swap('{showUBS&&<UBSModal',
         "{isMobile&&nfDetailId!=null&&(()=>{const nfE=expenses.find(x=>String(x.id)===String(nfDetailId));if(!nfE)return null;return <NfExpenseDetail expense={nfE} backLabel={String(ML||'Expenses').split(' ')[0]} ubsLoaded={ubsLoaded} onClose={()=>setNfDetailId(null)} onEdit={x=>{setNfDetailId(null);setEditingExpense(x);}} onDelete={x=>{setNfDetailId(null);deleteExpense(x.id,x.receiptPath||x.receiptUrl);}} setViewer={setViewer} onUpdated={upd=>setExpenses(prev=>prev.map(item=>String(item.id)===String(upd.id)?{...item,comments:upd.comments,reviewStatus:upd.reviewStatus}:item))}/>;})()}{showUBS&&<UBSModal",
         'montage de la fiche');

    // ── 5. Carte du mois : le releve UBS se lance d'ici ────────────────────
    swap("<div><div className=\"nfm-sum-k\">Matched with UBS</div><div className=\"nfm-sum-v\">{ubsLoaded?(rec.length+' / '+mE.length):('\\u2014 / '+mE.length)}</div></div>",
         "{(()=>{const nfMatched=mE.filter(x=>x.ubsRow||x.status==='reconciled').length;const nfOpenUbs=submissionStatus!=='submitted';return <div className={'nfm-sum-ubs'+(nfOpenUbs?' nfm-sum-ubs-go':'')} role={nfOpenUbs?'button':undefined} tabIndex={nfOpenUbs?0:undefined} data-nf-ubs-open={nfOpenUbs?'true':undefined} onClick={()=>{if(nfOpenUbs)setShowUBS(true);}}><div className=\"nfm-sum-k\">UBS statement</div><div className=\"nfm-sum-v\">{(ubsLoaded||nfMatched>0)?(nfMatched+' of '+mE.length+' matched'):(nfOpenUbs?'Import':'\\u2014')}</div></div>;})()}",
         'cellule UBS de la carte du mois');

    // ── 6. Styles ──────────────────────────────────────────────────────────
    const css = `<style id="notesfrais-mike-home-v1">
@media(max-width:859px){
  /* Liste par jour : un titre de jour, puis une carte par jour. */
  /* ios-ui.js peint chaque enfant direct de la liste en blanc : le titre de
     jour est un enfant direct, d'ou la specificite. */
  html body.nf-ios-mike .nfm-daylist{background:transparent!important;border:0!important;border-radius:0!important;overflow:visible!important;box-shadow:none!important}
  html body.nf-ios-mike .nfm-daylist>div.nfm-day{background:transparent!important;border:0!important;box-shadow:none!important;font-size:13px;font-weight:600;color:var(--nf-t2,#5B6875);padding:18px 4px 7px!important;letter-spacing:0;min-height:0}
  html body.nf-ios-mike .nfm-daylist>div.nfm-day:first-child{padding-top:4px!important}
  html body.nf-ios-mike .nfm-daylist>div.nfm-day+div{border-top:0!important}
  html body.nf-ios-mike .nfm-daylist>.nf-ios-expense-row{background:var(--nf-card,#fff)!important;cursor:pointer;-webkit-tap-highlight-color:transparent}
  html body.nf-ios-mike .nfm-daylist>.nf-ios-expense-row[data-nfm-g~="first"]{border-top-left-radius:16px;border-top-right-radius:16px}
  html body.nf-ios-mike .nfm-daylist>.nf-ios-expense-row[data-nfm-g~="last"]{border-bottom-left-radius:16px;border-bottom-right-radius:16px}
  html body.nf-ios-mike .nfm-daylist>.nf-ios-expense-row:active{filter:brightness(.97)}
  /* La date est dans le titre du jour ; Edit, Delete et le fil vont dans la fiche. */
  html body.nf-ios-mike .nfm-daylist .nf-ios-expense-info>div:nth-child(2)>span:first-child{display:none}
  html body.nf-ios-mike .nfm-daylist .nf-ios-expense-actions{display:none!important}
  html body.nf-ios-mike .nfm-daylist .nf-ios-expense-row:after{content:"";position:absolute;right:10px;top:50%;width:7px;height:7px;margin-top:-4px;border-top:2px solid #B8C2CC;border-right:2px solid #B8C2CC;transform:rotate(45deg)}
  html body.nf-ios-mike .nfm-daylist .nf-ios-expense-row{position:relative;padding-right:28px!important}

  /* Carte du mois : la cellule UBS est un bouton. */
  html body.nf-ios-mike .nfm-sum-ubs-go{cursor:pointer;-webkit-tap-highlight-color:transparent}
  html body.nf-ios-mike .nfm-sum-ubs-go .nfm-sum-v{color:#0F5E92!important}
  html body.nf-ios-mike .nfm-sum-ubs-go .nfm-sum-v:after{content:" ›";font-weight:600}

  /* Fiche d'un frais : plein ecran, la barre du bas reste visible. */
  /* La fiche couvre la barre du bas (4200) ; la visionneuse du recu (4000
     par ios-ui.js) doit alors passer devant elle. */
  body.nfm-detail-open #test-scan-cta,body.nfm-detail-open #mike-scan-cta{display:none!important}
  body.nfm-detail-open .nf-ios-receipt-viewer{z-index:4600!important}
  .nfm-detail{position:fixed;inset:0;z-index:4400;background:var(--nf-bg,#F3F6F9);display:flex;flex-direction:column;animation:nfmDtIn .22s ease-out}
  @keyframes nfmDtIn{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}
  .nfm-dt-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(8px + env(safe-area-inset-top)) 8px 8px;min-height:52px;background:var(--nf-bg,#F3F6F9)}
  .nfm-dt-back,.nfm-dt-edit{border:0;background:none;color:#0F5E92;font:inherit;font-size:17px;font-weight:500;min-height:44px;padding:0 10px;cursor:pointer}
  .nfm-dt-edit{font-weight:600}
  .nfm-dt-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 16px calc(32px + env(safe-area-inset-bottom))}
  .nfm-dt-photo{display:flex;align-items:center;justify-content:center;position:relative;width:100%;height:240px;border:0;border-radius:18px;overflow:hidden;background:#E4EAF0;padding:0;cursor:zoom-in}
  .nfm-dt-photo img{width:100%;height:100%;object-fit:cover}
  .nfm-dt-photo-msg{color:#5B6875;font-size:14px;font-weight:500}
  .nfm-dt-count{position:absolute;right:10px;bottom:10px;background:rgba(17,24,32,.72);color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600}
  .nfm-dt-nophoto{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;height:120px;border:1.5px dashed #C5CED7;border-radius:18px;color:#5B6875;font-size:13px}
  .nfm-dt-nophoto b{font-size:15px;color:var(--nf-t1,#1E2B38);font-weight:600}
  .nfm-dt-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:18px 2px 12px}
  .nfm-dt-merchant{font-size:22px;font-weight:700;color:var(--nf-t1,#1E2B38);line-height:1.2;min-width:0;overflow-wrap:anywhere}
  .nfm-dt-amount{font-size:22px;font-weight:700;color:var(--nf-t1,#1E2B38);white-space:nowrap;font-variant-numeric:tabular-nums}
  .nfm-dt-list{background:var(--nf-card,#fff);border-radius:16px;overflow:hidden}
  .nfm-dt-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:48px;padding:10px 16px;border-bottom:.5px solid var(--nf-line,#E4EAF0);font-size:15px}
  .nfm-dt-row:last-child{border-bottom:0}
  .nfm-dt-k{color:#5B6875;flex-shrink:0}
  .nfm-dt-v{color:var(--nf-t1,#1E2B38);text-align:right;min-width:0;overflow-wrap:anywhere}
  .nfm-dt-ok{color:#17663F}
  .nfm-dt-review{margin-top:14px}
  .nfm-dt-tofix{margin-top:12px;background:#FDF0E3;color:#7A3A06;border-radius:14px;padding:12px 14px;font-size:14px;line-height:1.4}
  .nfm-dt-thread{margin-top:14px}
  .nfm-dt-thread button{width:100%!important;min-height:48px!important;justify-content:center!important;background:var(--nf-card,#fff)!important;border:0!important;border-radius:14px!important;font-size:16px!important}
  .nfm-dt-closed{margin-top:14px;color:#5B6875;font-size:14px;text-align:center;line-height:1.4}
  .nfm-dt-delete{display:block;width:100%;margin-top:22px;min-height:48px;border:0;border-radius:14px;background:var(--nf-card,#fff);color:#B42318;font:inherit;font-size:16px;font-weight:500;cursor:pointer}
}
</style>`;
    if(!html.includes('</head>')) throw new Error('mike-home: </head> introuvable');
    html = html.replace('</head>', css + '</head>');
    return html;
  };
})();
