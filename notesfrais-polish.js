(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_POLISH_V1')) return html;

    // Passe de finition visuelle (Thomas, 26 nov. 2026 : « les boutons qui se
    // touchent, les boutons coupes »). Un audit automatique a parcouru chaque
    // vue (Mike sur ordinateur et iPhone, clair et sombre, finance) a la
    // recherche d'elements coupes, de boutons colles et de textes qui se
    // chevauchent ; ce patch corrige ce qu'il a trouve hors de l'espace de
    // travail ordinateur (corrige, lui, dans desk-workspace.js).
    //
    // Charge en dernier, apres dark.js : il porte lui-meme ses couleurs
    // sombres. Chaque cible manquante leve une erreur.
    const rep = (label, target, replacement, count = 1) => {
      const n = html.split(target).length - 1;
      if(n !== count) throw new Error('polish: cible '+label+' trouvee '+n+' fois au lieu de '+count);
      html = html.split(target).join(replacement);
    };

    // 1. Finance, revue des frais : vignettes, Comment, Edit et Delete
    //    s'enroulaient au hasard dans une colonne de 166 px (Delete seul sur
    //    une ligne pour un frais, Edit et Delete ensemble pour un autre).
    //    Desormais deux lignes fixes : justificatifs et commentaires, puis
    //    Edit et Delete.
    rep('colonnes finance', "gridTemplateColumns:isMobile?'1fr':'92px 1fr 118px 166px'",
      "gridTemplateColumns:isMobile?'1fr':'92px 1fr 118px 196px'");
    rep('actions finance',
      "<div style={{display:'flex',gap:8,justifyContent:isMobile?'flex-start':'flex-end',alignItems:'center',flexWrap:'wrap'}}><ReceiptThumbs expense={e} setViewer={setViewer}/><NfCommentsButton expense={e} onUpdated={saveEdited}/><button onClick={()=>setEditing(e)}",
      "<div data-nf-fin-actions=\"true\" style={{display:'flex',flexDirection:'column',gap:8,alignItems:isMobile?'flex-start':'flex-end'}}><div style={{display:'flex',gap:8,justifyContent:isMobile?'flex-start':'flex-end',alignItems:'center',flexWrap:'wrap'}}><ReceiptThumbs expense={e} setViewer={setViewer}/><NfCommentsButton expense={e} onUpdated={saveEdited}/></div><div style={{display:'flex',gap:8}}><button onClick={()=>setEditing(e)}");
    rep('fin actions finance',
      "color:'var(--red)',borderColor:'#F3C6C6'}}>Delete</button></div>\n        </div>})}",
      "color:'var(--red)',borderColor:'#F3C6C6'}}>Delete</button></div></div>\n        </div>})}");

    const css = `<style id="nf-polish-css">
/* NOTESFRAIS_POLISH_V1 */
/* 2. iPhone, liste des frais : la pastille « +1 » (deuxieme justificatif)
   prenait la taille de la vignette (48 px, fond gris) et masquait la photo. */
body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt>.nf-user-receipt-count{
  display:flex!important;align-items:center;justify-content:center;position:absolute!important;
  top:3px!important;right:3px!important;left:auto!important;bottom:auto!important;z-index:3!important;
  width:auto!important;height:17px!important;min-width:17px!important;padding:0 5px!important;
  border-radius:9px!important;background:rgba(20,28,36,.74)!important;box-shadow:none!important;
  color:#fff!important;font-size:10px!important;font-weight:700!important;line-height:17px!important}
/* 3. iPhone : un justificatif PDF donnait une vignette vide (son libelle
   « PDF » est masque avec les autres span de la vignette). */
body.nf-ios-mike .nf-ios-expense-receipt button[title$=".pdf" i]::before{
  content:"PDF";font:700 11px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
  letter-spacing:.03em;color:#0F5E92}
@media (prefers-color-scheme: dark){
  /* ... et cette vignette restait d'un blanc-gris eclatant en mode sombre. */
  html body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt.nf-user-receipt-preview,
  html body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt>button{background:#2C2C2E!important}
  body.nf-ios-mike .nf-ios-expense-receipt button[title$=".pdf" i]::before{color:#64AEE8}
}
</style>`;
    rep('head', '</head>', css + '</head>');
    return html;
  };
})();
