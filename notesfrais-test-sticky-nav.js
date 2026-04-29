(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'test') return html;
    if(html.includes('notesfrais-test-sticky-nav')) return html;

    const script = `<script id="notesfrais-test-sticky-nav">(function(){
function isMobile(){return window.innerWidth<860;}
function navSelect(){return [...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>/Accueil/.test(o.textContent||''))&&[...s.options].some(o=>/UBS/.test(o.textContent||'')));}
function currentTab(){const nav=navSelect();return nav?nav.value:null;}
function modalOpen(){
  return [...document.querySelectorAll('button')].some(b=>/^Confirmer$|Upload en cours|Annuler$/.test((b.textContent||'').trim()))
    || [...document.querySelectorAll('div')].some(el=>/^Ajouter un frais$/.test((el.textContent||'').trim()));
}
function ensureStyle(){
  if(document.getElementById('test-sticky-nav-style'))return;
  const st=document.createElement('style');
  st.id='test-sticky-nav-style';
  st.textContent='@media(max-width:859px){body{padding-bottom:calc(138px + env(safe-area-inset-bottom))!important}#root>div{padding-bottom:calc(150px + env(safe-area-inset-bottom))!important}#root>div>div:last-child{padding-bottom:calc(170px + env(safe-area-inset-bottom))!important}#mike-bottom-nav{position:fixed!important;left:10px!important;right:10px!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;z-index:2400!important;display:grid!important;opacity:1!important;pointer-events:auto!important;transform:translateY(0)!important;visibility:visible!important}#mike-scan-cta{position:fixed!important;left:18px!important;right:18px!important;bottom:calc(86px + env(safe-area-inset-bottom))!important;z-index:2410!important;visibility:visible!important}.test-hide-scan{opacity:0!important;pointer-events:none!important;transform:translateY(12px)!important}.test-show-scan{opacity:1!important;pointer-events:auto!important;transform:translateY(0)!important}}';
  document.head.appendChild(st);
}
function forceBottomNav(){
  const nav=document.getElementById('mike-bottom-nav');
  if(!isMobile()||!nav)return;
  nav.style.display='grid';
  nav.style.opacity='1';
  nav.style.pointerEvents='auto';
  nav.style.transform='translateY(0)';
  nav.style.visibility='visible';
}
function forceScanCta(){
  const cta=document.getElementById('mike-scan-cta');
  if(!isMobile()||!cta)return;
  const shouldShow=currentTab()==='home'&&!modalOpen();
  cta.classList.toggle('test-show-scan',shouldShow);
  cta.classList.toggle('test-hide-scan',!shouldShow);
  if(shouldShow){
    cta.style.display='flex';
    cta.style.visibility='visible';
  }
}
function tick(){
  ensureStyle();
  forceBottomNav();
  forceScanCta();
}
window.addEventListener('resize',tick);
window.addEventListener('scroll',tick,true);
window.addEventListener('click',()=>setTimeout(tick,60),true);
setInterval(tick,120);
tick();
})();<\/script>`;

    return html.replace('</body>', script + '</body>');
  };
})();
