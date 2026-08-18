(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('notesfrais-test-sticky-nav-v5')) return html;

    const script = `<script id="notesfrais-test-sticky-nav-v5">(function(){
const IS_MIKE=window.NOTESFRAIS_CHANNEL==='mike';
const IS_TEST=window.NOTESFRAIS_CHANNEL==='test';
function isMobile(){return window.innerWidth<860;}
function textOf(el){return (el.textContent||'').replace(/\\s+/g,' ').trim();}
function isFinance(){return window.notesFraisRole==='finance';}
function isLocked(){
  const title=textOf(document.querySelector('h1')||document.body);
  return title.startsWith('Code d')||title.startsWith('Access code');
}
function nativeSelect(){
  return [...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='recon')&&([...s.options].some(o=>o.value==='home')||[...s.options].some(o=>o.value==='expenses')||[...s.options].some(o=>o.value==='finance')));
}
function clickNativeNav(target){
  const select=nativeSelect();
  if(select){
    const values=[...select.options].map(o=>o.value);
    let next=target;
    if(next==='expenses'&&!values.includes(next)&&values.includes('history'))next='history';
    if(next==='home'&&!values.includes(next)&&values.includes('expenses'))next='expenses';
    if(values.includes(next)){
      select.value=next;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
  }
  const labels={home:['Accueil','Home'],expenses:['Frais','Expenses','Historique'],history:['Historique','Expenses','Frais'],stats:['Statistiques','Stats'],recon:['UBS'],finance:['Finance'],finance_expenses:['Frais'],settings:['Paramètres','Settings']};
  const btn=[...document.querySelectorAll('button')].find(b=>(labels[target]||[]).some(label=>textOf(b).includes(label))&&b.id!=='test-scan-cta'&&!b.closest('#test-bottom-nav'));
  if(btn)btn.click();
}
function activeTab(){
  const select=nativeSelect();
  if(select&&select.value)return select.value;
  const title=textOf(document.querySelector('h1')||document.body);
  if(title.includes('Finance'))return 'finance';
  if(title.includes('Paramètres')||title.includes('Settings'))return 'settings';
  if(title.includes('Frais')||title.includes('Historique')||title.includes('Expenses'))return !isFinance()?'expenses':'history';
  if(title.includes('Statistiques')||title.includes('Stats'))return 'stats';
  if(title.includes('UBS'))return 'recon';
  return !isFinance()?'expenses':'home';
}
function findAddButton(){
  return [...document.querySelectorAll('button')].find(b=>{
    const text=textOf(b);
    return text.startsWith('+ Ajouter un frais')||text.startsWith('+ Add expense');
  });
}
function appReady(){return !isLocked()&&!!findAddButton();}
function modalOpen(){
  return [...document.querySelectorAll('button')].some(b=>['Confirmer','Confirm','Uploading','Upload en cours','Annuler','Cancel'].some(label=>textOf(b).includes(label)))
    || [...document.querySelectorAll('div')].some(el=>['Ajouter un frais','Add expense'].includes(textOf(el)));
}
function ensureStyle(){
  if(document.getElementById('test-sticky-nav-style'))return;
  const st=document.createElement('style');
  st.id='test-sticky-nav-style';
  st.textContent='@media(max-width:859px){:root{--nf-tabbar-bottom:calc(24px + env(safe-area-inset-bottom));--nf-tabbar-height:72px;--nf-cta-bottom:calc(112px + env(safe-area-inset-bottom));}body{padding-bottom:calc(190px + env(safe-area-inset-bottom))!important}#root>div{padding-bottom:calc(190px + env(safe-area-inset-bottom))!important}#root>div>div:last-child{padding-bottom:calc(220px + env(safe-area-inset-bottom))!important}#mike-bottom-nav,#mike-scan-cta{display:none!important}#test-bottom-nav{position:fixed;left:12px;right:12px;bottom:var(--nf-tabbar-bottom);z-index:4200;background:rgba(255,255,255,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(226,222,216,.96);border-radius:25px;box-shadow:0 16px 44px rgba(26,26,26,.20);display:grid;grid-template-columns:repeat(var(--nf-tab-count,4),1fr);gap:4px;padding:8px;min-height:var(--nf-tabbar-height)}#test-bottom-nav button{border:0;background:transparent;border-radius:18px;padding:14px 4px;color:#6B6560;font-size:12px;font-weight:850;display:flex;align-items:center;justify-content:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent}#test-bottom-nav button.active{background:#EEF2FD;color:#1A3FB5}#test-scan-cta{position:fixed;left:18px;right:18px;bottom:var(--nf-cta-bottom);z-index:4210;border:0;border-radius:22px;padding:15px 18px;background:linear-gradient(135deg,#FFB000,#FF6A00 68%,#FF3D00);color:#1A1200;font-weight:900;font-size:16px;letter-spacing:.01em;box-shadow:0 18px 42px rgba(255,106,0,.42),0 0 0 1px rgba(255,255,255,.55) inset;display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity .16s ease,transform .16s ease;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.test-hidden{opacity:0!important;pointer-events:none!important;transform:translateY(12px)!important}}@media(min-width:860px){#test-bottom-nav,#test-scan-cta{display:none!important}}';
  document.head.appendChild(st);
}
function hideFloating(){
  const nav=document.getElementById('test-bottom-nav');
  const cta=document.getElementById('test-scan-cta');
  if(nav)nav.style.display='none';
  if(cta)cta.style.display='none';
}
function navItems(){
  if(isFinance())return [['finance','Finance'],['finance_expenses','Frais'],['stats','Stats'],['recon','UBS'],['settings','Paramètres']];
  return [['expenses',IS_MIKE?'Expenses':'Frais'],['stats','Stats'],['recon','UBS']];
}
function ensureBottomNav(){
  const items=navItems();
  let nav=document.getElementById('test-bottom-nav');
  const signature=items.map(x=>x.join(':')).join('|');
  if(!nav||nav.dataset.signature!==signature){
    if(nav)nav.remove();
    nav=document.createElement('div');
    nav.id='test-bottom-nav';
    nav.dataset.signature=signature;
    nav.style.setProperty('--nf-tab-count',String(items.length));
    items.forEach(([id,label])=>{
      const b=document.createElement('button');
      b.type='button';
      b.dataset.tab=id;
      b.textContent=label;
      b.addEventListener('click',()=>clickNativeNav(id));
      nav.appendChild(b);
    });
    document.body.appendChild(nav);
  }
  const tab=activeTab();
  [...nav.querySelectorAll('button')].forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  nav.style.display=isMobile()?'grid':'none';
}
function ensureScanCta(){
  let cta=document.getElementById('test-scan-cta');
  if(!cta){
    cta=document.createElement('button');
    cta.id='test-scan-cta';
    cta.type='button';
    cta.textContent=IS_MIKE?'Scan receipt':'Scanner un reçu';
    cta.addEventListener('click',()=>{const add=findAddButton();if(add)add.click();});
    document.body.appendChild(cta);
  }
  const show=isMobile()&&!isFinance()&&!modalOpen();
  cta.classList.toggle('test-hidden',!show);
  cta.style.display=isMobile()?'flex':'none';
}
function tick(){
  ensureStyle();
  if(!appReady()){hideFloating();return;}
  ensureBottomNav();
  ensureScanCta();
}
window.addEventListener('resize',tick);
window.addEventListener('scroll',tick,true);
window.addEventListener('click',()=>setTimeout(tick,80),true);
setInterval(tick,150);
tick();
})();<\/script>`;

    return html.replace('</body>', script + '</body>');
  };
})();
