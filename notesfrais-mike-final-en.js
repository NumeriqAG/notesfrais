(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(window.NOTESFRAIS_CHANNEL !== 'mike') return html;
    if(html.includes('Mike final English UI active')) return html;

    const pairs = [
      ['Supabase connecté - synchronisé','Supabase connected - synced'],
      ['Supabase connecté - ','Supabase connected - '],
      [' à synchroniser',' to sync'],
      ['Hors ligne - sauvegarde locale prête','Offline - local save ready'],
      ['Mode local - connexion indisponible. Les frais saisis hors ligne restent sur cet appareil.','Local mode - connection unavailable. Offline expenses stay on this device.'],
      ['Mode hors ligne - les donnees locales restent disponibles.','Offline mode - local data remains available.'],
      ['Connexion trop lente - ouverture en mode local.','Connection too slow - opening in local mode.'],
      ['Carte utilisee *','Payment card *'],
      ['Carte utilisée *','Payment card *'],
      ['Carte utilisee: entreprise','Payment card: company'],
      ['Carte utilisee: perso','Payment card: personal'],
      ['Carte utilisee','Payment card'],
      ['Carte utilisée','Payment card'],
      ['Choisissez la carte utilisee','Choose the payment card'],
      ['Choisissez la carte utilisée','Choose the payment card'],
      ['Choisir la carte...','Choose card...'],
      ["Carte de l'entreprise",'Company card'],
      ['Carte entreprise','Company card'],
      ['Carte perso','Personal card'],
      ['Annee 2026','Year 2026'],
      ['Année 2026','Year 2026'],
      ['annuel par defaut, filtre mensuel si besoin','annual by default, monthly filter if needed'],
      ['vue annuelle par defaut','annual view by default'],
      ['Toute l\'annee 2026','Full year 2026'],
      ['Toute l’année 2026','Full year 2026'],
      ['Periode','Period'],
      ['Période','Period'],
      ['Février 2026','February 2026'],
      ['Après UBS','After UBS'],
      ['après UBS','after UBS'],
      ['RÉCONCILIATION UBS','UBS MATCHING'],
      ['Récupérable','Recoverable'],
      ['réconciliés','matched'],
      ['Justificatifs','Receipts'],
      ['Reconcilies','Matched'],
      ['Réconciliés','Matched'],
      ['apres UBS','after UBS'],
      ['Aucune donnee pour cette periode','No data for this period'],
      ['Aucune donnée pour cette période','No data for this period'],
      ['Les statistiques se rempliront avec les frais saisis.','Statistics will fill up as expenses are added.'],
      ['Repartition par categorie','Breakdown by category'],
      ['Répartition par catégorie','Breakdown by category'],
      ['Aucune carte renseignee.','No card selected.'],
      ['Aucune carte renseignée.','No card selected.'],
      ['Evolution mensuelle','Monthly evolution'],
      ['Évolution mensuelle','Monthly evolution'],
      ['Aucun mois avec frais.','No month with expenses.'],
      ['Aucun frais pour ce mois','No expenses for this month'],
      ['Aucun frais saisi','No expenses entered'],
      ['recuperable','recoverable'],
      ['récupérable','recoverable'],
      ['frais','expenses'],
      ['avec justificatif','with receipt'],
      ['Rechercher un reçu, montant, commerçant...','Search receipt, amount, merchant...'],
      ['Rechercher un recu, montant, commercant...','Search receipt, amount, merchant...'],
      ['Scanner un recu','Scan receipt'],
      ['Scanner un reçu','Scan receipt'],
      ['Ajouter un frais','Add expense'],
      ['Upload en cours','Uploading'],
      ['Annuler','Cancel'],
      ['Confirmer','Confirm'],
      ['Historique','Expenses'],
      ['Statistiques','Stats'],
      ['Accueil','Home'],
      ['Frais','Expenses'],
      ['PÉRIODE','PERIOD'],
      ['Receipt — photo ou PDF','Receipt - photo or PDF'],
      ['Commerçant *','Merchant *'],
      ['Catégorie','Category'],
      ['Hôtel','Hotel'],
      ['Matériel','Equipment']
    ];

    for(const [from,to] of pairs){
      html = html.split(from).join(to);
    }

    html = html.split('/^+ Add expense/').join('/^\\+ Add expense/');
    html = html.replace(/Payment card:\\s\*\(entreprise\|perso\)/g,'Payment card:\\s*(company|personal)');
    html = html.replace(/m\[1\]\.toLowerCase\(\)==='entreprise'\?"Company card":"Personal card"/g,"m[1].toLowerCase()==='company'||m[1].toLowerCase()==='entreprise'?\"Company card\":\"Personal card\"");
    html = html.replace(/form\.paymentCard==='entreprise'\?'Payment card: company':form\.paymentCard==='perso'\?'Payment card: personal':''/g,"form.paymentCard==='entreprise'?'Payment card: company':form.paymentCard==='perso'?'Payment card: personal':''");

    html = html.replace('</body>', '<script>console.info("Mike final English UI active");<\/script></body>');
    return html;
  };
})();
