(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('mealWith')) return html;

    html = html.replace(
      `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',note:''}`,
      `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',mealWith:'',note:''}`
    );

    html = html.replace(
      /await onAdd\(\{\.\.\.form,currency:'CHF',amountCHF:parseFloat\(form\.amount\),amount:parseFloat\(form\.amount\),tva:parseFloat\(form\.tva\)\|\|0,status:'pending',receipt(Path|Url),receiptName\}\);/,
      `const mealPrefix=window.NOTESFRAIS_CHANNEL==='mike'?'With: ':'Avec: ';
      const mealNote=form.category==='repas'&&form.mealWith?(mealPrefix+form.mealWith.trim()):'';
      const finalNote=[mealNote,form.note].filter(Boolean).join('\\n');
      await onAdd({...form,note:finalNote,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receipt$1,receiptName});`
    );

    html = html.replace(
      `<div><label style={lbl}>CatÃ©gorie</label><select style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>`,
      `<div><label style={lbl}>CatÃ©gorie</label><select style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>{form.category==='repas'&&<div><label style={lbl}>{window.NOTESFRAIS_CHANNEL==='mike'?'Who with?':'Avec qui ?'}</label><input style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.mealWith||''} onChange={e=>setForm({...form,mealWith:e.target.value})} placeholder={window.NOTESFRAIS_CHANNEL==='mike'?'Consultants, client, team...':'Consultants, client, team...'}/></div>}`
    );

    html = html.replace(
      `<div><label style={lbl}>Catégorie</label><select style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>`,
      `<div><label style={lbl}>Catégorie</label><select style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>{form.category==='repas'&&<div><label style={lbl}>{window.NOTESFRAIS_CHANNEL==='mike'?'Who with?':'Avec qui ?'}</label><input style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.mealWith||''} onChange={e=>setForm({...form,mealWith:e.target.value})} placeholder={window.NOTESFRAIS_CHANNEL==='mike'?'Consultants, client, team...':'Consultants, client, team...'}/></div>}`
    );

    return html;
  };
})();
