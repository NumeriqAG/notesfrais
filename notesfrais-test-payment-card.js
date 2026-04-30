(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('paymentCard')) return html;

    html = html.replace(
      `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',mealWith:'',note:''}`,
      `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',mealWith:'',paymentCard:'',note:''}`
    );
    html = html.replace(
      `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',note:''}`,
      `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',paymentCard:'',note:''}`
    );

    html = html.replace(
      `if(!form.amount||isNaN(parseFloat(form.amount))){setErr('Le montant est obligatoire');return;}`,
      `if(!form.amount||isNaN(parseFloat(form.amount))){setErr('Le montant est obligatoire');return;}\n    if(!form.paymentCard){setErr('Choisissez la carte utilisee');return;}`
    );

    html = html.replace(
      `<div><label style={lbl}>Date</label><input style={inp} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>`,
      `<div><label style={lbl}>Date</label><input style={inp} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div><div><label style={lbl}>Carte utilisee *</label><select style={inp} value={form.paymentCard||''} onChange={e=>setForm({...form,paymentCard:e.target.value})}><option value="">Choisir la carte...</option><option value="entreprise">Carte de l'entreprise</option><option value="perso">Carte perso</option></select></div>`
    );
    html = html.replace(
      `<div><label style={lbl}>Date</label><input style={typeof formInputStyle!=='undefined'?formInputStyle:inp} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>`,
      `<div><label style={lbl}>Date</label><input style={typeof formInputStyle!=='undefined'?formInputStyle:inp} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div><div><label style={lbl}>Carte utilisee *</label><select style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.paymentCard||''} onChange={e=>setForm({...form,paymentCard:e.target.value})}><option value="">Choisir la carte...</option><option value="entreprise">Carte de l'entreprise</option><option value="perso">Carte perso</option></select></div>`
    );

    html = html.replace(
      `const finalNote=[mealNote,form.note].filter(Boolean).join('\\n');`,
      `const cardLabel=form.paymentCard==='entreprise'?'Carte utilisee: entreprise':form.paymentCard==='perso'?'Carte utilisee: perso':'';\n      const finalNote=[cardLabel,mealNote,form.note].filter(Boolean).join('\\n');`
    );
    html = html.replace(
      `await onAdd({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptUrl,receiptName});`,
      `const cardLabel=form.paymentCard==='entreprise'?'Carte utilisee: entreprise':form.paymentCard==='perso'?'Carte utilisee: perso':'';\n      await onAdd({...form,note:[cardLabel,form.note].filter(Boolean).join('\\n'),currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptUrl,receiptName});`
    );
    html = html.replace(
      `await onAdd({...form,currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptPath,receiptName});`,
      `const cardLabel=form.paymentCard==='entreprise'?'Carte utilisee: entreprise':form.paymentCard==='perso'?'Carte utilisee: perso':'';\n      await onAdd({...form,note:[cardLabel,form.note].filter(Boolean).join('\\n'),currency:'CHF',amountCHF:parseFloat(form.amount),amount:parseFloat(form.amount),tva:parseFloat(form.tva)||0,status:'pending',receiptPath,receiptName});`
    );

    return html;
  };
})();
