(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_MEAL_CONTEXT_V2')) return html;

    html = html.replace(
      'function AddModal(',
      'const NOTESFRAIS_MEAL_CONTEXT_V2=true;\nfunction AddModal('
    );
    html = html.replace(
      /category:'repas',note:''/g,
      "category:'repas',mealWith:'',note:''"
    );

    const mealValidation = `if(form.category==='repas'&&!String(form.mealWith||'').trim()){setErr('Who was this meal with?');return;}\n    `;
    html = html.replace(
      /if\(!form\.merchant\)\{setErr\('[^']*'\);return;\}/,
      match => mealValidation + match
    );

    html = html.replace(
      /await onAdd\(\{\.\.\.form,currency:'CHF',amountCHF:parseFloat\(form\.amount\),amount:parseFloat\(form\.amount\),tva:parseFloat\(form\.tva\)\|\|0,status:'pending',receipt(Path|Url),receiptName\}\);/,
      `const mealPrefix='With: ';
      const mealNote=form.category==='repas'&&form.mealWith?(mealPrefix+form.mealWith.trim()):'';
      const finalNote=[mealNote,form.note].filter(Boolean).join('\\n');
      await onAdd({...form,note:finalNote,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receipt$1,receiptName});`
    );

    const mealField = `{form.category==='repas'&&<div><label style={lbl}>{'Who with? *'}</label><input required style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.mealWith||''} onChange={e=>setForm({...form,mealWith:e.target.value})} placeholder={'Client, colleagues, team...'}/></div>}`;
    html = html.replace(
      /(<div><label style=\{lbl\}>[^<]*Cat[^<]*<\/label><select[^>]*value=\{form\.category\}[\s\S]*?<\/select><\/div>)(?!\{form\.category==='repas')/,
      `$1${mealField}`
    );

    return html;
  };
})();
