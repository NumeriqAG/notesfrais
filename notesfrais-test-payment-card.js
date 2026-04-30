(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_PAYMENT_CARD_PATCH_V3_DONE')) return html;

    html = html.replace('</script>', '<!-- NOTESFRAIS_PAYMENT_CARD_PATCH_V3_DONE --></script>');

    if(!html.includes('function getPaymentCardLabel')){
      html = html.replace(
        `const isPDF=u=>u&&u.toLowerCase().includes('.pdf');`,
        `const isPDF=u=>u&&u.toLowerCase().includes('.pdf');
function getPaymentCardLabel(note){
  const m=String(note||'').match(/Carte utilisee:\\s*(entreprise|perso)/i);
  if(!m)return '';
  return m[1].toLowerCase()==='entreprise'?"Carte entreprise":"Carte perso";
}
function cleanPaymentCardNote(note){
  return String(note||'').split(/\\n+/).filter(line=>!/^Carte utilisee:/i.test(line.trim())).join(' · ');
}`
      );
    }

    if(!html.includes('paymentCard')){
      html = html.replace(
        `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',mealWith:'',note:''}`,
        `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',mealWith:'',paymentCard:'',note:''}`
      );
      html = html.replace(
        `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',note:''}`,
        `{merchant:'',amount:'',tva:'',date:defaultDate,category:'repas',paymentCard:'',note:''}`
      );
    }

    if(!html.includes('Choisissez la carte utilisee')){
      html = html.replace(
        `if(!form.amount||isNaN(parseFloat(form.amount))){setErr('Le montant est obligatoire');return;}`,
        `if(!form.amount||isNaN(parseFloat(form.amount))){setErr('Le montant est obligatoire');return;}\n    if(!form.paymentCard){setErr('Choisissez la carte utilisee');return;}`
      );
    }

    const cardField = `<div data-payment-card-field="true"><label style={lbl}>Carte utilisee *</label><select style={typeof formInputStyle!=='undefined'?formInputStyle:inp} value={form.paymentCard||''} onChange={e=>setForm({...form,paymentCard:e.target.value})}><option value="">Choisir la carte...</option><option value="entreprise">Carte de l'entreprise</option><option value="perso">Carte perso</option></select></div>`;
    if(!html.includes('data-payment-card-field')){
      html = html.replace(
        /(<div><label style=\{lbl\}>Date<\/label><input[\s\S]*?<\/div>)\s*(<div><label style=\{lbl\}>Cat(?:e|é|Ã©)gorie<\/label>)/,
        `$1${cardField}$2`
      );
    }

    html = html.replace(
      /(<div(?: data-payment-card-field="true")?><label style=\{lbl\}>Carte utilisee \*<\/label><select[\s\S]*?<\/select><\/div>)\s*(?:<div(?: data-payment-card-field="true")?><label style=\{lbl\}>Carte utilisee \*<\/label><select[\s\S]*?<\/select><\/div>)+/,
      '$1'
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

    html = html.replace(
      `{e.note&&<span>· {e.note}</span>}`,
      `{getPaymentCardLabel(e.note)&&<span style={{background:'var(--al)',color:'var(--accent)',borderRadius:999,padding:'2px 7px',fontWeight:600}}>💳 {getPaymentCardLabel(e.note)}</span>}{cleanPaymentCardNote(e.note)&&<span>· {cleanPaymentCardNote(e.note)}</span>}`
    );

    return html;
  };
})();
