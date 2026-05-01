(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_CURRENT_MONTH_DEFAULT_DONE')) return html;
    html = html.replace('</script>', '<!-- NOTESFRAIS_CURRENT_MONTH_DEFAULT_DONE --></script>');

    const helper = `function getDefaultNotesFraisMonth(){
  const now=new Date();
  const current=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  return MONTHS.some(m=>m.v===current)?current:'2026-03';
}`;

    if(!html.includes('function getDefaultNotesFraisMonth')){
      html = html.replace(
        `const fmt=n=>Number(n||0).toFixed(2);`,
        helper + `\nconst fmt=n=>Number(n||0).toFixed(2);`
      );
    }

    html = html.replace(
      `const [month,setMonth]=useState('2026-03');`,
      `const [month,setMonth]=useState(()=>getDefaultNotesFraisMonth());`
    );

    return html;
  };
})();
