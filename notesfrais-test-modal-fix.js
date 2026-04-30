(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('notesfrais-test-modal-fix')) return html;

    const script = `<script id="notesfrais-test-modal-fix">(function(){
function isMobile(){return window.innerWidth<860;}
function textOf(el){return (el.textContent||'').replace(/\\s+/g,' ').trim();}
function addStyle(){
  if(document.getElementById('test-modal-fix-style'))return;
  const st=document.createElement('style');
  st.id='test-modal-fix-style';
  st.textContent='@media(max-width:859px){.test-expense-modal-shell{align-items:flex-end!important;justify-content:center!important;padding:0!important;overflow:hidden!important}.test-expense-modal-card{width:100%!important;max-width:100%!important;max-height:calc(92dvh - env(safe-area-inset-top))!important;height:auto!important;margin:0!important;border-radius:22px 22px 0 0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;padding:18px 18px calc(34px + env(safe-area-inset-bottom))!important}.test-expense-modal-card input,.test-expense-modal-card select,.test-expense-modal-card textarea{font-size:16px!important}.test-expense-modal-card button{min-height:44px}}';
  document.head.appendChild(st);
}
function findModalTitle(){
  return [...document.querySelectorAll('div')].find(el=>/^Ajouter un frais$|^Add expense$/.test(textOf(el)));
}
function findCard(title){
  let el=title;
  while(el&&el!==document.body){
    const style=el.getAttribute('style')||'';
    if(style.includes('background')&&style.includes('255, 255, 255')&&style.includes('max-height'))return el;
    if(style.includes('background')&&style.includes('#fff')&&style.includes('maxHeight'))return el;
    el=el.parentElement;
  }
  return null;
}
function findShell(card){
  let el=card&&card.parentElement;
  while(el&&el!==document.body){
    const style=el.getAttribute('style')||'';
    if(style.includes('position')&&style.includes('fixed')&&style.includes('inset'))return el;
    el=el.parentElement;
  }
  return null;
}
function apply(){
  addStyle();
  const title=findModalTitle();
  const card=findCard(title);
  const shell=findShell(card);
  if(card){
    card.classList.add('test-expense-modal-card');
    if(isMobile()){
      card.style.setProperty('position','fixed','important');
      card.style.setProperty('left','0','important');
      card.style.setProperty('right','0','important');
      card.style.setProperty('top','auto','important');
      card.style.setProperty('bottom','0','important');
      card.style.setProperty('width','100%','important');
      card.style.setProperty('max-width','100%','important');
      card.style.setProperty('max-height','calc(92dvh - env(safe-area-inset-top))','important');
      card.style.setProperty('overflow-y','auto','important');
      card.style.setProperty('-webkit-overflow-scrolling','touch','important');
    }
  }
  if(shell){
    shell.classList.add('test-expense-modal-shell');
    if(isMobile())shell.style.setProperty('z-index','5000','important');
  }
}
window.addEventListener('resize',apply);
window.addEventListener('click',()=>setTimeout(apply,80),true);
setInterval(apply,150);
apply();
})();<\/script>`;

    return html.replace('</body>', script + '</body>');
  };
})();
