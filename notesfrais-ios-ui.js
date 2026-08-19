(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('notesfrais-ios-ui-v1')) return html;

    html = html.replace(
      /fil\.map\(\(e,i\)=><div key=\{e\.id\} style=/g,
      'fil.map((e,i)=><div key={e.id} className="nf-ios-expense-row" style='
    );
    html = html.replace(
      '<button type="button" onClick={onView} title={`View: ${name}`} style=',
      '<button type="button" className="nf-ios-expense-receipt" onClick={onView} title={`View: ${name}`} style='
    );
    html = html.replace(
      /<button key=\{c\.id\} onClick=\{\(\)=>setFilterCat\(c\.id\)\} style=/g,
      `<button key={c.id} className={filterCat===c.id?'nf-ios-filter-active':''} aria-pressed={filterCat===c.id} onClick={()=>setFilterCat(c.id)} style=`
    );

    const style = `<style id="notesfrais-ios-ui-v1">
@media(max-width:859px){
  html{background:#f2f2f7}
  body.nf-ios-mike{margin:0;background:#f2f2f7!important;color:#111;-webkit-font-smoothing:antialiased}
  body.nf-ios-mike *{box-sizing:border-box}
  body.nf-ios-mike #root>div{display:block!important;min-height:100dvh!important;height:auto!important;overflow:visible!important;padding:0 0 calc(104px + env(safe-area-inset-bottom))!important}
  body.nf-ios-mike .nf-ios-sidebar{display:none!important}
  body.nf-ios-mike .nf-ios-content{overflow:visible!important;padding:0 16px 24px!important;max-width:none!important}
  body.nf-ios-mike .nf-ios-content>div{max-width:none!important}
  #nf-ios-header{position:sticky;top:0;z-index:1200;margin:0 -16px 14px;padding:calc(10px + env(safe-area-inset-top)) 18px 11px;background:rgba(242,242,247,.88);backdrop-filter:saturate(180%) blur(22px);-webkit-backdrop-filter:saturate(180%) blur(22px);border-bottom:.5px solid rgba(60,60,67,.2);display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
  #nf-ios-header .nf-ios-kicker{font-size:11px;font-weight:600;color:#8e8e93;letter-spacing:.02em;margin-bottom:2px}
  #nf-ios-header .nf-ios-title{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;font-size:30px;line-height:1.05;font-weight:750;letter-spacing:0;color:#000}
  #nf-ios-header .nf-ios-profile{width:36px;height:36px;border:0;border-radius:50%;background:#e5e5ea;color:#3c3c43;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
  body.nf-ios-mike .nf-ios-period-header{display:grid!important;gap:12px!important;margin:0 0 14px!important}
  body.nf-ios-mike .nf-ios-period-header>div:first-child{display:none!important}
  body.nf-ios-mike .nf-ios-period-header>div:last-child{min-width:0!important;width:100%!important}
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]{display:grid!important;gap:10px!important;width:100%!important}
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]>div:first-child{display:grid!important;grid-template-columns:repeat(3,1fr);gap:2px!important;padding:2px;background:#e3e3e8;border-radius:9px}
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]>div:first-child button{width:100%!important;min-height:32px!important;border:0!important;border-radius:7px!important;padding:6px 5px!important;background:transparent!important;color:#3c3c43!important;font-size:13px!important;font-weight:600!important;box-shadow:none!important}
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]>div:first-child button.nf-ios-selected{background:#fff!important;color:#111!important;box-shadow:0 1px 3px rgba(0,0,0,.12)!important}
  body.nf-ios-mike select,body.nf-ios-mike input,body.nf-ios-mike textarea{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif!important}
  body.nf-ios-mike .nf-ios-period-header select{height:48px!important;border:0!important;border-radius:12px!important;background:#fff!important;padding:0 42px 0 14px!important;font-size:16px!important;font-weight:500!important;box-shadow:0 0 0 .5px rgba(60,60,67,.16)!important}
  body.nf-ios-mike .nf-ios-legacy-role{display:none!important}
  body.nf-ios-mike .nf-ios-search{height:46px!important;border:0!important;border-radius:12px!important;background:#e3e3e8!important;padding:0 14px 0 38px!important;font-size:16px!important;box-shadow:none!important}
  body.nf-ios-mike .nf-ios-search-wrap{position:relative}
  body.nf-ios-mike .nf-ios-search-wrap:before{content:"⌕";position:absolute;left:13px;top:8px;z-index:1;color:#8e8e93;font-size:24px;line-height:1;pointer-events:none}
  body.nf-ios-mike .nf-ios-filters{display:flex!important;gap:8px!important;overflow-x:auto!important;flex-wrap:nowrap!important;margin:12px -16px 0!important;padding:0 16px 8px!important;scrollbar-width:none;-webkit-overflow-scrolling:touch}
  body.nf-ios-mike .nf-ios-filters::-webkit-scrollbar{display:none}
  body.nf-ios-mike .nf-ios-filters button{flex:0 0 auto!important;min-height:34px!important;border:0!important;border-radius:17px!important;padding:7px 13px!important;background:#fff!important;color:#3c3c43!important;font-size:13px!important;font-weight:600!important;box-shadow:0 0 0 .5px rgba(60,60,67,.18)!important}
  body.nf-ios-mike .nf-ios-filters button.nf-ios-selected,body.nf-ios-mike .nf-ios-filters button.nf-ios-filter-active{background:#007aff!important;color:#fff!important;box-shadow:0 3px 9px rgba(0,122,255,.24)!important}
  body.nf-ios-mike .nf-ios-filters button.nf-ios-selected:before,body.nf-ios-mike .nf-ios-filters button.nf-ios-filter-active:before{content:"✓";display:inline-block;margin-right:5px;font-size:12px;font-weight:800}
  body.nf-ios-mike .nf-ios-empty{min-height:42dvh!important;padding:56px 20px 30px!important;display:flex!important;flex-direction:column;align-items:center;justify-content:center;color:#8e8e93!important}
  body.nf-ios-mike .nf-ios-empty>div:first-child{font-size:0!important;width:64px;height:64px;margin-bottom:14px!important;border-radius:18px;background:#e5e5ea;position:relative}
  body.nf-ios-mike .nf-ios-empty>div:first-child:after{content:"▤";font-size:30px;color:#8e8e93;position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
  body.nf-ios-mike .nf-ios-empty>div:nth-child(2){color:#111;font-size:18px!important;font-weight:700!important}
  body.nf-ios-mike .nf-ios-empty button{display:none!important}
  body.nf-ios-mike .nf-ios-expense-list{border:0!important;border-radius:14px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 0 0 .5px rgba(60,60,67,.14)!important}
  body.nf-ios-mike .nf-ios-expense-list>div{padding:13px 14px!important;gap:11px!important;background:#fff!important}
  body.nf-ios-mike .nf-ios-expense-list>div+div{border-top:.5px solid rgba(60,60,67,.18)!important}
  body.nf-ios-mike .nf-ios-expense-row{display:grid!important;grid-template-columns:64px minmax(0,1fr) auto!important;grid-template-rows:auto auto!important;column-gap:12px!important;row-gap:7px!important;align-items:center!important;min-height:92px}
  body.nf-ios-mike .nf-ios-expense-row>div:nth-child(1){grid-column:1;grid-row:1 / span 2;width:64px!important;height:64px!important;border-radius:14px!important;font-size:28px!important}
  body.nf-ios-mike .nf-ios-expense-row>div:nth-child(2){grid-column:2;grid-row:1;align-self:end!important}
  body.nf-ios-mike .nf-ios-expense-row>div:nth-child(4){grid-column:3;grid-row:1 / span 2;min-width:78px!important;width:auto!important;text-align:right!important;align-self:center!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important}
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt:nth-child(3){grid-column:1;grid-row:1 / span 2}
  body.nf-ios-mike .nf-ios-expense-row:has(>.nf-ios-expense-receipt:nth-child(3))>div:nth-child(1){display:none!important}
  body.nf-ios-mike .nf-ios-expense-icon{grid-column:1;grid-row:1 / span 2;width:64px!important;height:64px!important;border-radius:14px!important;font-size:28px!important}
  body.nf-ios-mike .nf-ios-expense-row.nf-ios-has-receipt .nf-ios-expense-icon{display:none!important}
  body.nf-ios-mike .nf-ios-expense-info{grid-column:2;grid-row:1;align-self:end!important}
  body.nf-ios-mike .nf-ios-expense-info>div:first-child{font-size:16px!important;font-weight:700!important;color:#111!important}
  body.nf-ios-mike .nf-ios-expense-info>div:nth-child(2){margin-top:5px!important;gap:5px!important;font-size:12px!important}
  body.nf-ios-mike .nf-ios-expense-receipt{grid-column:1;grid-row:1 / span 2;width:64px!important;height:64px!important;border:0!important;border-radius:14px!important;box-shadow:0 0 0 .5px rgba(60,60,67,.18)!important;background:#e5e5ea!important}
  body.nf-ios-mike .nf-ios-expense-receipt img{border-radius:14px}
  body.nf-ios-mike .nf-ios-expense-receipt span{display:none!important}
  body.nf-ios-mike .nf-ios-expense-receipt{cursor:zoom-in!important;-webkit-tap-highlight-color:transparent}
  body.nf-ios-mike .nf-ios-receipt-viewer{z-index:4000!important;padding:0!important;background:rgba(0,0,0,.96)!important;justify-content:stretch!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-panel{width:100%!important;max-width:none!important;height:100dvh!important;border-radius:0!important;background:#000!important;box-shadow:none!important;display:flex!important;flex-direction:column!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-header{flex:0 0 auto!important;min-height:calc(58px + env(safe-area-inset-top))!important;padding:calc(10px + env(safe-area-inset-top)) 12px 10px!important;border-bottom:.5px solid rgba(255,255,255,.16)!important;background:rgba(18,18,18,.92)!important;color:#fff!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:space-between!important;gap:10px!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-header>div:first-child{min-width:0!important;flex:1!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-header>div:first-child>div:first-child{font-size:17px!important;font-weight:700!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-header>div:first-child>div:last-child{color:#aeaeb2!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-actions{width:auto!important;flex-wrap:nowrap!important;gap:6px!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-actions a{display:none!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-actions button{width:38px!important;height:38px!important;padding:0!important;border:0!important;border-radius:50%!important;background:#2c2c2e!important;color:#fff!important;font-size:25px!important;display:flex!important;align-items:center!important;justify-content:center!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-media{flex:1 1 auto!important;min-height:0!important;max-height:none!important;padding:12px!important;background:#000!important;overflow:auto!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-media img{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-fit:contain!important;border-radius:0!important}
  body.nf-ios-mike .nf-ios-receipt-viewer-media iframe{width:100%!important;height:100%!important;min-height:0!important;background:#fff!important}
  body.nf-ios-mike .nf-ios-expense-amount{grid-column:3;grid-row:1 / span 2;min-width:78px!important;width:auto!important;text-align:right!important;align-self:center!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important}
  body.nf-ios-mike .nf-ios-expense-amount>div:first-child{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif!important;font-size:15px!important;font-weight:750!important;white-space:nowrap}
  body.nf-ios-mike .nf-ios-expense-actions{margin-top:8px!important;justify-content:flex-end!important}
  body.nf-ios-mike .nf-ios-expense-actions button[title*="View"]{display:none!important}
  body.nf-ios-mike .nf-ios-expense-actions button[title="Delete"],body.nf-ios-mike .nf-ios-expense-actions button[title="Supprimer"]{width:30px;height:30px;border-radius:50%!important;background:#f2f2f7!important;color:#8e8e93!important;font-size:14px!important;padding:0!important}
  body.nf-ios-mike .nf-ios-content button,body.nf-ios-mike #test-bottom-nav button{-webkit-tap-highlight-color:transparent}
  body.nf-ios-mike #test-bottom-nav{left:0!important;right:0!important;bottom:0!important;min-height:calc(68px + env(safe-area-inset-bottom))!important;padding:6px 8px env(safe-area-inset-bottom)!important;border:0!important;border-top:.5px solid rgba(60,60,67,.25)!important;border-radius:0!important;background:rgba(249,249,249,.92)!important;box-shadow:none!important;backdrop-filter:saturate(180%) blur(24px)!important;-webkit-backdrop-filter:saturate(180%) blur(24px)!important;grid-template-columns:repeat(5,1fr)!important}
  body.nf-ios-mike #test-bottom-nav button{height:58px!important;padding:3px 2px!important;border-radius:9px!important;background:transparent!important;color:#8e8e93!important;font-size:10px!important;font-weight:500!important;display:flex!important;flex-direction:column!important;gap:2px!important;line-height:1.1!important}
  body.nf-ios-mike #test-bottom-nav button:before{font-size:23px;line-height:28px;font-weight:400}
  body.nf-ios-mike #test-bottom-nav button[data-tab="expenses"]:before{content:"▤"}
  body.nf-ios-mike #test-bottom-nav button[data-tab="scan"]:before{content:"＋";width:38px;height:38px;line-height:36px;margin-top:-12px;border-radius:50%;background:#007aff;color:#fff;font-size:28px;box-shadow:0 5px 14px rgba(0,122,255,.28)}
  body.nf-ios-mike #test-bottom-nav button[data-tab="stats"]:before{content:"▥"}
  body.nf-ios-mike #test-bottom-nav button[data-tab="recon"]:before{content:"⌁"}
  body.nf-ios-mike #test-bottom-nav button[data-tab="account"]:before{content:"◉"}
  body.nf-ios-mike #test-bottom-nav button.active{color:#007aff!important}
  body.nf-ios-mike #test-bottom-nav button[data-tab="scan"]{color:#007aff!important}
  body.nf-ios-mike #test-scan-cta{display:none!important}
  body.nf-ios-mike>div[style*="position: fixed"][style*="inset: 0"]>div{border-radius:18px 18px 0 0!important;padding:20px 16px calc(18px + env(safe-area-inset-bottom))!important;box-shadow:0 -10px 40px rgba(0,0,0,.15)!important}
  body.nf-ios-mike button{letter-spacing:0!important}
}
</style>`;

    const script = `<script id="notesfrais-ios-ui-script-v1">(function(){
function text(el){return (el&&el.textContent||'').replace(/\\s+/g,' ').trim();}
// Les deux canaux utilisateur portent la meme interface : sans ca, /test ne rend
// pas la couche iOS et ne valide plus ce qu'on livre sur /mike.
function isMikeUser(){return (window.NOTESFRAIS_CHANNEL==='mike'||window.NOTESFRAIS_CHANNEL==='test')&&window.notesFraisRole!=='finance';}
function isMobile(){return window.innerWidth<860;}
function addHeader(content){
  if(document.getElementById('nf-ios-header'))return;
  const header=document.createElement('div');
  header.id='nf-ios-header';
  header.innerHTML='<div><div class="nf-ios-kicker">NUMERIQ EXPENSES</div><div class="nf-ios-title">Expenses</div></div><div class="nf-ios-profile">Mike</div>';
  content.prepend(header);
}
function tagPeriod(content){
  const h1=[...content.querySelectorAll('h1')].find(el=>text(el)==='Expenses');
  const header=h1&&h1.parentElement&&h1.parentElement.parentElement;
  if(header)header.classList.add('nf-ios-period-header');
  if(header){
    const buttons=[...header.querySelectorAll('[data-period-selector="true"]>div:first-child button')];
    buttons.forEach(button=>button.classList.toggle('nf-ios-selected',(button.getAttribute('style')||'').includes('var(--al)')));
  }
}
function hideLegacyRole(){
  [...document.querySelectorAll('button')].filter(button=>text(button)==='Mike'&&button.id!=='nf-ios-header').forEach(button=>button.classList.add('nf-ios-legacy-role'));
}
function openAccount(){
  const role=[...document.querySelectorAll('button')].find(button=>text(button)==='Mike'&&button.closest('#test-bottom-nav')===null);
  if(role)role.click();
}
function tagContent(content){
  content.querySelectorAll('.nf-ios-empty').forEach(el=>el.classList.remove('nf-ios-empty'));
  const search=[...content.querySelectorAll('input')].find(input=>/search receipt/i.test(input.placeholder||''));
  if(search){search.classList.add('nf-ios-search');search.parentElement&&search.parentElement.classList.add('nf-ios-search-wrap');}
  if(search){
    const filters=search.parentElement&&search.parentElement.nextElementSibling;
    if(filters&&filters.querySelectorAll('button').length)filters.classList.add('nf-ios-filters');
  }
  const filterBox=content.querySelector('.nf-ios-filters');
  if(filterBox)[...filterBox.querySelectorAll('button')].forEach(button=>{
    const active=button.getAttribute('aria-pressed')==='true'||button.classList.contains('nf-ios-filter-active');
    button.classList.toggle('nf-ios-selected',active);
  });
  const empty=[...content.querySelectorAll('div')].find(el=>
    /^(No expenses for this month|No expenses for this period)$/.test(text(el))&&
    !el.querySelector('.nf-ios-expense-row')
  );
  if(empty&&empty.parentElement)empty.parentElement.classList.add('nf-ios-empty');
  const directRows=[...content.querySelectorAll('.nf-ios-expense-row')];
  const list=directRows[0]&&directRows[0].parentElement||
    [...content.querySelectorAll('div')].find(el=>el.children.length&&[...el.children].every(child=>child.querySelector&&child.querySelector('button[title="Delete"],button[title="Supprimer"]')));
  if(list){
    list.classList.add('nf-ios-expense-list');
    [...list.children].forEach(row=>{
      if(row.children.length<4)return;
      row.classList.add('nf-ios-expense-row');
      row.children[0].classList.add('nf-ios-expense-icon');
      row.children[1].classList.add('nf-ios-expense-info');
      row.children[2].classList.add('nf-ios-expense-receipt');
      row.children[3].classList.add('nf-ios-expense-amount');
      row.classList.toggle('nf-ios-has-receipt',row.children[2].matches('button')||!!row.children[2].querySelector('button'));
      const actions=row.children[3].querySelector('div:last-child');
      if(actions)actions.classList.add('nf-ios-expense-actions');
    });
  }
}
function tagReceiptViewer(){
  const overlays=[...document.body.querySelectorAll('div')].filter(el=>{
    const style=el.getAttribute('style')||'';
    const fixed=style.includes('position: fixed')||style.includes('position:fixed');
    const fillsScreen=style.includes('inset: 0')||style.includes('inset:0')||style.includes('top: 0')||style.includes('top:0');
    if(!fixed||!fillsScreen)return false;
    return !!el.querySelector('img[alt="justificatif"],img[alt="receipt"],iframe[title="justificatif"],iframe[title="receipt"]');
  });
  overlays.forEach(overlay=>{
    overlay.classList.remove('nf-ios-sidebar','nf-ios-content');
    overlay.classList.add('nf-ios-receipt-viewer');
    const panel=overlay.firstElementChild;
    if(!panel)return;
    panel.classList.add('nf-ios-receipt-viewer-panel');
    const header=panel.children[0];
    const media=panel.children[1];
    if(header){
      header.classList.add('nf-ios-receipt-viewer-header');
      const actions=header.children[1];
      if(actions)actions.classList.add('nf-ios-receipt-viewer-actions');
    }
    if(media)media.classList.add('nf-ios-receipt-viewer-media');
  });
}
function arrangeTabBar(){
  const nav=document.getElementById('test-bottom-nav');
  if(!nav)return;
  let scan=nav.querySelector('[data-tab="scan"]');
  if(!scan){
    scan=document.createElement('button');
    scan.type='button';scan.dataset.tab='scan';scan.textContent='Scan';
    scan.addEventListener('click',()=>{
      const add=[...document.querySelectorAll('button')].find(button=>/^\\+?\\s*(Add expense|Ajouter un frais)/i.test(text(button))&&!button.closest('#test-bottom-nav'));
      if(add)add.click();
    });
  }
  let account=nav.querySelector('[data-tab="account"]');
  if(!account){
    account=document.createElement('button');
    account.type='button';account.dataset.tab='account';account.textContent='Log out';
    account.addEventListener('click',()=>{
      if(window.confirm('Log out of NotesFrais?'))openAccount();
    });
  }
  const expenses=nav.querySelector('[data-tab="expenses"]');
  const stats=nav.querySelector('[data-tab="stats"]');
  const recon=nav.querySelector('[data-tab="recon"]');
  const desired=[expenses,stats,scan,recon,account].filter(Boolean);
  const current=[...nav.children];
  if(desired.some((button,index)=>current[index]!==button)){
    desired.forEach(button=>nav.appendChild(button));
  }
}
function apply(){
  if(!isMikeUser()||!isMobile()){document.body.classList.remove('nf-ios-mike');return;}
  const root=document.getElementById('root');
  const shell=root&&root.firstElementChild;
  if(!shell||shell.children.length<2)return;
  document.body.classList.add('nf-ios-mike');
  const children=[...shell.children];
  const isFixed=child=>{const style=child.getAttribute('style')||'';return style.includes('position: fixed')||style.includes('position:fixed');};
  const content=children.find(child=>child.classList.contains('nf-ios-content')&&!isFixed(child))||
    children.find(child=>!isFixed(child)&&child.querySelector&&child.querySelector('h1,input[placeholder*="receipt"]'));
  const sidebar=children.find(child=>child.classList.contains('nf-ios-sidebar')&&!isFixed(child))||
    children.find(child=>child!==content&&!isFixed(child));
  if(!sidebar||!content)return;
  sidebar.classList.add('nf-ios-sidebar');
  content.classList.add('nf-ios-content');
  addHeader(content);hideLegacyRole();tagPeriod(content);tagContent(content);tagReceiptViewer();arrangeTabBar();
}
window.addEventListener('resize',apply);
window.addEventListener('click',()=>setTimeout(apply,40),true);
new MutationObserver(()=>apply()).observe(document.documentElement,{childList:true,subtree:true});
setInterval(apply,300);
apply();
})();<\/script>`;
    return html.replace('</head>', style + '</head>').replace('</body>', script + '</body>');
  };
})();
