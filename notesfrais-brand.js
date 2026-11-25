(function(){
  // Identite Numeriq Payroll et refonte validee sur maquette (nov. 2026).
  //
  // Charge en DERNIER, apres month-review.js : rien ne passe plus par les
  // paires de traduction, donc les textes sont ecrits ici en anglais, comme
  // l'interface. Comme month-review.js, chaque cible manquante LEVE une
  // erreur au lieu d'un no-op silencieux : test-patches.js la voit.
  //
  // Palette tiree du logo (symbole infini + texte ardoise) :
  //   ardoise #2E3E4F (marque, titres)   texte #1E2B38   secondaire #5B6875
  //   bleu profond #0F5E92 (boutons, liens)   bleu moyen #2B8FD0 / ciel #A3D3F4
  //   (grandes surfaces seulement : trop pales pour du petit texte)
  //   fond #F3F6F9   teinte #E6F1FA
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_BRAND_V1')) return html;

    const swap = (from, to, label) => {
      if(!html.includes(from)) throw new Error('brand: cible introuvable (' + label + ')');
      html = html.split(from).join(to);
    };

    // ── 1. Ecran de connexion : le logo, le nom de la societe ──────────────
    swap("background:'linear-gradient(135deg,#F5F3EF 0%,#EEF2FD 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>",
         "background:'#F3F6F9',display:'flex',alignItems:'center',justifyContent:'center',padding:20}} data-nf-login=\"true\">",
         'fond de la connexion');
    swap("<div style={{background:'linear-gradient(135deg,#0B1F4D,#1A3FB5)',borderRadius:18,padding:'22px 18px',color:'#fff',textAlign:'center',marginBottom:20}}>\n" +
         "        <div style={{fontSize:11,letterSpacing:'0.22em',opacity:0.72,marginBottom:8}}>EXPENSES</div>\n" +
         "        <div style={{fontSize:24,fontWeight:800,letterSpacing:'0.08em'}}>NUMERIQ</div>\n" +
         "      </div>\n" +
         "      <h1 style={{fontSize:22,lineHeight:1.2,marginBottom:6}}>Secure access</h1>\n" +
         "      <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.5,marginBottom:16}}>Sign in with your secure account.</p>",
         "<div className=\"nf-login-brand\" style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:14,marginBottom:24}}>\n" +
         "        <div style={{width:92,height:92,borderRadius:22,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 24px rgba(46,62,79,0.14)'}}><img src=\"/logo-numeriq-mark.png\" alt=\"Numeriq Payroll\" style={{width:70,height:'auto'}}/></div>\n" +
         "        <h1 style={{fontSize:26,lineHeight:1.15,margin:0,color:'#2E3E4F',letterSpacing:'-0.02em'}}>Numeriq Payroll</h1>\n" +
         "        <p style={{fontSize:15,color:'#5B6875',lineHeight:1.45,margin:0}}>Snap your receipts. Finance takes it from there.</p>\n" +
         "      </div>",
         'bloc de marque de la connexion');

    // ── 2. Carte du mois : un seul message par etat ────────────────────────
    swap('<div className="nfm-sum-label">TOTAL THIS MONTH</div>',
         '<div className="nfm-sum-label">Total this month</div>', 'libelle du total');
    // « CLOSED » + « Read-only » + « Already submitted » disaient la meme chose.
    // Une fois la finance decidee, son bandeau suffit : celui-ci se retire.
    swap("{isMobile&&submissionStatus==='submitted'&&<div className=\"nfm-banner nfm-banner-closed\" style={{margin:'0 0 14px'}}>  <div className=\"nfm-tag\">CLOSED</div>  <div className=\"nfm-banner-s\">{ML+' submitted. Read-only from here.'}</div></div>}",
         "{isMobile&&submissionStatus==='submitted'&&!nfMonthReviews[month]&&<div className=\"nfm-banner nfm-banner-closed\" style={{margin:'0 0 14px'}}>  <div style={{minWidth:0}}>    <div className=\"nfm-banner-t\">With finance</div>    <div className=\"nfm-banner-s\">{ML+' is locked while finance reviews it. You will be notified.'}</div>  </div></div>}",
         'bandeau mois soumis');
    // Le bouton de soumission ne prend le bleu plein que quand chaque frais a
    // son justificatif. Une fois le mois soumis, il disparait (pastille et
    // bandeau le disent deja). La logique de soumission n'est pas touchee.
    swap("<button type=\"button\" disabled={mE.length===0||syncing||mE.some(e=>e.submissionStatus==='submitted')} onClick={async()=>{if(mE.length===0",
         "<button type=\"button\" className={'nfm-submit '+(mE.some(e=>e.submissionStatus==='submitted')?'nfm-submit-done':(mE.length>0&&mE.every(e=>e.receiptPath||e.receiptUrl))?'nfm-submit-ready':'nfm-submit-quiet')} disabled={mE.length===0||syncing||mE.some(e=>e.submissionStatus==='submitted')} onClick={async()=>{if(mE.length===0",
         'bouton de soumission');

    // ── 3. Lecture du recu ratee : un message pour Mike, le diagnostic replie ─
    // Le diagnostic reste dans la page (CLAUDE.md : il a coute cinq
    // allers-retours), mais sous « Technical details ».
    swap("<div>{'The photo is kept. Only the reading failed \\u2014 type the fields below and it is done.'}</div>\n" +
         "            {ocrReason&&<div style={{marginTop:6,fontSize:11.5,opacity:.75,wordBreak:'break-word'}}>{ocrReason}</div>}",
         "<div className=\"nfm-ocr-title\">Couldn't read this receipt</div>\n" +
         "            <div>{'The photo is kept. Type the amount below and you are done.'}</div>\n" +
         "            {ocrReason&&<details className=\"nfm-ocr-details\"><summary>Technical details</summary><div style={{marginTop:6,fontSize:11.5,opacity:.8,wordBreak:'break-word'}}>{ocrReason}</div></details>}",
         'message de lecture ratee');

    // ── 4. Ligne de frais : une seule pastille de commentaires ─────────────
    // La pastille « 1 » vit deja dans la ligne ; le bouton n'est plus qu'une icone.
    swap("const label=compact?('\u{1F4AC}'+(count?' '+count:'')):",
         "const label=compact?'':", 'bouton commentaires compact');

    // ── 5. Montants au format suisse : CHF 2'961.80 ────────────────────────
    // fmt ne sert qu'a l'affichage (CSV et ZIP ont leur propre format).
    swap("const fmt=n=>Number(n||0).toFixed(2);",
         "const fmt=n=>{const v=Number(n||0);const p=Math.abs(v).toFixed(2).split('.');return (v<0?'-':'')+p[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,\"'\")+'.'+p[1];};",
         'format des montants');

    // ── 6. Icones d'ecran d'accueil et couleur de barre ────────────────────
    swap('<link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.svg"><meta name="theme-color" content="#1A3FB5">',
         '<link rel="icon" href="/icon-192.png" type="image/png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#F3F6F9">',
         'icones PWA');

    // ── 7. Palette : l'ancien bleu roi devient le bleu du logo ─────────────
    // Remplacement de valeurs de couleur, pas de code : sur et uniforme.
    [['#1A3FB5','#0F5E92'],['#1a3fb5','#0F5E92'],['rgba(26,63,181,','rgba(15,94,146,'],
     ['#2D5BE3','#0F5E92'],['#EDF0FA','#E6F1FA'],['#EEF2FD','#E6F1FA'],
     ['#F2F2F7','#F3F6F9'],['#f2f2f7','#F3F6F9'],['#F5F3EF','#F3F6F9'],
     // Les beiges de l'espace finance passent au gris bleute du fond.
     ['#F8F6F1 0%,#EFEAE1 100%','#F3F6F9 0%,#EEF2F6 100%'],['#EDEBE6','#E4EAF0']
    ].forEach(([from,to])=>{ html = html.split(from).join(to); });

    // ── 8. Feuille de style ────────────────────────────────────────────────
    const ICON = svg => 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
    const stroke = (d, color) => ICON('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>');
    const icEdit = stroke('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>', '#3A4754');
    const icDelete = stroke('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', '#5B6875');
    const icChat = stroke('<path d="M4 5h16v11H9l-5 4z"/>', '#0F5E92');
    const icNoPhoto = stroke('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><path d="M12 10.5v5M9.5 13h5"/>', '#6B7785');
    const icCamera = stroke('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', '#FFFFFF');
    // Barre du bas : icones au trait en masque, colorees par background-color.
    const mask = d => ICON('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>');
    const tabExpenses = mask('<path d="M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6L6 20.5z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>');
    const tabStats = mask('<rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="16" y="3.5" width="4" height="16.5" rx="1"/>');
    const tabBank = mask('<path d="M3.5 9 12 4l8.5 5z"/><path d="M5.5 11.5v6M10 11.5v6M14 11.5v6M18.5 11.5v6M3.5 20h17"/>');

    const css = `<style id="notesfrais-brand-v1">
/* NOTESFRAIS_BRAND_V1 : identite Numeriq Payroll */
:root{--bg:#F3F6F9;--s2:#EAF0F5;--text:#1E2B38;--t2:#4A5866;--t3:#6B7785;--accent:#0F5E92;--al:#E6F1FA;--border:#DDE4EA;}
body{background:#F3F6F9;color:#1E2B38;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif}
/* Une seule famille partout : DM Sans et DM Mono faisaient trois polices. */
[style*="DM Sans"],[style*="DM Mono"]{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif!important;font-variant-numeric:tabular-nums}
input,select,textarea,button{font-family:inherit}
/* Connexion */
[data-nf-login]>div{border:0!important;box-shadow:0 18px 50px rgba(46,62,79,.10)!important;min-height:0!important;height:auto!important}
@media(max-width:859px){[data-nf-login]>div{background:transparent!important;box-shadow:none!important;padding:8px 4px!important}}
/* Espace finance : le logo complet remplace la carte « PAYROLL » */
#numeriq-brand-card{background:#fff url("/logo-numeriq-payroll-full.png") center/auto 72% no-repeat!important;box-shadow:none!important;border:1px solid #DDE4EA}
#numeriq-brand-card>*{visibility:hidden}
#numeriq-brand-card>div{min-height:104px!important}
@media(max-width:859px){
  #numeriq-brand-card>div{min-height:72px!important}
  html body.nf-ios-mike{
    --nfm-accent:#0F5E92;--nfm-accent-l:#E6F1FA;--nfm-bg:#F3F6F9;--nfm-t2:#3A4754;--nfm-t3:#6B7785;
    --nfm-green:#17663F;--nfm-gl:#E5F3EA;--nfm-amber:#A04A06;--nfm-aml:#FDF0E3;
    --accent:#0F5E92;--al:#E6F1FA;--bg:#F3F6F9;--s2:#EAF0F5;--text:#1E2B38;--t2:#3A4754;--t3:#6B7785;
    background:#F3F6F9!important;color:#1E2B38;
  }
  html body.nf-ios-mike #nf-ios-header .nf-ios-title,
  html body.nf-ios-mike .nfm-sum-total{color:#1E2B38!important}
  html body.nf-ios-mike .nfm-sum-label{font-size:13px;font-weight:500;letter-spacing:0;color:#5B6875}

  /* La vignette du justificatif masquait le premier chiffre de la date :
     user-edit.js lui imposait min-width:64px dans une colonne de 48px. */
  html body.nf-ios-mike .nf-ios-expense-row>.nf-ios-expense-receipt{min-width:48px!important;max-width:48px!important}

  /* Sans photo : un cadre en pointilles et une icone, plus la case orange. */
  html body.nf-ios-mike .nf-ios-expense-row:not(.nf-ios-has-receipt)>.nf-ios-expense-receipt{
    background:#fff!important;box-shadow:none!important;border:1.5px dashed #B8C2CC!important;box-sizing:border-box!important;
  }
  html body.nf-ios-mike .nf-ios-expense-row:not(.nf-ios-has-receipt)>.nf-ios-expense-receipt:after{
    content:""!important;background:${icNoPhoto} center/22px no-repeat!important;
  }

  /* Actions de la ligne : des icones au trait a la place des emoji. */
  html body.nf-ios-mike .nf-ios-expense-actions{gap:6px!important}
  html body.nf-ios-mike .nf-ios-expense-actions button[title="Edit"],
  html body.nf-ios-mike .nf-ios-expense-actions button[title="Delete"],
  html body.nf-ios-mike .nf-ios-expense-actions button[data-nf-comments-open]{
    width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;padding:0!important;
    border-radius:18px!important;font-size:0!important;color:transparent!important;
    background-color:#F3F6F9!important;background-position:center!important;background-repeat:no-repeat!important;background-size:18px!important;
  }
  html body.nf-ios-mike .nf-ios-expense-actions button[title="Edit"]{background-image:${icEdit}!important}
  html body.nf-ios-mike .nf-ios-expense-actions button[title="Delete"]{background-image:${icDelete}!important}
  html body.nf-ios-mike .nf-ios-expense-actions button[data-nf-comments-open]{background-image:${icChat}!important}
  html body.nf-ios-mike .nf-ios-expense-info>div:nth-child(2) span:not(:first-child){background:#EEF2F6!important;color:#4A5866!important}

  /* Un seul bouton d'ajout : « Scan receipt » ouvre la meme feuille, saisie
     manuelle comprise. */
  html body.nf-ios-mike [data-user-submit-placement]>.nfm-add-link{display:none!important}

  /* Soumission : discret tant qu'il manque un justificatif, plein quand tout
     est pret, absent une fois le mois parti. */
  html body.nf-ios-mike [data-user-submit-placement]>button.nfm-submit-quiet:not(.nfm-add-link){
    background:#E6F1FA!important;color:#0F5E92!important;
  }
  html body.nf-ios-mike [data-user-submit-placement]>button.nfm-submit-ready:not(.nfm-add-link){
    background:#0F5E92!important;color:#fff!important;min-height:50px!important;
  }
  html body.nf-ios-mike [data-user-submit-placement]>button.nfm-submit-done:not(.nfm-add-link){display:none!important}
  html body.nf-ios-mike .nfm-banner-closed{background:#EEF2F6!important}
  html body.nf-ios-mike .nfm-banner-closed .nfm-banner-t{color:#1E2B38}

  /* Bouton photo : une pastille centree aux couleurs du symbole infini, qui
     laisse voir la liste de part et d'autre. 52px restent sous le pouce. */
  html body.nf-ios-mike #test-scan-cta{
    left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:auto!important;
    min-height:52px!important;padding:0 26px 0 54px!important;border-radius:26px!important;white-space:nowrap!important;
    background:${icCamera} 22px center/22px no-repeat,linear-gradient(135deg,#0B5A8C 0%,#1C78B5 100%)!important;
    box-shadow:0 8px 22px rgba(15,94,146,.32)!important;
  }
  html body.nf-ios-mike #test-bottom-nav{background:#F8FAFC!important}
  /* nf-tab-icons : Expenses = recu, Stats = barres, UBS = banque. */
  html body.nf-ios-mike #test-bottom-nav button{color:#6B7785!important}
  html body.nf-ios-mike #test-bottom-nav button.active{color:#0F5E92!important;background:transparent!important}
  html body.nf-ios-mike #test-bottom-nav button[data-tab="expenses"]:before,
  html body.nf-ios-mike #test-bottom-nav button[data-tab="stats"]:before,
  html body.nf-ios-mike #test-bottom-nav button[data-tab="recon"]:before{
    content:""!important;display:block!important;width:26px!important;height:26px!important;margin:0 auto 1px!important;
    background-color:#6B7785!important;-webkit-mask:var(--nf-tab) center/26px 26px no-repeat;mask:var(--nf-tab) center/26px 26px no-repeat;
  }
  html body.nf-ios-mike #test-bottom-nav button[data-tab="expenses"]{--nf-tab:${tabExpenses}}
  html body.nf-ios-mike #test-bottom-nav button[data-tab="stats"]{--nf-tab:${tabStats}}
  html body.nf-ios-mike #test-bottom-nav button[data-tab="recon"]{--nf-tab:${tabBank}}
  html body.nf-ios-mike #test-bottom-nav button.active[data-tab]:before{background-color:#0F5E92!important}
  html body.nf-ios-mike #test-bottom-nav:before{background:linear-gradient(to bottom,rgba(248,250,252,0) 0,#F8FAFC 18px,#F8FAFC 100%)!important}

  /* Lecture ratee : le titre d'abord, le diagnostic replie. */
  html body.nf-ios-mike .nfm-note-amber{background:#FDF0E3!important;color:#3A2A1C!important}
  html body.nf-ios-mike .nfm-ocr-title{font-weight:650;color:#A04A06;margin-bottom:3px}
  html body.nf-ios-mike .nfm-ocr-details{margin-top:8px}
  html body.nf-ios-mike .nfm-ocr-details>summary{cursor:pointer;font-size:13px;font-weight:600;color:#5B6875;min-height:28px;display:flex;align-items:center}
}
</style>`;
    if(!html.includes('</head>')) throw new Error('brand: </head> introuvable');
    html = html.replace('</head>', css + '</head>');
    return html;
  };
})();
