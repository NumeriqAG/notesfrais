/*
 * Refonte mobile — direction iOS native (maquette « NotesFrais Mobile », option 1a).
 *
 * Ce patch est le DERNIER de la chaine : il voit donc le source deja reecrit en
 * anglais par mike-en / english-ui, et ses propres chaines ne sont plus
 * substituees. C'est voulu — il ecrit son texte en anglais directement.
 *
 * Trois leviers, dans l'ordre du rapport effet/risque decrit dans design/README.md :
 *
 *   1. Un bloc <style> injecte, sous 860px seulement, accroche aux classes que
 *      ios-ui.js pose deja (.nf-ios-expense-row, .nf-ios-filters, #nf-ios-header…).
 *      C'est lui qui fait l'essentiel du travail : fond gris systeme, listes
 *      groupees encartees, #1A3FB5 comme accent unique, chiffres tabulaires.
 *   2. Quelques insertions JSX ciblees pour les blocs qui n'existent pas encore
 *      (recapitulatif du mois, bandeaux hors ligne / mois clos, feuille de
 *      capture, progression de soumission en trois etapes).
 *   3. Aucune retouche des 537 styles inline un par un.
 *
 * Regle de survie du depot : un replace() qui ne matche pas est silencieux. Ici
 * chaque ancre passe par must()/mustRe(), qui LEVE. Un patch casse se voit au
 * chargement et dans `node tools/check-patches.js`, jamais en silence.
 *
 * Les libelles de navigation (`Expenses`, `Stats`, `UBS`, `Scan receipt`,
 * `+ Add expense`) et les textes que ios-ui.js repere pour taguer le DOM
 * (« No expenses for this month ») sont conserves au mot : sticky-nav.js et
 * ios-ui.js les cherchent par leur texte visible.
 */
