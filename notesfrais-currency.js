(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_CURRENCY_V1')) return html;

    // Frais en devise etrangere (demande de Thomas, nov. 2026).
    //
    // Mike choisit la devise du recu a la saisie, CHF par defaut, et tape le
    // montant du recu tel quel. Il ne voit pas de taux de change : le serveur
    // estime le montant CHF au cours BCE du jour (api/_lib/fx.js), le
    // rapprochement avec le releve de carte le remplace par le montant
    // reellement debite, et la finance corrige ce qu'il faut dans un onglet a
    // part, « Currencies ».
    //
    // Corrige au passage la file hors ligne : le frais mis en attente perdait
    // la note composee (« Payment card », « With: »), la finance recevait un
    // frais sans carte.
    //
    // Charge apres les traductions, en anglais. Cibles copiees du HTML final
    // (node tools/check-patches.js mike). Chaque cible manquante leve une
    // erreur (CLAUDE.md §1, panne n°1).
    const rep = (label, target, replacement) => {
      if(!html.includes(target)) throw new Error('currency: cible introuvable ('+label+')');
      html = html.replace(target, replacement);
    };
    const repAll = (label, target, replacement, expected) => {
      const count = html.split(target).length - 1;
      if(count !== expected) throw new Error('currency: '+count+' occurrence(s) au lieu de '+expected+' ('+label+')');
      html = html.split(target).join(replacement);
    };

    // 1. Liste des devises et petites aides, avant les categories.
    rep('CATS', "const CATS=[", `const NOTESFRAIS_CURRENCY_V1=true;
const NOTESFRAIS_CURRENCIES=['CHF','EUR','USD','GBP','JPY','CAD','AUD','SEK','NOK','DKK','PLN','CZK','HUF','RON','BGN','ISK','TRY','CNY','HKD','SGD','KRW','INR','IDR','THB','MYR','PHP','NZD','ZAR','MXN','BRL','ILS'];
function nfIsForeign(e){return !!(e&&e.currency&&e.currency!=='CHF');}
function nfOriginalAmount(e){return (e&&e.currency?e.currency:'CHF')+' '+fmt(e&&e.amount);}
// Devise lue sur le recu : un code ISO ecrit en toutes lettres, ou un symbole.
// En cas de doute (CHF et EUR sur le meme ticket), on garde le choix de Mike.
function nfDetectCurrency(text){
  const t=' '+String(text||'').toUpperCase()+' ';
  const count=re=>(t.match(re)||[]).length;
  const scores={CHF:count(/\\bCHF\\b|\\bSFR\\b|\\bFR\\.\\s/g),EUR:count(/\\bEUR\\b|\\u20ac/g),GBP:count(/\\bGBP\\b|\\u00a3/g),USD:count(/\\bUSD\\b|US\\$/g)};
  const best=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  if(best[0][1]===0||best[0][1]===best[1][1])return '';
  return best[0][0];
}
const CATS=[`);

    // 2. Lecture des lignes : le cours applique et son origine.
    rep('nr', "amountCHF:parseFloat(r.amount_chf),tva:parseFloat(r.tva||0),category:r.category,currency:r.currency,",
      "amountCHF:parseFloat(r.amount_chf),fxRate:r.fx_rate==null?null:parseFloat(r.fx_rate),fxSource:r.fx_source||null,fxDate:r.fx_date?String(r.fx_date).slice(0,10):null,tva:parseFloat(r.tva||0),category:r.category,currency:r.currency||'CHF',");

    // 3. Enregistrement : la devise du formulaire, et la note complete aussi
    //    dans la file hors ligne.
    rep('onAdd', "await onAdd({...form,note:finalNote,currency:'CHF',amountCHF:parseFloat(form.amount),",
      "await onAdd({...form,note:finalNote,currency:form.currency||'CHF',amountCHF:parseFloat(form.amount),");
    // finalNote est declare dans le try : le catch recompose la meme note.
    rep('queue', "await queueOfflineExpense({...form,currency:'CHF',amountCHF:parseFloat(form.amount),",
      "await queueOfflineExpense({...form,note:[form.paymentCard==='entreprise'?'Payment card: company':form.paymentCard==='perso'?'Payment card: personal':'',form.category==='repas'&&form.mealWith?('With: '+String(form.mealWith).trim()):'',form.note].filter(Boolean).join('\\n'),currency:form.currency||'CHF',amountCHF:parseFloat(form.amount),");
    // Les frais en serie gardent la devise : en voyage, ils sont tous en euros.
    rep('reset', "paymentCard:prev.paymentCard||''}));", "paymentCard:prev.paymentCard||'',currency:prev.currency||'CHF'}));");

    // 4. Lecture du recu : la devise imprimee.
    rep('whitelist', "tessedit_char_whitelist:'", "tessedit_char_whitelist:'\u20ac\u00a3$");
    rep('ocr fill', "setForm(f=>({...f,merchant:fields.merchant||f.merchant,",
      "const nfCur=nfDetectCurrency(result.data.text||'');\n      setForm(f=>({...f,currency:nfCur||f.currency||'CHF',merchant:fields.merchant||f.merchant,");

    // 5. Feuille de capture (iPhone) : selecteur a cote du montant.
    rep('sheet amount', '<div className="nfm-row"><label>Total CHF</label><input className="nfm-amount"',
      '<div className="nfm-row"><label>Total</label><select className="nfm-cur" aria-label="Currency" value={form.currency||\'CHF\'} onChange={e=>setForm({...form,currency:e.target.value})}>{NOTESFRAIS_CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select><input className="nfm-amount"');
    rep('sheet vat', '<div className="nfm-row"><label>VAT CHF</label>', "<div className=\"nfm-row\"><label>{'VAT '+(form.currency||'CHF')}</label>");
    rep('sheet css', '.nfm-row input.nfm-amount{', '.nfm-row select.nfm-cur{flex:none;font-size:16px;font-weight:700;padding:6px 10px;border-radius:9px;background:#EAF0F5;color:#0F5E92;text-align-last:center;border:0}.nfm-row select.nfm-cur+input.nfm-amount{min-width:0;flex:1}.nfm-row input.nfm-amount{');

    // 6. Formulaire bureau.
    rep('desk amount', "<div><label style={lbl}>Amount CHF *</label><input style={typeof formInputStyle!=='undefined'?formInputStyle:inp} type=\"number\"",
      "<div><label style={lbl}>{'Amount '+(form.currency||'CHF')+' *'}</label><div style={{display:'flex',gap:6}}><select aria-label=\"Currency\" value={form.currency||'CHF'} onChange={e=>setForm({...form,currency:e.target.value})} style={{...inp,width:86,flex:'none'}}>{NOTESFRAIS_CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select><input style={typeof formInputStyle!=='undefined'?formInputStyle:inp} type=\"number\"");
    rep('desk amount end', "value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder=\"0.00\"/></div>\n            <div><label style={lbl}>VAT CHF</label>",
      "value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} placeholder=\"0.00\"/></div></div>\n            <div><label style={lbl}>{'VAT '+(form.currency||'CHF')}</label>");

    // 7. Edition (Mike et finance) : le montant d'origine et sa devise.
    repAll('edit init', "amount:String(Number(expense.amountCHF||expense.amount||0).toFixed(2)),",
      "amount:String(Number((nfIsForeign(expense)?expense.amount:(expense.amountCHF||expense.amount))||0).toFixed(2)),currency:expense.currency||'CHF',", 2);
    rep('user edit save', "        amount,\n        amount_chf:amount,", "        amount,\n        currency:form.currency||'CHF',\n        amount_chf:amount,");
    rep('finance edit save', "        amount:amount,\n        amount_chf:amount,", "        amount:amount,\n        currency:form.currency||'CHF',\n        amount_chf:amount,");
    rep('user edit field', ">Amount CHF<input type=\"number\" min=\"0\" step=\"0.01\" value={form.amount} onChange={e=>setField('amount',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>",
      ">{'Amount '+(form.currency||'CHF')}<span style={{display:'flex',gap:6}}><select aria-label=\"Currency\" value={form.currency||'CHF'} onChange={e=>setField('currency',e.target.value)} style={{...inp,fontSize:isMobile?16:14,width:90,flex:'none',background:'#fff'}}>{NOTESFRAIS_CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select><input type=\"number\" min=\"0\" step=\"0.01\" value={form.amount} onChange={e=>setField('amount',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></span></label>");
    rep('finance edit field', ">Amount CHF<input type=\"number\" step=\"0.01\" value={form.amount} onChange={e=>setField('amount',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></label>",
      ">{'Amount '+(form.currency||'CHF')}<span style={{display:'flex',gap:6}}><select aria-label=\"Currency\" value={form.currency||'CHF'} onChange={e=>setField('currency',e.target.value)} style={{...inp,fontSize:isMobile?16:14,width:90,flex:'none',background:'#fff'}}>{NOTESFRAIS_CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select><input type=\"number\" step=\"0.01\" value={form.amount} onChange={e=>setField('amount',e.target.value)} style={{...inp,fontSize:isMobile?16:14}}/></span></label>");

    // 8. Affichage : le montant d'origine sous le montant CHF.
    rep('row amount', "<div style={{fontWeight:700,fontFamily:'DM Mono',fontSize:15}}>{isMobile?'':'CHF '}{fmt(e.amountCHF||e.amount)}</div>{e.tva>0&&<div style={{fontSize:11,color:'var(--t3)'}}>VAT {fmt(e.tva)}</div>}",
      "<div style={{fontWeight:700,fontFamily:'DM Mono',fontSize:15}}>{isMobile?'':'CHF '}{fmt(e.amountCHF||e.amount)}</div>{nfIsForeign(e)&&<div className=\"nf-fx-orig\" style={{fontSize:11,color:'var(--t3)',fontFamily:'DM Mono'}}>{nfOriginalAmount(e)}</div>}{e.tva>0&&<div style={{fontSize:11,color:'var(--t3)'}}>{'VAT '+(nfIsForeign(e)?e.currency+' ':'')+fmt(e.tva)}</div>}");
    rep('finance row amount', "<div style={{fontFamily:'DM Mono',fontWeight:900,textAlign:isMobile?'left':'right'}}>CHF {fmt(e.amountCHF||e.amount)}<div style={{fontSize:11,color:'var(--t3)',fontWeight:600}}>",
      "<div style={{fontFamily:'DM Mono',fontWeight:900,textAlign:isMobile?'left':'right'}}>CHF {fmt(e.amountCHF||e.amount)}{nfIsForeign(e)&&<div style={{fontSize:11,color:'var(--t3)',fontWeight:600}}>{nfOriginalAmount(e)}</div>}<div style={{fontSize:11,color:'var(--t3)',fontWeight:600}}>");
    rep('detail amount', "<div className=\"nfm-dt-amount\">{'CHF '+fmt(e.amountCHF||e.amount)}</div>",
      "<div className=\"nfm-dt-amount\">{'CHF '+fmt(e.amountCHF||e.amount)}</div>{nfIsForeign(e)&&<div className=\"nfm-dt-fx\" style={{fontSize:13,color:'#6B7785',marginTop:2}}>{nfOriginalAmount(e)}</div>}");

    // 9. TVA recuperable : seule la TVA suisse se recupere.
    rep('vat total', "const tva=mE.reduce((s,e)=>s+Number(e.tva||0),0);", "const tva=mE.reduce((s,e)=>s+(nfIsForeign(e)?0:Number(e.tva||0)),0);");

    // 10. Onglet finance « Currencies ».
    rep('fx tab component', 'function App(){', `function nfFxSourceLabel(e){
  if(e.fxSource==='card')return {t:'Card statement',c:'#17663F',bg:'#E5F3EA'};
  if(e.fxSource==='manual')return {t:'Set by finance',c:'#0F5E92',bg:'#E6F1FA'};
  if(e.fxSource==='missing'||!e.fxRate)return {t:'No rate yet',c:'#B42318',bg:'#FCEBEB'};
  return {t:'ECB estimate'+(e.fxDate?' \\u00b7 '+fd(e.fxDate):''),c:'#A04A06',bg:'#FDF0E3'};
}
function NfFxRow({e,onSaved,isMobile}){
  const [edit,setEdit]=useState(false);
  const [rate,setRate]=useState('');
  const [chf,setChf]=useState('');
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const src=nfFxSourceLabel(e);
  const open=()=>{setRate(e.fxRate?String(Number(e.fxRate).toFixed(6)):'');setChf(String(Number(e.amountCHF||0).toFixed(2)));setErr('');setEdit(true);};
  const save=async(values)=>{
    setBusy(true);setErr('');
    try{const updated=await fwUpdateFinanceExpense(e.id,values);onSaved(updated);setEdit(false);}
    catch(x){setErr(x.message||String(x));}
    finally{setBusy(false);}
  };
  const saveRate=()=>{const r=Number(rate);if(!(r>0)){setErr('Enter a rate above 0.');return;}save({fx_rate:r,fx_source:'manual'});};
  const saveChf=()=>{const c=Number(chf);if(!(c>=0)||chf===''){setErr('Enter the CHF amount.');return;}save({amount_chf:c,fx_source:'manual'});};
  return <div data-nf-fx-row={e.id} style={{padding:'12px 16px',borderTop:'0.5px solid var(--border)',display:'grid',gridTemplateColumns:isMobile?'1fr':'90px minmax(0,1fr) 120px 110px 120px',gap:isMobile?6:12,alignItems:'center'}}>
    <div style={{fontSize:12,color:'var(--t3)'}}>{fd(e.date)}</div>
    <div style={{minWidth:0}}><div style={{fontWeight:800,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.merchant}</div><span style={{display:'inline-block',marginTop:4,fontSize:11,fontWeight:700,borderRadius:999,padding:'2px 8px',color:src.c,background:src.bg}}>{src.t}</span>{e.ubsRow&&<span style={{marginLeft:6,fontSize:11,color:'var(--t3)'}}>{'\\u21b3 '+e.ubsRow.label}</span>}</div>
    <div style={{fontFamily:'DM Mono',fontWeight:700,textAlign:isMobile?'left':'right'}}>{nfOriginalAmount(e)}</div>
    <div style={{fontFamily:'DM Mono',fontSize:12,color:'var(--t2)',textAlign:isMobile?'left':'right'}}>{e.fxRate?('\\u00d7 '+Number(e.fxRate).toFixed(4)):'\\u2014'}</div>
    <div style={{textAlign:isMobile?'left':'right'}}><div style={{fontFamily:'DM Mono',fontWeight:900}}>{'CHF '+fmt(e.amountCHF||e.amount)}</div>{!edit&&<button type="button" data-nf-fx-edit onClick={open} style={{...bS,padding:'4px 10px',fontSize:12,marginTop:4}}>Adjust</button>}</div>
    {edit&&<div style={{gridColumn:'1 / -1',background:'var(--s2)',borderRadius:10,padding:12,display:'grid',gap:10}}>
      <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr':'1fr 1fr',gap:10}}>
        <label style={{display:'grid',gap:4,fontSize:12,fontWeight:700,color:'var(--t2)'}}>{'Rate (CHF for 1 '+e.currency+')'}<span style={{display:'flex',gap:6}}><input data-nf-fx-rate type="number" step="0.000001" min="0" value={rate} onChange={x=>setRate(x.target.value)} style={inp}/><button type="button" disabled={busy} onClick={saveRate} style={{...bP,padding:'8px 12px',whiteSpace:'nowrap'}}>Apply rate</button></span></label>
        <label style={{display:'grid',gap:4,fontSize:12,fontWeight:700,color:'var(--t2)'}}>Amount in CHF<span style={{display:'flex',gap:6}}><input data-nf-fx-chf type="number" step="0.01" min="0" value={chf} onChange={x=>setChf(x.target.value)} style={inp}/><button type="button" disabled={busy} onClick={saveChf} style={{...bP,padding:'8px 12px',whiteSpace:'nowrap'}}>Set CHF</button></span></label>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" disabled={busy} onClick={()=>save({fx_source:'ecb'})} style={{...bS,fontSize:12}}>Use ECB rate of the day</button><button type="button" disabled={busy} onClick={()=>setEdit(false)} style={{...bS,fontSize:12}}>Cancel</button></div>
      {err&&<div style={{color:'var(--red)',fontSize:12,fontWeight:700}}>{err}</div>}
    </div>}
  </div>;
}
function NfFxTab({mE,setExpenses,header}){
  const isMobile=typeof window!=='undefined'&&window.innerWidth<860;
  const list=mE.filter(nfIsForeign).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const byCur={};
  list.forEach(e=>{const k=e.currency;byCur[k]=byCur[k]||{n:0,orig:0,chf:0};byCur[k].n++;byCur[k].orig+=Number(e.amount||0);byCur[k].chf+=Number(e.amountCHF||0);});
  const toCheck=list.filter(e=>e.fxSource!=='card'&&e.fxSource!=='manual').length;
  const onSaved=u=>{if(!u||!u.id)return;setExpenses(prev=>prev.map(x=>x.id===u.id?{...x,...u}:x));};
  return <div data-nf-fx-tab="1" style={{maxWidth:isMobile?'100%':980}}>
    {header}
    <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:16,marginBottom:14,fontSize:13,color:'var(--t2)',lineHeight:1.55}}>
      <div style={{fontWeight:900,color:'var(--text)',marginBottom:6}}>How amounts in foreign currencies are converted</div>
      The employee types the amount of the receipt in its currency. The CHF amount is first an <b>estimate</b> at the ECB rate of the expense date. When the card statement is matched, it is replaced by the amount <b>actually charged</b> (card rate and fees included). You can set a rate or a CHF amount yourself below.
    </div>
    {list.length===0
      ?<div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:36,textAlign:'center',color:'var(--t3)'}}>No expense in a foreign currency for this period.</div>
      :<React.Fragment>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(4,1fr)',gap:12,marginBottom:14}}>
          {Object.entries(byCur).map(([k,v])=><div key={k} style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,padding:14}}><div style={{fontSize:11,color:'var(--t3)',fontWeight:800,letterSpacing:'.06em'}}>{k+' \\u00b7 '+v.n+' expense'+(v.n>1?'s':'')}</div><div style={{fontFamily:'DM Mono',fontWeight:900,fontSize:16,marginTop:4}}>{k+' '+fmt(v.orig)}</div><div style={{fontFamily:'DM Mono',fontSize:12,color:'var(--t2)',marginTop:2}}>{'= CHF '+fmt(v.chf)}</div></div>)}
          <div style={{background:toCheck?'#FDF0E3':'#E5F3EA',borderRadius:14,padding:14}}><div style={{fontSize:11,fontWeight:800,letterSpacing:'.06em',color:toCheck?'#A04A06':'#17663F'}}>TO CONFIRM</div><div style={{fontWeight:900,fontSize:16,marginTop:4,color:toCheck?'#A04A06':'#17663F'}}>{toCheck?toCheck+' estimate'+(toCheck>1?'s':''):'All confirmed'}</div><div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>{toCheck?'Not matched with the card statement yet':'Card statement or finance'}</div></div>
        </div>
        <div style={{background:'#fff',border:'0.5px solid var(--border)',borderRadius:14,overflow:'hidden'}}>
          {!isMobile&&<div style={{padding:'10px 16px',display:'grid',gridTemplateColumns:'90px minmax(0,1fr) 120px 110px 120px',gap:12,fontSize:11,fontWeight:800,color:'var(--t3)',letterSpacing:'.06em'}}><div>DATE</div><div>MERCHANT</div><div style={{textAlign:'right'}}>RECEIPT</div><div style={{textAlign:'right'}}>RATE</div><div style={{textAlign:'right'}}>CHF</div></div>}
          {list.map(e=><NfFxRow key={e.id} e={e} onSaved={onSaved} isMobile={isMobile}/>)}
        </div>
      </React.Fragment>}
  </div>;
}
function App(){`);
    rep('fx tab render', "{tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}",
      "{tab==='settings'&&window.notesFraisRole==='finance'&&<FinanceSettingsTab/>}{tab==='fx'&&window.notesFraisRole==='finance'&&<NfFxTab mE={mE} setExpenses={setExpenses} header={<PeriodHeader title={'Currencies'} subtitle={'Exchange rates \\u00b7 '+ML} periodMode={periodMode} setPeriodMode={setPeriodMode} month={month} setMonth={setMonth} periodFrom={periodFrom} setPeriodFrom={setPeriodFrom} periodTo={periodTo} setPeriodTo={setPeriodTo} monthCounts={monthCounts}/>}/>}");
    rep('fx tab select', '<option value="recon">UBS statement</option><option value="settings">Settings</option>',
      '<option value="recon">UBS statement</option><option value="fx">Currencies</option><option value="settings">Settings</option>');
    rep('fx tab sidebar', "['recon','\u{1F3E6}','UBS statement'],['settings','\u2699\uFE0F','Settings']]",
      "['recon','\u{1F3E6}','UBS statement'],['fx','\u{1F4B1}','Currencies'],['settings','\u2699\uFE0F','Settings']]");
    rep('fx tab bottom nav', "if(isFinance())return [['finance','Finance'],['finance_expenses','Expenses'],['stats','Stats'],['recon','UBS'],['settings','Settings']];",
      "if(isFinance())return [['finance','Finance'],['finance_expenses','Expenses'],['stats','Stats'],['recon','UBS'],['fx','FX'],['settings','Settings']];");
    rep('fx tab labels', "finance_expenses:['Expenses'],settings:['Settings','Settings']};", "finance_expenses:['Expenses'],fx:['Currencies'],settings:['Settings','Settings']};");
    return html;
  };
})();
