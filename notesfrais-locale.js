(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_LOCALE_V1')) return html;

    // Les dates etaient formatees avec la locale 'fr-CH' ecrite en dur dans
    // app.html. Aucune paire de traduction ne peut rattraper ca : c'est un
    // argument de fonction, pas une chaine affichee. L'interface anglaise
    // affichait donc « 18 aout ».
    //
    // Les deux canaux rendent aujourd'hui l'interface anglaise, d'ou 'en-GB' :
    // jour puis mois, comme on l'attend en Suisse, et « 18 Aug ».
    //
    // La constante est declaree au niveau module, pas dans le corps de fd :
    // formatDraftDate est une autre portee et ne la verrait pas.
    const anchor = "const fmt=n=>Number(n||0).toFixed(2);";
    if(!html.includes(anchor)) throw new Error('locale: ancre de declaration introuvable');
    html = html.replace(anchor, "const NOTESFRAIS_LOCALE_V1='en-GB';\n" + anchor);

    const dateFrom = "dt.toLocaleDateString('fr-CH',{day:'2-digit',month:'short'})";
    if(!html.includes(dateFrom)) throw new Error('locale: cible fd introuvable');
    html = html.replace(dateFrom, "dt.toLocaleDateString(NOTESFRAIS_LOCALE_V1,{day:'2-digit',month:'short'})");

    // Meme cause, second endroit : l'horodatage du brouillon sauvegarde.
    const draftFrom = "new Date(Number(ts)).toLocaleString('fr-CH',{dateStyle:'short',timeStyle:'short'})";
    if(html.includes(draftFrom)){
      html = html.replace(draftFrom, "new Date(Number(ts)).toLocaleString(NOTESFRAIS_LOCALE_V1,{dateStyle:'short',timeStyle:'short'})");
    }

    return html;
  };
})();