(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(!['test','mike'].includes(window.NOTESFRAIS_CHANNEL)) return html;
    if(html.includes('notesfrais-mobile-redesign-v1')) return html;

    // Ancres dures : on prefere une erreur au chargement a une refonte qui
    // disparait sans un mot.
    const must = (from, to) => {
      if(html.indexOf(from) === -1){
        throw new Error('mobile-redesign: ancre introuvable -> ' + from.slice(0, 90));
      }
      html = html.replace(from, to);
    };
    const mustRe = (re, to) => {
      if(!re.test(html)){
        throw new Error('mobile-redesign: motif introuvable -> ' + String(re).slice(0, 90));
      }
      html = html.replace(re, to);
    };

    // ───────────────────────────────────────────────────────────────
    // 1 · La couche visuelle
    // ───────────────────────────────────────────────────────────────
    const style = `<style id="notesfrais-mobile-redesign-v1">
@media(max-width:859px){
  body.nf-ios-mike{
    --nfm-accent:#1A3FB5;--nfm-accent-l:#EDF0FA;
    --nfm-bg:#F2F2F7;--nfm-t2:#3C3C43;--nfm-t3:#8E8E93;
    --nfm-sep:.5px solid rgba(60,60,67,.16);
    --nfm-hair:0 0 0 .5px rgba(60,60,67,.13);
    --nfm-green:#0F6E56;--nfm-gl:#E1F5EE;
    --nfm-amber:#BA7517;--nfm-aml:#FAEEDA;
    --nfm-red:#A32D2D;
    /* Les 15 jetons du :root sont references partout via var(--…) :
       les redefinir repeint l'app sans toucher un seul style inline. */
    --accent:#1A3FB5;--al:#EDF0FA;--bg:#F2F2F7;--s2:#EFEFF3;--border:rgba(60,60,67,.16);
    --text:#000;--t2:#3C3C43;--t3:#8E8E93;
    background:#F2F2F7!important;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif!important;
    -webkit-font-smoothing:antialiased;
  }
  body.nf-ios-mike input,body.nf-ios-mike select,body.nf-ios-mike textarea,body.nf-ios-mike button{
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif!important;
  }
  /* CHF et TVA sont des donnees comptables : chiffres tabulaires, alignes. */
  body.nf-ios-mike .nf-ios-expense-amount,body.nf-ios-mike .nfm-num,
  body.nf-ios-mike [style*="DM Mono"]{
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif!important;
    font-variant-numeric:tabular-nums!important;font-feature-settings:"tnum" 1!important;
  }

  /* ── En-tete : grand titre qui se compacte au defilement ─────────── */
  body.nf-ios-mike #nf-ios-header{
    padding:calc(9px + env(safe-area-inset-top)) 18px 9px!important;
    margin:0 -16px 14px!important;
    background:#F2F2F7!important;
    align-items:flex-end!important;
    transition:padding .18s ease;
  }
  body.nf-ios-mike #nf-ios-header .nf-ios-kicker{
    font-size:10px!important;font-weight:700!important;letter-spacing:.06em!important;
    color:var(--nfm-t3)!important;margin-bottom:2px!important;
  }
  body.nf-ios-mike #nf-ios-header .nf-ios-title{
    font-size:27px!important;font-weight:700!important;letter-spacing:-.022em!important;
    line-height:1.05!important;color:#000!important;transition:font-size .18s ease;
  }
  body.nf-ios-mike #nf-ios-header.nfm-compact{padding-top:calc(7px + env(safe-area-inset-top))!important;padding-bottom:8px!important}
  body.nf-ios-mike #nf-ios-header.nfm-compact .nf-ios-title{font-size:17px!important}
  body.nf-ios-mike #nf-ios-header.nfm-compact .nf-ios-kicker{font-size:9.5px!important}
  /* Pastille de compte : l'initiale, pas le nom complet. */
  body.nf-ios-mike #nf-ios-header .nf-ios-profile{
    width:30px!important;height:30px!important;border-radius:15px!important;
    background:var(--nfm-accent)!important;color:#fff!important;font-size:0!important;flex:none;
  }
  body.nf-ios-mike #nf-ios-header .nf-ios-profile:before{content:"M";font-size:12px;font-weight:700}

  /* ── Ordre de lecture de l'onglet Expenses ───────────────────────── */
  body.nf-ios-mike [data-nfm-expenses]{display:flex!important;flex-direction:column!important}
  body.nf-ios-mike [data-nfm-expenses]>*{order:5}
  body.nf-ios-mike [data-nfm-expenses]>[data-user-submit-placement]{order:1}
  body.nf-ios-mike [data-nfm-expenses]>.nf-ios-period-header{order:2}
  body.nf-ios-mike [data-nfm-expenses]>div:has(>.nf-ios-search){order:3}
  body.nf-ios-mike [data-nfm-expenses]>.nf-ios-filters{order:4}

  /* ── Recapitulatif du mois ───────────────────────────────────────── */
  body.nf-ios-mike [data-user-submit-placement]{
    background:#fff!important;border:0!important;border-radius:16px!important;
    box-shadow:var(--nfm-hair)!important;padding:15px 16px 13px!important;
    margin-bottom:14px!important;display:flex!important;flex-direction:column!important;
  }
  body.nf-ios-mike .nfm-sum-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  body.nf-ios-mike .nfm-sum-label{font-size:11px;font-weight:600;color:var(--nfm-t3);letter-spacing:.02em}
  /* « CHF 12'480.55 » doit tenir sur une ligne, y compris sur un iPhone SE. */
  body.nf-ios-mike .nfm-sum-total{
    font-size:clamp(25px,7.7vw,31px);font-weight:700;letter-spacing:-.03em;line-height:1.1;margin-top:3px;
    font-variant-numeric:tabular-nums;color:#000;white-space:nowrap;
  }
  body.nf-ios-mike .nfm-badge{
    flex:none;padding:5px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;
  }
  body.nf-ios-mike .nfm-badge-open{background:var(--nfm-accent-l);color:var(--nfm-accent)}
  body.nf-ios-mike .nfm-badge-closed{background:var(--nfm-gl);color:var(--nfm-green)}
  body.nf-ios-mike .nfm-sum-grid{
    display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px;padding-top:13px;border-top:var(--nfm-sep);
  }
  body.nf-ios-mike .nfm-sum-k{font-size:11px;color:var(--nfm-t3);font-weight:500}
  body.nf-ios-mike .nfm-sum-v{font-size:17px;font-weight:650;margin-top:3px;font-variant-numeric:tabular-nums}
  body.nf-ios-mike .nfm-track{height:4px;border-radius:99px;background:#E9E9EE;margin-top:12px;overflow:hidden}
  body.nf-ios-mike .nfm-track>i{display:block;height:100%;border-radius:99px;background:var(--nfm-accent)}
  /* Le bouton de soumission reel, restyle — la logique n'est pas touchee. */
  body.nf-ios-mike [data-user-submit-placement]>button:not(.nfm-add-link){
    order:9;width:100%!important;min-width:0!important;min-height:46px!important;margin-top:14px!important;
    border:0!important;border-radius:13px!important;background:var(--nfm-accent)!important;color:#fff!important;
    font-size:16px!important;font-weight:600!important;letter-spacing:-.01em!important;justify-content:center!important;
    box-shadow:none!important;
  }
  body.nf-ios-mike [data-user-submit-placement]>button:not(.nfm-add-link):disabled{
    background:#E9E9EE!important;color:var(--nfm-t3)!important;opacity:1!important;
  }

  /* ── Bandeau de contexte, juste au-dessus de la liste ──────────────
     Il reprend le compte et le total : la carte du haut sort de l'ecran
     des le premier defilement, cette ligne reste avec les frais. */
  body.nf-ios-mike .nfm-strip{
    display:flex;align-items:baseline;justify-content:space-between;gap:12px;
    padding:0 4px 8px;font-size:11.5px;font-weight:700;letter-spacing:.04em;color:var(--nfm-t3);
  }
  body.nf-ios-mike .nfm-strip>b{
    font-weight:700;color:var(--nfm-t2);font-variant-numeric:tabular-nums;letter-spacing:0;
  }
  /* Le lien d'ajout manuel, sous le bouton de soumission. */
  body.nf-ios-mike .nfm-add-link{
    order:10;width:100%;min-height:40px;margin-top:6px;border:0;background:transparent;
    color:var(--nfm-accent);font-size:15.5px;font-weight:600;cursor:pointer;
  }

  /* ── Bandeaux d'etat ─────────────────────────────────────────────── */
  body.nf-ios-mike .nfm-banner{
    display:flex;gap:12px;align-items:flex-start;border-radius:14px;padding:14px 16px;margin-bottom:14px;
  }
  /* Hors ligne : bleu neutre et un compteur. Ce n'est pas une panne. */
  body.nf-ios-mike .nfm-banner-offline{background:var(--nfm-accent-l)}
  body.nf-ios-mike .nfm-banner-offline .nfm-count{
    flex:none;width:22px;height:22px;border-radius:11px;background:var(--nfm-accent);color:#fff;
    font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;
  }
  body.nf-ios-mike .nfm-banner-closed{background:var(--nfm-gl);align-items:center}
  body.nf-ios-mike .nfm-banner-closed .nfm-tag{
    flex:none;padding:4px 9px;border-radius:9px;background:var(--nfm-green);color:#fff;
    font-size:11px;font-weight:800;letter-spacing:.04em;
  }
  body.nf-ios-mike .nfm-banner-t{font-size:15px;font-weight:600;letter-spacing:-.01em}
  body.nf-ios-mike .nfm-banner-s{font-size:13px;line-height:1.4;color:var(--nfm-t2);margin-top:3px}
  body.nf-ios-mike .nfm-banner-closed .nfm-banner-s{color:#0F5544;margin-top:0}

  /* ── Periode, recherche, filtres ─────────────────────────────────── */
  /* Le conteneur fait 361px mais sa piste de grille se calait sur le contenu :
     le selecteur et le segmente s'arretaient a 205px, la ou la maquette les
     veut pleine largeur. */
  body.nf-ios-mike .nf-ios-period-header{margin:0 0 10px!important;grid-template-columns:minmax(0,1fr)!important;justify-items:stretch!important}
  body.nf-ios-mike .nf-ios-period-header>div:last-child,
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"],
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]>div:first-child,
  body.nf-ios-mike .nf-ios-period-header select{width:100%!important;min-width:0!important;max-width:none!important}
  /* Le <select> gardait la fleche du systeme et son texte centre : il lisait
     comme un formulaire, pas comme une rangee de reglages iOS. On garde le
     controle natif — c'est lui qui ouvre la roulette iOS — et on lui donne
     l'apparence d'une rangee a chevron. */
  body.nf-ios-mike .nf-ios-period-header select{
    -webkit-appearance:none!important;appearance:none!important;
    background:#fff url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%228%22%20height%3D%2213%22%20viewBox%3D%220%200%208%2013%22%3E%3Cpath%20d%3D%22M1.4%201.4%206.5%206.5%201.4%2011.6%22%20fill%3D%22none%22%20stroke%3D%22%23C3C3C7%22%20stroke-width%3D%221.9%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E") no-repeat right 15px center!important;
    padding:0 38px 0 15px!important;text-align:left!important;color:#000!important;
    font-size:16px!important;font-weight:500!important;
  }
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]>div:first-child{
    background:#E3E3E8!important;border-radius:10px!important;
  }
  body.nf-ios-mike .nf-ios-period-header [data-period-selector="true"]>div:first-child button.nf-ios-selected{
    background:#fff!important;color:#000!important;
  }
  body.nf-ios-mike .nf-ios-period-header select{
    border-radius:13px!important;box-shadow:var(--nfm-hair)!important;height:44px!important;
  }
  body.nf-ios-mike .nf-ios-search{
    background:#E3E3E8!important;border-radius:11px!important;height:40px!important;font-size:16px!important;
  }
  body.nf-ios-mike .nf-ios-filters{margin:10px -16px 14px!important;padding:2px 16px 6px!important}
  body.nf-ios-mike .nf-ios-filters button{
    border-radius:16px!important;padding:6px 13px!important;font-size:12.5px!important;font-weight:600!important;
    background:#fff!important;color:var(--nfm-t2)!important;box-shadow:0 0 0 .5px rgba(60,60,67,.16)!important;
  }
  body.nf-ios-mike .nf-ios-filters button.nf-ios-selected,
  body.nf-ios-mike .nf-ios-filters button.nf-ios-filter-active{
    background:var(--nfm-accent)!important;color:#fff!important;
    box-shadow:0 3px 10px rgba(26,63,181,.22)!important;
  }
  /* Pastilles texte : pas de coche postiche devant le libelle. */
  body.nf-ios-mike .nf-ios-filters button.nf-ios-selected:before,
  body.nf-ios-mike .nf-ios-filters button.nf-ios-filter-active:before{content:none!important}

  /* ── La liste : le justificatif d'abord ──────────────────────────── */
  body.nf-ios-mike .nf-ios-expense-list{
    background:#fff!important;border:0!important;border-radius:16px!important;overflow:hidden!important;
    box-shadow:var(--nfm-hair)!important;
  }
  body.nf-ios-mike .nf-ios-expense-list>div{padding:10px 13px!important;background:#fff!important}
  body.nf-ios-mike .nf-ios-expense-list>div+div{border-top:var(--nfm-sep)!important}
  body.nf-ios-mike .nf-ios-expense-row{
    display:grid!important;grid-template-columns:48px minmax(0,1fr) auto!important;
    grid-template-rows:auto!important;column-gap:12px!important;row-gap:0!important;
    align-items:center!important;min-height:0!important;
  }
  /* La pastille de categorie disparait : la vignette est la piece. */
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-icon{display:none!important}
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt{
    order:1;width:48px!important;height:48px!important;border-radius:12px!important;
    overflow:hidden;flex:none;position:relative;
  }
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt,
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt>*{
    border:0!important;box-shadow:inset 0 0 0 .5px rgba(60,60,67,.14)!important;background:#EFEFF3!important;
  }
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt>*{
    width:48px!important;height:48px!important;border-radius:12px!important;
  }
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt img{
    width:48px!important;height:48px!important;object-fit:cover!important;
  }
  /* Le ticket manquant est ce qui doit se remarquer : c'est la piece qui
     manquera au ZIP de fin de mois, pas un detail d'affichage.
     La vignette « sans recu » est le noeud lui-meme (Thumb rend un div nu),
     pas un enfant : le selecteur porte sur l'element, pas sur ses enfants. */
  body.nf-ios-mike .nf-ios-expense-row:not(.nf-ios-has-receipt)>.nf-ios-expense-receipt{
    background:var(--nfm-aml)!important;box-shadow:inset 0 0 0 .5px rgba(186,117,23,.3)!important;
    font-size:0!important;color:transparent!important;
  }
  body.nf-ios-mike .nf-ios-expense-row:not(.nf-ios-has-receipt)>.nf-ios-expense-receipt:after{
    content:"NO\\A PHOTO";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    text-align:center;font-size:10px;font-weight:800;line-height:1.15;color:var(--nfm-amber);white-space:pre;
  }
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-info{order:2;min-width:0}
  body.nf-ios-mike .nf-ios-expense-info>div:first-child{
    font-size:15px!important;font-weight:600!important;letter-spacing:-.01em!important;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  /* Deux lignes de meta au plus : au-dela, chaque frais faisait 200px de haut
     et la liste ne se lisait plus d'un coup d'oeil. On borne la hauteur
     plutot que d'interdire le retour a la ligne, qui tronquait les pastilles
     en plein milieu d'un mot. */
  body.nf-ios-mike .nf-ios-expense-info>div:nth-child(2){
    font-size:12.5px!important;color:var(--nfm-t3)!important;margin-top:3px!important;gap:6px!important;
    flex-wrap:wrap!important;row-gap:4px!important;overflow:hidden!important;max-height:44px!important;
  }
  /* « UBS: … » repete ce que dit deja la pastille « Matched ». */
  body.nf-ios-mike .nf-ios-expense-info>div:nth-child(3){display:none!important}
  /* La date reste du texte ; seuls le statut et la carte deviennent des pastilles. */
  body.nf-ios-mike .nf-ios-expense-info>div:nth-child(2) span:not(:first-child){
    padding:2px 7px!important;border-radius:6px!important;font-size:10.5px!important;font-weight:600!important;
    background:#F2F2F7!important;color:#6B6B70!important;
  }
  body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-amount{
    order:3;text-align:right!important;min-width:0!important;width:auto!important;flex:none;
  }
  body.nf-ios-mike .nf-ios-expense-amount>div:first-child{
    font-size:15px!important;font-weight:700!important;white-space:nowrap;font-variant-numeric:tabular-nums;
  }
  body.nf-ios-mike .nf-ios-expense-actions{
    justify-content:flex-end!important;gap:10px!important;margin-top:6px!important;
  }
  body.nf-ios-mike .nf-ios-expense-actions button{
    font-size:15px!important;font-weight:600!important;
    min-width:30px!important;min-height:30px!important;justify-content:center!important;
  }

  /* ── Liste vide, premier usage ─────────────────────────────────────
     Un total a CHF 0.00 n'apprend rien le premier jour : on laisse
     l'ecran vide expliquer ce que l'app fera. */
  body.nf-ios-mike [data-nfm-expenses]:has(.nf-ios-empty)>[data-user-submit-placement]{display:none!important}
  body.nf-ios-mike [data-nfm-expenses]>.nf-ios-empty{order:0}
  body.nf-ios-mike .nf-ios-empty{padding:46px 24px 40px!important;min-height:0!important}
  body.nf-ios-mike .nf-ios-empty>div:first-child{
    width:74px;height:74px;border-radius:20px;margin-bottom:18px!important;
    background:repeating-linear-gradient(135deg,#E5E5EA 0 7px,#DCDCE1 7px 14px)!important;
  }
  body.nf-ios-mike .nf-ios-empty>div:first-child:after{content:none!important}
  body.nf-ios-mike .nf-ios-empty>div:nth-child(2){
    font-size:19px!important;font-weight:700!important;letter-spacing:-.01em!important;color:#000!important;
  }
  body.nf-ios-mike .nfm-empty-hint{
    font-size:14px;line-height:1.5;color:var(--nfm-t3);max-width:250px;margin:6px auto 0;
  }
  /* Le libelle « + Add expense » reste au mot : sticky-nav.js le cherche. */
  body.nf-ios-mike .nf-ios-empty button{
    display:inline-flex!important;margin-top:20px!important;min-height:50px!important;padding:0 22px!important;
    border:0!important;border-radius:14px!important;background:var(--nfm-accent)!important;color:#fff!important;
    font-size:17px!important;font-weight:600!important;
  }

  /* ── Barre basse : le pouce en bas ───────────────────────────────
     ios-ui.js prefixe ses regles de body.nf-ios-mike : on fait de meme,
     sinon elles sont plus specifiques et gagnent malgre l'ordre. */
  /* Le bouton pleine largeur revient : 52px sous le pouce valent mieux que
     la pastille de 38px dans la barre, pour une photo prise debout, d'une main. */
  body.nf-ios-mike #test-scan-cta{
    display:flex!important;
    left:12px!important;right:12px!important;
    bottom:calc(84px + env(safe-area-inset-bottom))!important;
    border-radius:14px!important;padding:0!important;min-height:48px!important;
    background:#1A3FB5!important;color:#fff!important;
    font-size:16.5px!important;font-weight:650!important;letter-spacing:-.01em!important;
    box-shadow:0 8px 22px rgba(26,63,181,.28)!important;
  }
  body.nf-ios-mike #test-scan-cta.test-hidden{display:none!important}
  body.nf-ios-mike #test-bottom-nav{
    left:0!important;right:0!important;bottom:0!important;
    border:0!important;border-top:.5px solid rgba(60,60,67,.22)!important;border-radius:0!important;
    background:#F7F7F8!important;box-shadow:none!important;
    grid-template-columns:repeat(3,1fr)!important;
    padding:5px 0 calc(8px + env(safe-area-inset-bottom))!important;
  }
  /* Le fond translucide remonte derriere le bouton bleu : sans lui, la liste
     defile dans la bande qui les separe et les deux flottent dans le vide. */
  body.nf-ios-mike #test-bottom-nav:before{
    content:"";position:absolute;left:0;right:0;bottom:100%;height:68px;
    background:linear-gradient(to bottom,rgba(247,247,248,0) 0,#F7F7F8 18px,#F7F7F8 100%);
    pointer-events:none;
  }
  /* ios-ui.js donne 58px de haut a chaque onglet, ce qui fait une barre de
     72px la ou la maquette en tient 53. */
  body.nf-ios-mike #test-bottom-nav button{
    color:#8E8E93!important;font-size:10.5px!important;font-weight:600!important;
    height:44px!important;gap:1px!important;
  }
  body.nf-ios-mike #test-bottom-nav button:before{font-size:20px!important;line-height:23px!important}
  body.nf-ios-mike #test-bottom-nav button:before{color:#8E8E93}
  body.nf-ios-mike #test-bottom-nav button.active{color:var(--nfm-accent)!important}
  body.nf-ios-mike #test-bottom-nav button.active:before{color:var(--nfm-accent)}
  /* L'onglet « Scan » ferait doublon avec le bouton bleu juste au-dessus.
     On le masque sans le retirer : arrangeTabBar() le reinjecte sinon. */
  body.nf-ios-mike #test-bottom-nav button[data-tab="scan"],
  body.nf-ios-mike #test-bottom-nav button[data-tab="account"]{display:none!important}
  body.nf-ios-mike #nf-ios-header .nf-ios-profile{cursor:pointer}
  /* Rien ne doit se cacher derriere la barre : CTA (52) + barre (~68) + marges. */
  body.nf-ios-mike .nf-ios-content{
    padding-bottom:calc(172px + env(safe-area-inset-bottom))!important;
  }

  /* ── Feuille de capture ──────────────────────────────────────────── */
  /* Grille a trois rangees plutot qu'un flex : la barre et le pied sont
     colles aux bords quoi qu'il arrive, et seul le corps defile. */
  .nfm-sheet{
    position:fixed;inset:0;z-index:5000;background:#F2F2F7;
    height:100dvh;max-height:100dvh;
    display:grid;grid-template-rows:auto minmax(0,1fr) auto;
    font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;color:#000;
  }
  .nfm-sheet-bar{
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:calc(12px + env(safe-area-inset-top)) 16px 12px;
    background:rgba(242,242,247,.9);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
    border-bottom:.5px solid rgba(60,60,67,.2);
  }
  .nfm-sheet-bar>div{font-size:17px;font-weight:650;letter-spacing:-.01em}
  .nfm-sheet-bar button{border:0;background:transparent;color:#1A3FB5;font-size:17px;padding:6px 0;cursor:pointer}
  .nfm-sheet-bar button.nfm-strong{font-weight:650}
  .nfm-sheet-bar button:disabled{color:#B8B8BE}
  .nfm-sheet-body{
    min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
    padding:16px 16px 24px;display:grid;gap:18px;align-content:start;
    scrollbar-width:none;-ms-overflow-style:none;
  }
  .nfm-sheet-body::-webkit-scrollbar{display:none;width:0;height:0}
  .nfm-sheet-foot{
    display:grid;gap:8px;padding:12px 16px calc(14px + env(safe-area-inset-bottom));
    background:rgba(249,249,249,.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
    border-top:.5px solid rgba(60,60,67,.2);
  }
  .nfm-btn-primary{
    width:100%;min-height:52px;border:0;border-radius:15px;background:#1A3FB5;color:#fff;
    font-size:17px;font-weight:650;cursor:pointer;
  }
  .nfm-btn-primary:disabled{background:#8E8E93;cursor:default}
  .nfm-btn-quiet{
    width:100%;min-height:46px;border:0;border-radius:15px;background:transparent;color:#1A3FB5;
    font-size:16px;font-weight:600;cursor:pointer;
  }
  .nfm-btn-quiet:disabled{color:#B8B8BE;cursor:default}
  .nfm-hero{
    width:100%;border:0;border-radius:18px;background:#fff;box-shadow:0 0 0 .5px rgba(60,60,67,.13);
    padding:34px 20px;display:flex;flex-direction:column;align-items:center;gap:12px;cursor:pointer;
  }
  .nfm-hero-lens{
    width:64px;height:64px;border-radius:32px;background:#1A3FB5;display:flex;align-items:center;justify-content:center;
  }
  .nfm-hero-lens>span{display:block;width:26px;height:20px;border-radius:4px;box-shadow:inset 0 0 0 2.4px #fff}
  .nfm-hero-t{font-size:17px;font-weight:650;color:#000}
  .nfm-hero-s{font-size:13.5px;color:#8E8E93;text-align:center;line-height:1.45;max-width:240px}
  .nfm-hero-alt{display:flex;gap:8px;margin-top:4px}
  .nfm-hero-alt>span{padding:8px 14px;border-radius:11px;background:#F2F2F7;color:#1A3FB5;font-size:14px;font-weight:600}
  .nfm-shot{
    display:flex;gap:14px;align-items:center;background:#fff;border-radius:18px;padding:14px;
    box-shadow:0 0 0 .5px rgba(60,60,67,.13);
  }
  .nfm-shot-img{
    flex:none;width:88px;height:110px;border-radius:12px;object-fit:cover;background:#EFEFF3;
    box-shadow:inset 0 0 0 .5px rgba(60,60,67,.16);display:flex;align-items:center;justify-content:center;
    font-size:13px;font-weight:800;color:#8E8E93;
  }
  .nfm-shot-name{font-size:15px;font-weight:650;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nfm-shot-meta{font-size:13px;color:#8E8E93;margin-top:2px}
  .nfm-ocr-l{font-size:13px;font-weight:600}
  .nfm-ocr-track{height:4px;border-radius:99px;background:#EFEFF3;margin-top:7px;overflow:hidden}
  .nfm-ocr-track>i{display:block;height:100%;border-radius:99px}
  .nfm-note{border-radius:14px;padding:13px 15px;font-size:13.5px;line-height:1.45}
  .nfm-note-amber{background:#FAEEDA;color:#7A4B0C}
  .nfm-note-red{background:#FCEBEB;color:#A32D2D}
  .nfm-group{display:grid;gap:8px}
  .nfm-group>h4{font-size:12px;font-weight:700;letter-spacing:.05em;color:#8E8E93;padding:0 4px;margin:0}
  .nfm-rows{background:#fff;border-radius:14px;box-shadow:0 0 0 .5px rgba(60,60,67,.13);overflow:hidden}
  .nfm-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px}
  .nfm-row+.nfm-row{border-top:.5px solid rgba(60,60,67,.16)}
  .nfm-row>label{font-size:16px;color:#000;flex:none}
  .nfm-row input,.nfm-row select{
    border:0;background:transparent;text-align:right;min-width:0;flex:1;outline:none;
    font-size:16px;font-weight:500;color:#000;padding:0;
  }
  .nfm-row input::placeholder{color:#C0C0C6}
  .nfm-row input.nfm-amount{font-size:22px;font-weight:700;font-variant-numeric:tabular-nums}
  .nfm-row input.nfm-vat{font-size:17px;font-weight:600;font-variant-numeric:tabular-nums}
  .nfm-row select{color:#1A3FB5;-webkit-appearance:none;appearance:none;text-align-last:right}
  .nfm-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .nfm-card{
    min-height:74px;border:0;border-radius:14px;background:#fff;color:#000;cursor:pointer;
    box-shadow:0 0 0 .5px rgba(60,60,67,.16);font-size:15px;font-weight:650;
    display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:6px;
    padding:0 15px;text-align:left;
  }
  .nfm-card small{font-size:12px;font-weight:500;opacity:.7}
  .nfm-card.nfm-on{background:#1A3FB5;color:#fff;box-shadow:none}
  .nfm-card.nfm-on small{opacity:.85}
  .nfm-err{font-size:13px;color:#A32D2D;padding:0 4px}

  /* ── Soumission : la progression en trois etapes ─────────────────── */
  .nfm-progress-scrim{position:fixed;inset:0;z-index:5390;background:rgba(0,0,0,.35)}
  .nfm-progress{
    position:fixed;left:16px;right:16px;bottom:calc(24px + env(safe-area-inset-bottom));z-index:5400;
    background:#fff;border-radius:18px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.24);
    display:grid;gap:10px;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;
  }
  .nfm-step{display:flex;gap:12px;align-items:center}
  .nfm-step-dot{
    flex:none;width:24px;height:24px;border-radius:12px;color:#fff;font-size:12px;font-weight:800;
    display:flex;align-items:center;justify-content:center;background:#C7C7CC;
  }
  .nfm-step.nfm-active .nfm-step-dot{background:#1A3FB5}
  .nfm-step.nfm-done .nfm-step-dot{background:#0F6E56}
  .nfm-step-l{font-size:15px;font-weight:600;color:#8E8E93}
  .nfm-step.nfm-active .nfm-step-l,.nfm-step.nfm-done .nfm-step-l{color:#000}
  .nfm-step-h{font-size:13px;color:#8E8E93;margin-top:2px}
  .nfm-progress-foot{font-size:13px;color:#8E8E93;padding:0 2px}

  /* ── Suppression : l'action destructive doit se voir venir ───────── */
  body.nf-ios-mike [data-nf-delete-confirm]>div{
    border-radius:20px 20px 0 0!important;padding:22px 18px calc(20px + env(safe-area-inset-bottom))!important;
  }
  body.nf-ios-mike [data-nf-delete-confirm] .nfm-del-t{
    font-size:19px!important;font-weight:700!important;letter-spacing:-.01em!important;margin-bottom:8px!important;
  }
  body.nf-ios-mike [data-nf-delete-confirm] .nfm-del-s{
    font-size:14px;line-height:1.5;color:#4A4A4F;margin-bottom:16px;
  }
  body.nf-ios-mike [data-nf-delete-confirm] .nfm-del-actions{
    display:grid!important;grid-template-columns:1fr!important;gap:9px!important;
  }
  body.nf-ios-mike [data-nf-delete-confirm] .nfm-del-actions button{
    width:100%;min-height:52px;border:0!important;border-radius:15px!important;
    font-size:17px!important;font-weight:600!important;justify-content:center!important;padding:0!important;
  }
  body.nf-ios-mike [data-nf-delete-confirm] .nfm-del-go{
    background:#A32D2D!important;color:#fff!important;font-weight:650!important;order:1;
  }
  body.nf-ios-mike [data-nf-delete-confirm] .nfm-del-keep{
    background:#F2F2F7!important;color:#000!important;order:2;
  }

  /* ── Feuilles modales par le bas ─────────────────────────────────
     Les recouvrements portes sur <body> (voir les createPortal plus bas)
     retrouvent le bas de l'ecran ; ceux qui restent dans l'arbre de l'app
     ne l'ont jamais eu. */
  body.nf-ios-mike [data-nf-delete-confirm],
  body.nf-ios-mike .nfm-bottom-sheet{align-items:flex-end!important}
  body.nf-ios-mike .nfm-bottom-sheet{padding:0!important}
  body.nf-ios-mike .nfm-bottom-sheet>div{
    border-radius:20px 20px 0 0!important;max-width:none!important;width:100%!important;
    padding-bottom:calc(18px + env(safe-area-inset-bottom))!important;
  }
}
</style>`;
    must('</head>', style + '</head>');

    // ───────────────────────────────────────────────────────────────
    // 2 · Feuille de capture — le coeur du produit
    // ───────────────────────────────────────────────────────────────

    // « Save and add another » : on parametre confirm() au lieu de le dupliquer,
    // pour que l'OCR, l'upload, le brouillon et la file hors ligne restent
    // exactement le meme code.
    must(
      '  const confirm=async()=>{',
      '  const nfmReset=()=>{setFile(null);setPreview(null);setOcrStatus(null);setOcrProgress(0);setErr(\'\');' +
      'setForm(prev=>({merchant:\'\',amount:\'\',tva:\'\',date:prev.date,category:prev.category,mealWith:\'\',note:\'\',paymentCard:prev.paymentCard||\'\'}));' +
      'const b=document.querySelector(\'.nfm-sheet-body\');if(b)b.scrollTop=0;};\n' +
      '  const confirm=async(nfmAgain)=>{'
    );
    // Les deux sorties de confirm() : succes en ligne, et repli hors ligne.
    // Surtout PAS une expression globale : `clearExpenseDraft();onClose();`
    // apparait aussi dans UBSModal, ou nfmAgain et nfmReset n'existent pas —
    // l'import UBS levait un ReferenceError au clic. Chaque sortie est ancree
    // sur la ligne qui la precede.
    const nfmAgainTail = 'clearExpenseDraft();if(nfmAgain===true){nfmReset();}else{onClose();}';
    must(
      'receiptPath,receiptName});\n      clearExpenseDraft();onClose();',
      'receiptPath,receiptName});\n      ' + nfmAgainTail
    );
    must(
      "notesfrais-offline-queued'));\n        clearExpenseDraft();onClose();",
      "notesfrais-offline-queued'));\n        " + nfmAgainTail
    );
    // Sur le bureau, confirm etait passe directement a onClick : l'evenement de
    // clic serait arrive dans nfmAgain et aurait garde la modale ouverte.
    must(
      '<button onClick={confirm} disabled={uploading}',
      '<button onClick={()=>confirm(false)} disabled={uploading}'
    );

    const captureSheet = [
      '  if(isMobile){',
      '    const nfmCats=CATS;',
      '    const nfmMeal=form.category===\'repas\';',
      '    const nfmOcr=ocrStatus===\'scanning\'',
      '      ?{l:\'Reading the receipt\\u2026 \'+ocrProgress+\'%\',c:\'#1A3FB5\',p:ocrProgress}',
      '      :ocrStatus===\'done\'?{l:\'Read \\u00b7 fields filled in below\',c:\'#0F6E56\',p:100}',
      '      :ocrStatus===\'error\'?{l:\'Could not read it \\u2014 photo kept\',c:\'#BA7517\',p:100}',
      '      :{l:\'Waiting for the photo\',c:\'#8E8E93\',p:0};',
      '    const nfmCanSave=!!form.paymentCard&&!uploading;',
      // La feuille est portee sur <body>. Rendue en place, elle herite d'un
      // ancetre qui rend la hauteur d'un position:fixed indefinie : le pied
      // remontait de 220px et flottait au milieu de l'ecran.
      '    return ReactDOM.createPortal(',
      '      <div className="nfm-sheet" data-nfm-capture="1">',
      '        <div className="nfm-sheet-bar">',
      '          <button type="button" onClick={onClose}>Cancel</button>',
      '          <div>New expense</div>',
      '          <button type="button" className="nfm-strong" disabled={!nfmCanSave} onClick={()=>confirm(false)}>Save</button>',
      '        </div>',
      '        <div className="nfm-sheet-body">',
      '          <input ref={fRef} type="file" accept="image/*,.pdf" capture="environment" style={{display:\'none\'}} onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}}/>',
      '          {!file',
      '            ?<button type="button" className="nfm-hero" onClick={()=>fRef.current.click()}>',
      '               <span className="nfm-hero-lens"><span/></span>',
      '               <span className="nfm-hero-t">Take a photo of the receipt</span>',
      '               <span className="nfm-hero-s">One tap opens the camera. Amount, VAT, date and merchant are filled in for you.</span>',
      '               <span className="nfm-hero-alt"><span>Library</span><span>PDF</span></span>',
      '             </button>',
      '            :<div className="nfm-shot">',
      '               {preview===\'pdf\'',
      '                 ?<div className="nfm-shot-img">PDF</div>',
      '                 :<img className="nfm-shot-img" src={preview} alt="receipt"/>}',
      '               <div style={{minWidth:0,flex:1}}>',
      '                 <div className="nfm-shot-name">{file.name}</div>',
      '                 <div className="nfm-shot-meta">{(file.size/1024).toFixed(0)+\' KB \\u00b7 kept in NotesFrais\'}</div>',
      '                 <div style={{marginTop:10}}>',
      '                   <div className="nfm-ocr-l" style={{color:nfmOcr.c}}>{nfmOcr.l}</div>',
      '                   <div className="nfm-ocr-track"><i style={{width:nfmOcr.p+\'%\',background:nfmOcr.c}}/></div>',
      '                 </div>',
      '                 <button type="button" onClick={()=>{setFile(null);setPreview(null);setOcrStatus(null);setOcrProgress(0);}} style={{marginTop:10,border:0,background:\'transparent\',color:\'#1A3FB5\',fontSize:14,fontWeight:600,padding:0,cursor:\'pointer\'}}>Replace photo</button>',
      '               </div>',
      '             </div>}',
      // Le justificatif est la seule copie : l'echec d'OCR ne doit pas laisser
      // croire que la photo est perdue.
      '          {ocrStatus===\'error\'&&<div className="nfm-note nfm-note-amber">{\'The photo is kept. Only the reading failed \\u2014 type the fields below and it is done.\'}</div>}',
      '          <div className="nfm-group">',
      '            <h4>AMOUNT</h4>',
      '            <div className="nfm-rows">',
      '              <div className="nfm-row"><label>Total CHF</label><input className="nfm-amount" type="number" inputMode="decimal" step="0.01" min="0" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="0.00"/></div>',
      '              <div className="nfm-row"><label>VAT CHF</label><input className="nfm-vat" type="number" inputMode="decimal" step="0.01" min="0" value={form.tva} onChange={e=>setForm({...form,tva:e.target.value})} placeholder="0.00"/></div>',
      '            </div>',
      '          </div>',
      '          <div className="nfm-group">',
      '            <h4>DETAILS</h4>',
      '            <div className="nfm-rows">',
      '              <div className="nfm-row"><label>Merchant</label><input value={form.merchant} onChange={e=>setForm({...form,merchant:e.target.value})} placeholder="Not filled yet"/></div>',
      '              <div className="nfm-row"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>',
      '              <div className="nfm-row"><label>Category</label><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{nfmCats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>',
      '            </div>',
      '          </div>',
      '          <div className="nfm-group">',
      '            <h4>{\'CARD USED \\u00b7 REQUIRED\'}</h4>',
      '            <div className="nfm-cards">',
      '              <button type="button" className={form.paymentCard===\'entreprise\'?\'nfm-card nfm-on\':\'nfm-card\'} onClick={()=>{setForm({...form,paymentCard:\'entreprise\'});setErr(\'\');}}>',
      '                <span>Company card</span>',
      '                <small>NUMERIQ PAYROLL</small>',
      '              </button>',
      '              <button type="button" className={form.paymentCard===\'perso\'?\'nfm-card nfm-on\':\'nfm-card\'} onClick={()=>{setForm({...form,paymentCard:\'perso\'});setErr(\'\');}}>',
      '                <span>Personal card</span>',
      '                <small>to be refunded</small>',
      '              </button>',
      '            </div>',
      '            {!form.paymentCard&&<div className="nfm-err">{\'Pick the card you paid with \\u2014 finance cannot post the expense without it.\'}</div>}',
      '          </div>',
      '          {nfmMeal&&<div className="nfm-group">',
      '            <h4>{\'WHO WAS THIS MEAL WITH \\u00b7 REQUIRED\'}</h4>',
      '            <div className="nfm-rows"><div className="nfm-row"><input value={form.mealWith} onChange={e=>setForm({...form,mealWith:e.target.value})} placeholder="Add a name" style={{textAlign:\'left\'}}/></div></div>',
      '          </div>}',
      '          <div className="nfm-group">',
      '            <h4>NOTE</h4>',
      '            <div className="nfm-rows"><div className="nfm-row"><input value={form.note} onChange={e=>setForm({...form,note:e.target.value})} placeholder="Optional" style={{textAlign:\'left\'}}/></div></div>',
      '          </div>',
      '        </div>',
      '        <div className="nfm-sheet-foot">',
      // L'erreur vit dans le pied, pas au fond du defilement : sinon elle
      // explique un bouton grise que Mike ne voit pas.
      '          {err&&<div className="nfm-note nfm-note-red">{err}</div>}',
      '          <button type="button" className="nfm-btn-primary" disabled={uploading} onClick={()=>confirm(false)}>{uploading?\'Saving\\u2026\':\'Save expense\'}</button>',
      // Par salves : on enchaine sans revenir au point de depart.
      '          <button type="button" className="nfm-btn-quiet" disabled={uploading} onClick={()=>confirm(true)}>Save and add another</button>',
      '        </div>',
      '      </div>',
      '    ,document.body);',
      '  }',
      ''
    ].join('\n');

    const addModalReturn =
      "  return(\n" +
      "    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',zIndex:1000,padding:isMobile?0:16}}>";
    must(addModalReturn, captureSheet + addModalReturn);

    // ───────────────────────────────────────────────────────────────
    // 3 · L'onglet Expenses — accueil et liste dans le meme ecran
    // ───────────────────────────────────────────────────────────────

    // Un crochet stable pour ordonner l'ecran en CSS.
    must(
      "{(tab==='history'||(tab==='expenses'&&window.notesFraisRole!=='finance'))&&<div style={{maxWidth:isMobile?'100%':800}}>",
      "{(tab==='history'||(tab==='expenses'&&window.notesFraisRole!=='finance'))&&<div data-nfm-expenses=\"1\" style={{maxWidth:isMobile?'100%':800}}>"
    );

    // Le recapitulatif remplace le libelle « Ready to close … ». Le bouton de
    // soumission qui le suit n'est pas touche : c'est le vrai, avec le ZIP.
    const summary = [
      '<React.Fragment>',
      '{isMobile&&offlineCount>0&&<div className="nfm-banner nfm-banner-offline" style={{margin:\'0 0 14px\'}}>',
      '  <div className="nfm-count">{offlineCount}</div>',
      '  <div style={{minWidth:0}}>',
      '    <div className="nfm-banner-t">{\'Offline \\u2014 \'+offlineCount+\' expense\'+(offlineCount>1?\'s\':\'\')+\' kept on this iPhone\'}</div>',
      '    <div className="nfm-banner-s">Nothing is lost. They upload by themselves as soon as you have signal.</div>',
      '  </div>',
      '</div>}',
      '{isMobile&&submissionStatus===\'submitted\'&&<div className="nfm-banner nfm-banner-closed" style={{margin:\'0 0 14px\'}}>',
      '  <div className="nfm-tag">CLOSED</div>',
      '  <div className="nfm-banner-s">{ML+\' submitted. Read-only from here.\'}</div>',
      '</div>}',
      '<div className="nfm-sum-head">',
      '  <div>',
      '    <div className="nfm-sum-label">TOTAL THIS MONTH</div>',
      '    <div className="nfm-sum-total">{\'CHF \'+fmt(mT)}</div>',
      '  </div>',
      '  <div className={submissionStatus===\'submitted\'?\'nfm-badge nfm-badge-closed\':\'nfm-badge nfm-badge-open\'}>{submissionStatus===\'submitted\'?\'Submitted\':offlineCount>0?(offlineCount+\' waiting to sync\'):\'In progress\'}</div>',
      '</div>',
      '<div className="nfm-sum-grid">',
      '  <div><div className="nfm-sum-k">VAT recoverable</div><div className="nfm-sum-v">{\'CHF \'+fmt(tva)}</div></div>',
      '  <div><div className="nfm-sum-k">Matched with UBS</div><div className="nfm-sum-v">{ubsLoaded?(rec.length+\' / \'+mE.length):(\'\\u2014 / \'+mE.length)}</div></div>',
      '</div>',
      '<div className="nfm-track"><i style={{width:(ubsLoaded&&mE.length?Math.round(rec.length/mE.length*100):0)+\'%\'}}/></div>',
      '{isMobile&&submissionStatus!==\'submitted\'&&<button type="button" className="nfm-add-link" onClick={()=>setShowAdd(true)}>+ Add expense</button>}',
      '</React.Fragment>'
    ].join('');
    mustRe(
      /<div><div style=\{\{fontSize:15,fontWeight:900\}\}>Ready to close \{ML\}\?<\/div><div style=\{\{fontSize:12,color:'var\(--t3\)',marginTop:3\}\}>\{mE\.length\+' expenses[\s\S]{0,120}?receipts'\}<\/div><\/div>/,
      summary
    );

    // ───────────────────────────────────────────────────────────────
    // 3 bis · Le bandeau de contexte au-dessus de la liste
    // ───────────────────────────────────────────────────────────────
    // Il reste avec les frais quand la carte du haut a defile. Le total suit
    // le filtre de categorie : « Meals » affiche le total des repas, pas
    // celui du mois — sinon la ligne mentirait des qu'on filtre.
    const strip = [
      '{fil.length>0&&<div className="nfm-strip">',
      '  <span>{fil.length+\' EXPENSE\'+(fil.length===1?\'\':\'S\')+\' \\u00b7 \'+fil.filter(e=>e.receiptPath||e.receiptUrl).length+\' WITH RECEIPT\'}</span>',
      '  <b>{\'CHF \'+fmt(fil.reduce((t,e)=>t+(Number(e.amountCHF||e.amount)||0),0))}</b>',
      '</div>}'
    ].join('');
    // L'ancre s'arrete avant le sous-titre : ce patch tourne AVANT le bloc
    // « premier usage » ci-dessous, donc nfm-empty-hint n'existe pas encore.
    const listOpen = "</div>{fil.length===0?<div style={{textAlign:'center',padding:'60px 20px',color:'var(--t3)'}}>"
      + "<div style={{fontSize:48,marginBottom:12}}>\ud83d\udcdd</div>"
      + "<div style={{fontWeight:500,fontSize:16,marginBottom:4}}>No expenses for this month</div>";
    must(listOpen, "</div>" + strip + listOpen.slice("</div>".length));

    // ───────────────────────────────────────────────────────────────
    // 3 ter · La ligne, epuree comme la maquette
    // ───────────────────────────────────────────────────────────────
    // « CHF » est repete a chaque ligne alors que l'app est en CHF partout ;
    // la maquette ne le garde que dans les totaux.
    must(
      "<div style={{fontWeight:700,fontFamily:'DM Mono',fontSize:15}}>CHF {fmt(e.amountCHF||e.amount)}</div>",
      "<div style={{fontWeight:700,fontFamily:'DM Mono',fontSize:15}}>{isMobile?'':'CHF '}{fmt(e.amountCHF||e.amount)}</div>"
    );
    // L'emoji de carte bancaire double le libelle qu'il precede.
    must(">\ud83d\udcb3 {getPaymentCardLabel(e.note)}<", ">{getPaymentCardLabel(e.note)}<");
    // « Edit » a cote de la corbeille : deux poids differents pour deux
    // actions voisines. Un crayon, comme la corbeille.
    must(
      "fontSize:13,fontWeight:800,padding:4}} title=\"Edit\">Edit</button>",
      "fontSize:13,fontWeight:800,padding:4}} title=\"Edit\">{isMobile?'\u270f\ufe0f':'Edit'}</button>"
    );

    // Premier usage : dire ce que l'app fera, pas seulement qu'elle est vide.
    // Le titre reste au mot — ios-ui.js s'en sert pour taguer le bloc.
    must(
      "<div style={{fontWeight:500,fontSize:16,marginBottom:4}}>No expenses for this month</div>",
      "<div style={{fontWeight:500,fontSize:16,marginBottom:4}}>No expenses for this month</div>" +
      "<div className=\"nfm-empty-hint\">Photograph a receipt when you pay. The amount, VAT, date and merchant are read for you.</div>"
    );

    // Pastilles de categorie en texte : l'emoji ne survit pas au fond bleu.
    mustRe(
      /\{c\.icon\?`\$\{c\.icon\} \$\{c\.label\}`:c\.label\}/,
      '{isMobile?c.label:(c.icon?`${c.icon} ${c.label}`:c.label)}'
    );

    // ───────────────────────────────────────────────────────────────
    // 4 · Soumission — la progression, jusqu'a 90 secondes
    // ───────────────────────────────────────────────────────────────
    const progressFrom =
      '{submissionStep&&<div className="nf-submission-progress"><div className="nf-submission-progress-title">{submissionStep}</div>' +
      '<div className="nf-submission-progress-text">Keep this page open. NotesFrais is preparing the receipts, sending the email, then closing the month.</div>' +
      '<div className="nf-submission-progress-track"><div className="nf-submission-progress-bar"/></div></div>}';
    const progressTo = [
      '{submissionStep&&(()=>{',
      "  const nfmSteps=[",
      "    {k:'Preparing receipt ZIP',l:'Building the receipt ZIP',h:'every receipt of the month, in one file'},",
      "    {k:'Sending email to finance',l:'Emailing finance',h:'with the summary attached'},",
      "    {k:'Closing the month',l:'Closing the month',h:'no more edits from your side'}",
      '  ];',
      '  const nfmAt=nfmSteps.findIndex(s=>s.k===submissionStep);',
      "  const nfmIdx=submissionStep==='Done'?nfmSteps.length:(nfmAt<0?0:nfmAt);",
      '  return ReactDOM.createPortal(<React.Fragment><div className="nfm-progress-scrim"/><div className="nfm-progress">',
      '    {nfmSteps.map((s,i)=>{',
      "      const done=i<nfmIdx,active=i===nfmIdx;",
      "      return <div key={s.k} className={'nfm-step'+(done?' nfm-done':active?' nfm-active':'')}>",
      "        <div className=\"nfm-step-dot\">{done?'\\u2713':String(i+1)}</div>",
      '        <div style={{minWidth:0}}><div className="nfm-step-l">{s.l}</div><div className="nfm-step-h">{s.h}</div></div>',
      '      </div>;',
      '    })}',
      "    <div className=\"nfm-progress-foot\">{nfmIdx>=nfmSteps.length?'Almost done \\u2014 do not close the app.':'This can take up to 90 seconds. Keep this page open.'}</div>",
      '  </div></React.Fragment>, document.body);',
      '})()}'
    ].join('\n');
    must(progressFrom, progressTo);

    // Le resume avant envoi devient une feuille par le bas.
    must(
      "{showSubmitSummary&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:6000,padding:isMobile?12:16}}>",
      "{showSubmitSummary&&<div className={isMobile?'nfm-bottom-sheet':''} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:6000,padding:isMobile?12:16}}>"
    );

    // ───────────────────────────────────────────────────────────────
    // 5 · Suppression — le ticket papier est deja jete
    // ───────────────────────────────────────────────────────────────
    // Portee sur <body> : rendue en place, la feuille se posait 220px
    // au-dessus du bas de l'ecran (meme cause que la feuille de capture).
    must(
      '        return <div data-nf-delete-confirm="true" onClick={close}',
      '        return ReactDOM.createPortal(<div data-nf-delete-confirm="true" onClick={close}'
    );
    must(
      '        </div>;\n      })()}',
      '        </div>, document.body);\n      })()}'
    );
    // Comme delete-confirm.js et meal-context.js, ce bloc est charge apres
    // mike-en.js : ses chaines ne passent pas par les paires de traduction et
    // sont donc ecrites ici dans les deux langues. Les ancres aussi : /test
    // rend cette boite en francais.
    const EN = window.NOTESFRAIS_CHANNEL === 'mike';
    const del = {
      title:   EN ? 'Delete this expense?' : 'Supprimer ce frais ?',
      warn:    EN ? 'The receipt goes with it, and the paper ticket is probably gone. NotesFrais holds the only copy.'
                  : 'Le justificatif part avec, et le ticket papier est probablement deja jete. NotesFrais en detient la seule copie.',
      cancel:  EN ? 'Cancel' : 'Annuler',
      keep:    EN ? 'Keep it' : 'Le garder',
      confirm: EN ? 'Delete' : 'Supprimer',
      go:      EN ? 'Delete expense and receipt' : 'Supprimer le frais et le justificatif',
      busy:    EN ? 'Deleting...' : 'Suppression...'
    };
    must(
      '            <div style={{fontSize:17,fontWeight:700,marginBottom:12}}>' + del.title + '</div>',
      '            <div className="nfm-del-t" style={{fontSize:17,fontWeight:700,marginBottom:12}}>' + del.title + '</div>\n' +
      '            <div className="nfm-del-s">' + del.warn + '</div>'
    );
    must(
      "            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>\n" +
      "              <button onClick={close} disabled={deletingExpense} style={{...bS,justifyContent:'center',padding:'12px 16px',fontSize:14}}>" + del.cancel + "</button>",
      "            <div className=\"nfm-del-actions\" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>\n" +
      "              <button className=\"nfm-del-keep\" onClick={close} disabled={deletingExpense} style={{...bS,justifyContent:'center',padding:'12px 16px',fontSize:14}}>{isMobile?'" + del.keep + "':'" + del.cancel + "'}</button>"
    );
    must(
      "              <button onClick={()=>performDeleteExpense(pendingDelete.id,pendingDelete.receiptPath)} disabled={deletingExpense} style={{...bP,justifyContent:'center',padding:'12px 16px',fontSize:14,background:'var(--red)',opacity:deletingExpense?0.6:1}}>{deletingExpense?'" + del.busy + "':'" + del.confirm + "'}</button>",
      "              <button className=\"nfm-del-go\" onClick={()=>performDeleteExpense(pendingDelete.id,pendingDelete.receiptPath)} disabled={deletingExpense} style={{...bP,justifyContent:'center',padding:'12px 16px',fontSize:14,background:'var(--red)',opacity:deletingExpense?0.6:1}}>{deletingExpense?'" + del.busy + "':(isMobile?'" + del.go + "':'" + del.confirm + "')}</button>"
    );

    // ───────────────────────────────────────────────────────────────
    // 6 · Le grand titre se compacte — la seule chose que le CSS ne sait pas
    // ───────────────────────────────────────────────────────────────
    const script = `<script id="notesfrais-mobile-redesign-script-v1">(function(){
function scroller(){
  return document.scrollingElement||document.documentElement;
}
// Le surtitre porte la periode affichee : sans elle, « Expenses » ne dit pas
// de quel mois on parle une fois le selecteur sorti de l'ecran.
function periodLabel(){
  const select=document.querySelector('.nf-ios-period-header select');
  const raw=select&&select.selectedOptions&&select.selectedOptions[0]
    ?select.selectedOptions[0].textContent:'';
  return String(raw||'').replace(/\\s*\\(\\d+\\)\\s*$/,'').trim();
}
function tick(){
  const header=document.getElementById('nf-ios-header');
  if(!header)return;
  const top=(scroller()&&scroller().scrollTop)||window.pageYOffset||0;
  header.classList.toggle('nfm-compact',top>26);
  const pill=header.querySelector('.nf-ios-profile');
  if(pill&&!pill.dataset.nfmWired){
    pill.dataset.nfmWired='1';
    pill.setAttribute('role','button');
    pill.setAttribute('aria-label','Account');
    pill.addEventListener('click',function(){
      const account=document.querySelector('#test-bottom-nav button[data-tab="account"]');
      if(account)account.click();
    });
  }
  const kicker=header.querySelector('.nf-ios-kicker');
  const period=periodLabel();
  if(kicker){
    const next=period?('NUMERIQ \\u00b7 '+period.toUpperCase()):'NUMERIQ EXPENSES';
    if(kicker.textContent!==next)kicker.textContent=next;
  }
}
window.addEventListener('scroll',tick,true);
window.addEventListener('resize',tick);
setInterval(tick,300);
tick();
})();<\/script>`;
    must('</body>', script + '</body>');

    return html;
  };
})();
