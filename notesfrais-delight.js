(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    const delightScript = `<script>(function(){
function isMobile(){return window.innerWidth<860;}
function findAddButton(){return [...document.querySelectorAll('button')].find(b=>/^\\+ Ajouter un frais/.test((b.textContent||'').trim()));}
function currentTab(){const nav=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.textContent==='Accueil')&&[...s.options].some(o=>o.textContent==='Relevé UBS'));return nav?nav.value:null;}
function monthTitle(){return [...document.querySelectorAll('h1')].find(x=>/2026/.test(x.textContent||''))||null;}
function submitVisible(){
  const btn=[...document.querySelectorAll('button')].find(b=>/(Soumettre les frais du mois|Frais soumis)/.test(b.textContent||''));
  if(!btn)return false;
  const r=btn.getBoundingClientRect();
  return r.top<window.innerHeight-24&&r.bottom>0;
}
function receiptFormOpen(){
  return [...document.querySelectorAll('div')].some(el=>/^Ajouter un frais$/.test((el.textContent||'').trim()))||[...document.querySelectorAll('button')].some(b=>/^Confirmer$|Upload en cours/.test((b.textContent||'').trim()));
}
function injectStyles(){
  if(document.getElementById('mike-delight-style'))return;
  const st=document.createElement('style');
  st.id='mike-delight-style';
  st.textContent='@media(max-width:859px){body{background:linear-gradient(180deg,#F8F6F1 0%,#EFEAE1 100%)!important}button,select,input{touch-action:manipulation}button:active{transform:scale(.985)}#mike-scan-cta{position:fixed;left:16px;right:16px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:1600;border:0;border-radius:22px;padding:16px 18px;background:linear-gradient(135deg,#123B91,#2D5BE3 68%,#4C7DFF);color:#fff;font-weight:800;font-size:16px;letter-spacing:.01em;box-shadow:0 18px 42px rgba(45,91,227,.35);display:flex;align-items:center;justify-content:center;gap:10px;transition:opacity .16s ease,transform .16s ease}#mike-scan-cta span{font-size:20px}#mike-home-card{animation:mikeIn .28s ease-out both}@keyframes mikeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}}';
  document.head.appendChild(st);
}
function modalOpen(){return receiptFormOpen()||[...document.querySelectorAll('button')].some(b=>/^Annuler$/.test((b.textContent||'').trim()))||[...document.querySelectorAll('div')].some(el=>{const s=el.getAttribute('style')||'';return s.includes('position: fixed')&&s.includes('rgba(0,0,0');});}
function injectCta(){
  let cta=document.getElementById('mike-scan-cta');
  if(!isMobile()){if(cta)cta.remove();return;}
  const add=findAddButton();
  if(!add)return;
  if(!cta){
    cta=document.createElement('button');
    cta.id='mike-scan-cta';
    cta.innerHTML='<span>📸</span> Scanner un reçu';
    cta.addEventListener('click',()=>{const target=findAddButton();if(target)target.click();});
    document.body.appendChild(cta);
  }
  const shouldHide=modalOpen()||submitVisible();
  cta.style.opacity=shouldHide?'0':'1';
  cta.style.pointerEvents=shouldHide?'none':'auto';
  cta.style.transform=shouldHide?'translateY(12px)':'translateY(0)';
}
function injectHomeCard(){
  const old=document.getElementById('mike-home-card');
  if(!isMobile()||currentTab()!=='home'){if(old)old.remove();return;}
  const h=monthTitle();
  if(!h||old)return;
  const root=h.parentElement;
  if(!root)return;
  const card=document.createElement('div');
  card.id='mike-home-card';
  card.style.cssText='margin:0 0 16px 0;padding:18px;border-radius:24px;background:radial-gradient(circle at 15% 15%,rgba(255,255,255,.45),transparent 28%),linear-gradient(135deg,#102B68,#1A3FB5 62%,#3373FF);color:white;box-shadow:0 22px 44px rgba(26,63,181,.22);overflow:hidden';
  card.innerHTML='<div style="font-size:12px;opacity:.72;margin-bottom:8px;letter-spacing:.08em;text-transform:uppercase">Mode terrain</div><div style="font-size:24px;font-weight:850;line-height:1.05;margin-bottom:8px">Salut Mike, on capture ça vite.</div><div style="font-size:13px;opacity:.82;line-height:1.45">Prends le reçu, vérifie le montant, et c’est rangé pour la finance.</div>';
  root.insertBefore(card,h);
}
function tick(){injectStyles();injectCta();injectHomeCard();}
window.addEventListener('resize',tick);
window.addEventListener('scroll',tick,true);
window.addEventListener('click',()=>setTimeout(tick,80),true);
const timer=setInterval(tick,200);
setTimeout(()=>clearInterval(timer),30000);
tick();
})();<\/script>`;
    return html.replace('</body>', delightScript + '</body>');
  };
})();
