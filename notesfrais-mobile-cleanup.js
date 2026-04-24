(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    const cleanupScript = `<script>(function(){
function isMobile(){return window.innerWidth<860;}
function findActionBlock(){
  const add=[...document.querySelectorAll('button')].find(b=>/^\\+ Ajouter un frais/.test((b.textContent||'').trim()));
  if(!add)return null;
  let el=add.parentElement;
  while(el&&el!==document.body){
    if((el.textContent||'').includes('Import relevé UBS'))return el;
    el=el.parentElement;
  }
  return add.parentElement;
}
function apply(){
  const block=findActionBlock();
  if(!block)return;
  block.style.display=isMobile()?'none':'';
}
window.addEventListener('resize',apply);
window.addEventListener('click',()=>setTimeout(apply,80),true);
const timer=setInterval(apply,300);
setTimeout(()=>clearInterval(timer),15000);
apply();
})();<\/script>`;
    return html.replace('</body>', cleanupScript + '</body>');
  };
})();
