(function(){
  // Selecteur de periode compact, dernier element de la maquette validee par
  // Thomas (nov. 2026) : sur l'iPhone de Mike, le grand titre de l'en-tete
  // devient la periode (« August 2026 ⌄ »). Le toucher ouvre une feuille par
  // le bas : Month / Range / Full year, la grille des douze mois avec le
  // nombre de frais de chacun, et les autres annees quand il y en a.
  //
  // Il remplace les deux rangees « Month · Range · Full year » + liste
  // deroulante, qui prenaient 180 px sous la carte du mois. L'ancien
  // selecteur reste dans le DOM (masque) : year.js, le surtitre et les
  // tests lisent encore sa valeur.
  //
  // Charge apres receipt-ai.js et AVANT dark.js : ses regles CSS (prefixe
  // nfm-) sont recopiees en sombre par dark.js, a condition d'utiliser des
  // couleurs de sa table. Ecrit en anglais, apres les traductions. Chaque
  // cible manquante leve une erreur. Mobile de Mike seulement : la finance et
  // le bureau ne changent pas.
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_PERIOD_COMPACT_V1')) return html;

    const swap = (from, to, label) => {
      const n = html.split(from).length - 1;
      if(n !== 1) throw new Error('period-compact: cible ' + (n ? 'en ' + n + ' exemplaires' : 'introuvable') + ' (' + label + ')');
      html = html.replace(from, () => to);
    };

    // ── 1. Composant : la feuille de choix de la periode ──────────────────
    const component = `
const NOTESFRAIS_PERIOD_COMPACT_V1=true;
const NF_MONTH_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function nfPeriodTitle(mode,month,from,to){
  if(mode==='year')return 'Year '+NOTESFRAIS_YEAR;
  const label=v=>(MONTHS.find(m=>m.v===v)||{}).l||v||'';
  if(mode==='range'){
    const r=normalizePeriodRange(from,to);
    if(r.from===r.to)return label(r.from);
    return NF_MONTH_SHORT[Number(r.from.slice(5,7))-1]+' \\u2013 '+NF_MONTH_SHORT[Number(r.to.slice(5,7))-1]+' '+NOTESFRAIS_YEAR;
  }
  return label(month);
}
function NfPeriodSheet({tab,periodMode,setPeriodMode,month,setMonth,periodFrom,setPeriodFrom,periodTo,setPeriodTo,monthCounts}){
  const [open,setOpen]=useState(false);
  const [rangeStart,setRangeStart]=useState(null);
  const label=nfPeriodTitle(periodMode,month,periodFrom,periodTo);
  // L'en-tete (#nf-ios-header) est pose hors de React par ios-ui.js : on lui
  // publie l'etat, il se met a jour tout de suite puis a chaque tick.
  useEffect(()=>{
    window.NOTESFRAIS_PERIOD_STATE={label,tab};
    if(typeof window.nfPeriodHeaderSync==='function')window.nfPeriodHeaderSync();
  },[label,tab]);
  useEffect(()=>{
    const onOpen=()=>{setRangeStart(null);setOpen(true);};
    window.addEventListener('nf-period-open',onOpen);
    return()=>window.removeEventListener('nf-period-open',onOpen);
  },[]);
  useEffect(()=>{
    if(!open)return;
    document.body.classList.add('nfm-period-open');
    return()=>document.body.classList.remove('nfm-period-open');
  },[open]);
  if(!open)return null;
  const close=()=>{setRangeStart(null);setOpen(false);};
  const count=v=>Number((monthCounts||{})[v]||0);
  const yearCount=MONTHS.reduce((s,m)=>s+count(m.v),0);
  const now=new Date();
  const thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const range=normalizePeriodRange(periodFrom,periodTo);
  const chooseMode=id=>{
    setRangeStart(null);
    setPeriodMode(id);
    if(id==='range'&&periodMode==='month'){setPeriodFrom(month);setPeriodTo(month);}
  };
  const chooseMonth=v=>{
    if(periodMode==='range'){
      if(!rangeStart){setRangeStart(v);setPeriodFrom(v);setPeriodTo(v);return;}
      const r=normalizePeriodRange(rangeStart,v);
      setPeriodFrom(r.from);setPeriodTo(r.to);
      close();
      return;
    }
    setMonth(v);setPeriodFrom(v);setPeriodTo(v);setPeriodMode('month');
    close();
  };
  const chooseYear=y=>{
    if(y===NOTESFRAIS_YEAR)return;
    nfSwitchYear('nfyear:'+y,periodMode==='year'?'year':'month');
  };
  const cellClass=m=>{
    const c=[];
    if(m.v===thisMonth)c.push('nfm-period-now');
    if(periodMode==='month'&&m.v===month)c.push('nfm-period-sel');
    if(periodMode==='range'){
      const from=rangeStart||range.from,to=rangeStart||range.to;
      if(m.v===from||m.v===to)c.push('nfm-period-sel');
      else if(m.v>from&&m.v<to)c.push('nfm-period-in');
    }
    return c.join(' ');
  };
  const n=v=>{const k=count(v);return k?(k+' expense'+(k>1?'s':'')):'\\u00a0';};
  return ReactDOM.createPortal(<div className="nfm-period-scrim" data-nf-period-sheet="true" onClick={close}>
    <div className="nfm-period-sheet" role="dialog" aria-modal="true" aria-label="Choose a period" onClick={e=>e.stopPropagation()}>
      <div className="nfm-period-grab" aria-hidden="true"/>
      <div className="nfm-period-head"><b>Period</b><button type="button" className="nfm-period-done" onClick={close}>Done</button></div>
      <div className="nfm-period-seg" role="group" aria-label="Period type">
        {[['month','Month'],['range','Range'],['year','Full year']].map(([id,l])=><button key={id} type="button" aria-pressed={periodMode===id} className={periodMode===id?'nfm-period-on':''} onClick={()=>chooseMode(id)}>{l}</button>)}
      </div>
      {NOTESFRAIS_YEARS.length>1&&<div className="nfm-period-years" role="group" aria-label="Year">
        {[...NOTESFRAIS_YEARS].reverse().map(y=><button key={y} type="button" data-nf-period-year={y} aria-pressed={y===NOTESFRAIS_YEAR} className={y===NOTESFRAIS_YEAR?'nfm-period-on':''} onClick={()=>chooseYear(y)}>{String(y)}</button>)}
      </div>}
      {periodMode==='year'?<div className="nfm-period-yearcard"><span className="nfm-period-yearcard-y">{'Year '+NOTESFRAIS_YEAR}</span><span className="nfm-period-yearcard-n">{yearCount+' expense'+(yearCount===1?'':'s')}</span></div>:<React.Fragment>
        {periodMode==='range'&&<div className="nfm-period-hint">{rangeStart?'Now tap the last month.':'Tap the first month, then the last.'}</div>}
        <div className="nfm-period-grid">
          {MONTHS.map((m,i)=><button key={m.v} type="button" data-nf-period-month={m.v} aria-pressed={cellClass(m).includes('nfm-period-sel')} aria-label={m.l+', '+count(m.v)+' expenses'} className={cellClass(m)} onClick={()=>chooseMonth(m.v)}><span className="nfm-period-m">{NF_MONTH_SHORT[i]}</span><span className="nfm-period-n">{n(m.v)}</span></button>)}
        </div>
      </React.Fragment>}
    </div>
  </div>,document.body);
}
`;
    swap('const NOTESFRAIS_MIKE_HOME_V1=true;', component + 'const NOTESFRAIS_MIKE_HOME_V1=true;', 'avant les composants de mike-home');

    // ── 2. Montage au niveau de l'App, la ou vit l'etat de la periode ──────
    swap(
      '{isMobile&&nfDetailId!=null&&(()=>{',
      "{isMobile&&window.notesFraisRole!=='finance'&&<NfPeriodSheet tab={tab} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>}" +
      '{isMobile&&nfDetailId!=null&&(()=>{',
      'montage de la feuille'
    );

    // ── 3. L'en-tete : le titre devient la periode ─────────────────────────
    // Le tick de mobile-redesign.js (300 ms, deja en place) reecrivait le
    // surtitre « NUMERIQ · AUGUST 2026 ». On passe la main avant lui.
    swap(
      "  const kicker=header.querySelector('.nf-ios-kicker');\n  const period=periodLabel();",
      "  if(typeof window.nfPeriodHeaderSync==='function'&&window.nfPeriodHeaderSync())return;\n" +
      "  const kicker=header.querySelector('.nf-ios-kicker');\n  const period=periodLabel();",
      'tick de l en-tete'
    );

    const script = `<script id="notesfrais-period-compact-script-v1">(function(){
var KICKERS={expenses:'NUMERIQ \\u00b7 EXPENSES',recon:'NUMERIQ PAYROLL'};
var TITLES={stats:'Stats',account:'Account'};
function open(){window.dispatchEvent(new Event('nf-period-open'));}
// Renvoie true quand l'en-tete est pris en charge : le tick s'arrete alors.
window.nfPeriodHeaderSync=function(){
  var s=window.NOTESFRAIS_PERIOD_STATE;
  var header=document.getElementById('nf-ios-header');
  if(!s||!header||!document.body.classList.contains('nf-ios-mike'))return false;
  var title=header.querySelector('.nf-ios-title');
  var kicker=header.querySelector('.nf-ios-kicker');
  if(!title)return false;
  var on=Object.prototype.hasOwnProperty.call(KICKERS,s.tab);
  var text=on?s.label:(TITLES[s.tab]||'Expenses');
  if(title.textContent!==text)title.textContent=text;
  var k=on?KICKERS[s.tab]:'NUMERIQ PAYROLL';
  if(kicker&&kicker.textContent!==k)kicker.textContent=k;
  title.classList.toggle('nfm-period-title',on);
  if(on){
    title.setAttribute('role','button');
    title.setAttribute('tabindex','0');
    title.setAttribute('aria-haspopup','dialog');
    title.setAttribute('aria-label','Period: '+s.label+'. Tap to change');
  }else{
    ['role','tabindex','aria-haspopup','aria-label'].forEach(function(a){title.removeAttribute(a);});
  }
  if(!title.dataset.nfmPeriodWired){
    title.dataset.nfmPeriodWired='1';
    title.addEventListener('click',function(){if(title.classList.contains('nfm-period-title'))open();});
    title.addEventListener('keydown',function(e){
      if(!title.classList.contains('nfm-period-title'))return;
      if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}
    });
  }
  return true;
};
})();<\/script>`;
    swap('</body>', script + '</body>', 'script de l en-tete');

    // ── 4. Styles. Couleurs prises dans la table de dark.js. ───────────────
    const css = `<style id="notesfrais-period-compact-v1">
@media(max-width:859px){
  /* L'ancien selecteur reste dans le DOM, masque : sa valeur sert encore. */
  body.nf-ios-mike [data-period-selector="true"]{display:none!important}
  body.nf-ios-mike [data-nfm-expenses]>.nf-ios-period-header{display:none!important}

  /* Titre-periode de l'en-tete, avec son chevron. */
  body.nf-ios-mike #nf-ios-header .nfm-period-title{display:inline-flex;align-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:34px;border-radius:8px}
  body.nf-ios-mike #nf-ios-header .nfm-period-title:after{content:"";display:inline-block;width:.3em;height:.3em;margin:-.2em 0 0 .34em;border-right:.09em solid;border-bottom:.09em solid;color:#0F5E92;transform:rotate(45deg);flex:none}
  body.nf-ios-mike #nf-ios-header .nfm-period-title:active{opacity:.55}
  body.nf-ios-mike #nf-ios-header .nfm-period-title:focus-visible{outline:2px solid #0F5E92;outline-offset:3px}
  body.nf-ios-mike #nf-ios-header.nfm-compact .nfm-period-title{min-height:24px}

  /* Feuille par le bas. */
  body.nfm-period-open #test-scan-cta,body.nfm-period-open #mike-scan-cta{display:none!important}
  .nfm-period-scrim{position:fixed;inset:0;z-index:6500;background:rgba(0,0,0,.4);display:flex;align-items:flex-end;animation:nfmPdFade .18s ease-out}
  .nfm-period-sheet{width:100%;max-height:88vh;overflow-y:auto;background:#fff;color:#1E2B38;border-radius:20px 20px 0 0;padding:8px 16px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.15);animation:nfmPdUp .26s cubic-bezier(.2,.8,.2,1)}
  @keyframes nfmPdFade{from{opacity:0}to{opacity:1}}
  @keyframes nfmPdUp{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}
  .nfm-period-grab{width:36px;height:5px;border-radius:3px;background:#E3E3E8;margin:0 auto 6px}
  .nfm-period-head{display:flex;align-items:center;justify-content:space-between;min-height:44px}
  .nfm-period-head b{font-size:17px;font-weight:600;color:#1E2B38}
  .nfm-period-done{border:0;background:none;color:#0F5E92;font:inherit;font-size:17px;font-weight:600;min-height:44px;padding:0 4px;cursor:pointer}
  .nfm-period-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:2px;background:#E3E3E8;border-radius:10px;margin:4px 0 14px}
  .nfm-period-seg button{border:0;background:transparent;border-radius:8px;min-height:34px;font:inherit;font-size:14px;font-weight:500;color:#1E2B38;cursor:pointer}
  .nfm-period-seg button.nfm-period-on{background:#fff;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.12)}
  .nfm-period-years{display:flex;gap:8px;margin:0 0 14px}
  .nfm-period-years button{border:0;background:#EAF0F5;color:#1E2B38;border-radius:17px;min-height:34px;padding:0 16px;font:inherit;font-size:15px;font-weight:500;cursor:pointer}
  .nfm-period-years button.nfm-period-on{background:#0F5E92;color:#fff;font-weight:600}
  .nfm-period-hint{font-size:14px;color:#5B6875;margin:0 2px 10px}
  .nfm-period-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
  .nfm-period-grid button{min-height:60px;border:0;border-radius:14px;background:#EAF0F5;color:#1E2B38;font:inherit;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 4px;cursor:pointer;-webkit-tap-highlight-color:transparent}
  .nfm-period-grid button:active{opacity:.7}
  .nfm-period-m{font-size:16px;font-weight:600}
  .nfm-period-n{font-size:12px;color:#5B6875;font-variant-numeric:tabular-nums;white-space:nowrap}
  .nfm-period-grid button.nfm-period-now .nfm-period-m{color:#0F5E92}
  .nfm-period-grid button.nfm-period-in{background:#E6F1FA}
  .nfm-period-grid button.nfm-period-sel{background:#0F5E92}
  .nfm-period-grid button.nfm-period-sel .nfm-period-m,.nfm-period-grid button.nfm-period-sel .nfm-period-n{color:#fff}
  /* La copie sombre de dark.js passe en !important sur les regles de base :
     la selection doit rester bleue par-dessus, en clair comme en sombre. */
  html body.nf-ios-mike .nfm-period-grid button.nfm-period-sel.nfm-period-sel{background:#0F5E92!important}
  html body.nf-ios-mike .nfm-period-grid button.nfm-period-sel.nfm-period-sel span{color:#fff!important}
  html body.nf-ios-mike .nfm-period-years button.nfm-period-on.nfm-period-on{background:#0F5E92!important;color:#fff!important}
  .nfm-period-yearcard{display:flex;align-items:baseline;justify-content:space-between;gap:12px;background:#EAF0F5;border-radius:14px;padding:16px}
  .nfm-period-yearcard-y{font-size:20px;font-weight:700;color:#1E2B38}
  .nfm-period-yearcard-n{font-size:15px;color:#5B6875;font-variant-numeric:tabular-nums}
}
@media(max-width:859px) and (prefers-color-scheme:dark){
  /* Segment choisi plus clair que sa piste, comme sur iOS. */
  html body.nf-ios-mike .nfm-period-seg button.nfm-period-on.nfm-period-on{background:#3A4756!important;box-shadow:none!important}
}
</style>`;
    swap('</head>', css + '</head>', 'styles');
    return html;
  };
})();
