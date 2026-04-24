(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    return basePatch ? basePatch(html) : html;
  };
})();
