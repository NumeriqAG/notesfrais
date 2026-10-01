(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_ENGLISH_FINAL_V1')) return html;

    // Le francais qui restait visible dans l'interface anglaise, releve sur le
    // HTML reellement produit (balayage statique + rendu de chaque onglet).
    // Trois origines :
    //   - des patches charges apres les traductions, ecrits en francais
    //     (reglages finance, compression, edition) ;
    //   - les paires mal encodees de notesfrais-mike-en.js, qui ne matchent pas ;
    //   - les paires globales ['Frais','Expenses'], ['justificatif','receipt'],
    //     ['Soumis','Submitted'] qui ont coupe des mots en deux :
    //     « Expenses enregistré », « Submittedsion », « non receiptperes ».
    //
    // Charge en DERNIER : les cibles sont le code deja traduit, et chaque
    // paire est une chaine exacte, apostrophes comprises, pour ne jamais
    // toucher un identifiant. Une paire sans effet apparait dans
    // tools/check-patches.js et fait echouer la baseline.
    const pairs = [
      // Page et ecran de connexion
      ['<title>NotesFrais \u00e2\u20ac\u201d Mike</title>', '<title>NotesFrais \u2014 Mike</title>'],
      ['placeholder="Mot de passe"', 'placeholder="Password"'],
      ['<b>Erreur:</b>', '<b>Error:</b>'],

      // Import UBS
      ['>Glissez votre CSV UBS<', '>Drop your UBS CSV here<'],
      ['>ou cliquez pour parcourir<', '>or click to browse<'],
      ['>Export depuis UBS e-banking<', '>Export from UBS e-banking<'],
      ["['E-banking → Accounts et cartes','Sélectionner votre carte CB','Transactions → Exporter → CSV','Download le .csv']",
       "['E-banking → Accounts & cards','Select your card','Transactions → Export → CSV','Download the .csv']"],
      ['>📂 Parcourir<', '>📂 Browse<'],
      ['>🧪 Données démo<', '>🧪 Demo data<'],
      ["'Vérifier les transactions'", "'Review transactions'"],
      ["'✓ UBS chargé'", "'✓ UBS loaded'"],
      ['>✅ Matched avec UBS<', '>✅ Matched with UBS<'],
      ["notify('✅ UBS statement importé')", "notify('✅ UBS statement imported')"],
      ["note:'⚠ Importé depuis UBS'", "note:'⚠ Imported from UBS'"],

      // Stats et resume avant soumission
      ['>Les statistiques se rempliront avec les expenses saisis.<', '>Statistics will fill in as you add expenses.<'],
      ['>Attention: {pend.length} expenses saisi(s) ne sont pas encore trouvés dans UBS.<', '>Heads up: {pend.length} expense(s) not found in the UBS statement yet.<'],
      ['>Détail par catégorie<', '>Breakdown by category<'],
      ['>Résumé avant soumission<', '>Summary before submission<'],
      ['>No expenses to soumettre.<', '>No expenses to submit.<'],
      ["notify('No expenses synchronise a soumettre')", "notify('No synced expenses to submit')"],

      // Reglages comptables (finance)
      ['>Associez les cartes et catégories to vos comptes comptables. Ces réglages préparent le futur export finance.<',
       '>Map cards and categories to your ledger accounts. These settings prepare the upcoming finance export.<'],
      ['>Accounts par moyen de paiement<', '>Accounts by payment method<'],
      ['>Exemple : CB perso = compte courant, CB pro = compte carte entreprise.<', '>Example: personal card = current account, company card = company card account.<'],
      ["label:'Paiement CB entreprise',hint:'Ex: carte pro / compte banque entreprise'", "label:'Company card payment',hint:'E.g. company card / company bank account'"],
      ["label:'Paiement CB perso',hint:'Ex: compte courant d’associé / remboursement'", "label:'Personal card payment',hint:'E.g. shareholder current account / reimbursement'"],
      ['>Accounts par catégorie de expense<', '>Accounts by expense category<'],
      ['>Exemple : repas = compte 58xx, transport = compte 62xx, hôtel = compte 66xx.<', '>Example: meals = account 58xx, transport = account 62xx, hotel = account 66xx.<'],

      // Justificatifs, compression, envoi
      ["'Ce fichier depasse la limite de 2.6 Mo. Les photos sont compressees automatiquement, mais ce PDF doit etre reduit.'",
       "'This file is over the 2.6 MB limit. Photos are compressed automatically, but this PDF has to be made smaller.'"],
      ["'La photo reste trop lourde apres compression'", "'The photo is still too large after compression'"],
      ["'Impossible de compresser cette photo. Essayez une capture d ecran du receipt.'", "'This photo could not be compressed. Try a screenshot of the receipt.'"],
      ["'Upload trop long. Reessayez avec une photo plus legere ou un PDF plus petit.'", "'The upload took too long. Try again with a lighter photo or a smaller PDF.'"],
      ["'. Sauvegarde hors ligne impossible: '", "'. Offline save failed: '"],
      [' KB · stocké dans NotesFrais<', ' KB · stored in NotesFrais<'],
      ['aria-label="Fermer le receipt"', 'aria-label="Close receipt"'],
      ["alert('Impossible de creer le ZIP des receipts: '", "alert('Could not create the receipts ZIP: '"],
      [String.raw`zip.file('_A_LIRE_erreurs.txt','No receipt telechargeable pour cette periode.\n\n'`, String.raw`zip.file('_READ_ME_errors.txt','No receipt could be downloaded for this period.\n\n'`],
      [String.raw`zip.file('_A_LIRE_erreurs.txt','Receipts non receiptperes:\n'`, String.raw`zip.file('_READ_ME_errors.txt','Receipts that could not be retrieved:\n'`],

      // Synchronisation et soumission
      ["'Mode local - connexion indisponible. Les expenses saisis hors ligne restent sur cet appareil.'", "'Local mode - connection unavailable. Expenses entered offline stay on this device.'"],
      ["notify('📴 Expenses gardé sur cet iPhone. Sync dès retour internet.')", "notify('📴 Expense kept on this iPhone. It will sync once you are back online.')"],
      ["notify('✅ Expenses enregistré !')", "notify('✅ Expense saved!')"],
      ["notify('✅ '+n+' expenses synchronisé'+(n>1?'s':''))", "notify('✅ '+n+' expense'+(n>1?'s':'')+' synced')"],
      ["notify('📨 Expenses soumis a la finance')", "notify('📨 Expenses submitted to finance')"],
      ["notify('📨 Expenses soumis. Email non envoye: configuration mail manquante.',6500)", "notify('📨 Expenses submitted. Email not sent: mail is not configured.',6500)"],
      ["notify('⚠ Expenses soumis, mais email non envoye: '", "notify('⚠ Expenses submitted, but the email was not sent: '"],
      ["notify('❌ Submittedsion impossible: '", "notify('❌ Submission failed: '"],
      ["'Notification email impossible'", "'Notification email failed'"],

      // Croix du toast « Scan another » (mal encodee ; toast inatteignable
      // depuis la refonte mobile, corrige pour ne pas laisser de mojibake)
      ["fontSize:18,cursor:'pointer'}}>\u00c3\u2014</button>", "fontSize:18,cursor:'pointer'}}>\u00d7</button>"],

      // Badge de carte : les modifications enregistraient « Carte utilisee:
      // entreprise » (corrige dans notesfrais-user-edit.js). On relit ces notes
      // deja en base au lieu de perdre leur badge.
      ["const m=String(note||'').match(/Payment card:\\s*(company|personal)/i);\n  if(!m)return '';",
       "const m=String(note||'').match(/(?:Payment card|Carte utilisee|Card used):\\s*(company|personal|entreprise|perso)/i);\n  if(!m)return '';"],
      ["filter(line=>!/^Payment card:/i.test(line.trim()))", "filter(line=>!/^(?:Payment card|Carte utilisee|Card used):/i.test(line.trim()))"],
    ];

    for(const [from, to] of pairs){
      html = html.replace(from, () => to);
      while(html.includes(from)) html = html.split(from).join(to);
    }
    return html.replace('</head>', '<meta name="notesfrais-english-final" content="NOTESFRAIS_ENGLISH_FINAL_V1">\n</head>');
  };
})();
