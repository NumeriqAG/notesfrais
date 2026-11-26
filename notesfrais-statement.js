(function(){
  // Releve de carte ou de banque : lecture et rapprochement (nov. 2026).
  //
  // Le test d'un mois complet a montre deux pannes :
  //
  //  1. Le rapprochement ratait les cas evidents. labelsClose() d'app.html
  //     rendait « faux » des qu'un seul mot etait commun et absent de sa
  //     petite liste (« Shell » / « SHELL WOLLISHOFEN », « Dishoom » /
  //     « DISHOOM KINGLY ST LONDON »), avant meme de tester l'inclusion. Le
  //     frais etait alors propose en « + Create », d'ou des doublons.
  //  2. Seul un format CSV invente etait lu. Les frais de Mike passent en fait
  //     sur ses cartes Swisscard (Amex et Mastercard), dont le releve est un
  //     PDF, parfois une version papier scannee.
  //
  // Ce patch remplace donc parseUBS et reconcile par nfParseStatement et
  // nfReconcile :
  //  - CSV : separateur, ligne d'en-tete et colonnes detectes (UBS e-banking,
  //    export de carte UBS, Swisscard, ancien format) ;
  //  - PDF : texte de la page par pdf.js, ou, pour un scan, OCR Tesseract de
  //    chaque page, puis lecture des lignes « date libelle montant » ; la
  //    ligne « USD 108.10, Rate: … » qui suit un paiement en devise donne le
  //    montant d'origine ;
  //  - rapprochement par paires, les meilleures d'abord : montant (y compris
  //    dans la devise d'origine, et un pourboire plausible), date a ±4 jours,
  //    puis libelle ; un montant exact le meme jour suffit. Une ligne sans
  //    frais propose le frais qui lui ressemble le plus (« Link ») avant
  //    « + Create ».
  //  - un frais en devise rapproche prend le montant CHF reellement debite
  //    (fx_source 'card', voir api/_lib/fx.js).
  //
  // Charge apres les traductions, en anglais ; chaque cible manquante leve
  // une erreur.
  const CORE = String.raw`const NOTESFRAIS_STATEMENT_V1=true;
function nfStFold(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function nfStNorm(s){return nfStFold(s).replace(/ae/g,'a').replace(/oe/g,'o').replace(/ue/g,'u').replace(/[^a-z0-9]+/g,' ').trim();}
function nfStAmount(s){
  let t=String(s==null?'':s).trim().replace(/[\u2019'\s]/g,'').replace(/^\+/,'');
  if(!t||t==='-')return NaN;
  let neg=false;
  if(/-$/.test(t)){neg=true;t=t.slice(0,-1);}
  if(/^\(.*\)$/.test(t)){neg=true;t=t.slice(1,-1);}
  if(t.indexOf(',')>=0&&t.indexOf('.')>=0)t=t.replace(/,/g,'');
  else if(/,\d{1,2}$/.test(t))t=t.replace(',','.');
  else t=t.replace(/,/g,'');
  if(!/^-?\d+(\.\d+)?$/.test(t))return NaN;
  const n=parseFloat(t);
  return neg?-n:n;
}
function nfStDate(s){
  const t=String(s||'').trim();
  let m=t.match(/^(\d{1,2})[.\/,](\d{1,2})[.\/,](\d{2}|\d{4})\b/);
  if(m){const y=m[3].length===2?'20'+m[3]:m[3];const mo=+m[2],d=+m[1];if(mo<1||mo>12||d<1||d>31)return null;return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
  m=t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return m[1]+'-'+m[2]+'-'+m[3];
  return null;
}
const NF_ST_COLS={
  date:['einkaufsdatum','transaktionsdatum','transaction date','date de transaction','abschlussdatum','datum','date','buchungsdatum','booking date','valuta'],
  label:['buchungstext','beschreibung1','description','beschreibung','merchant','handler','libelle','text','details','empfanger','payee'],
  amount:['betrag in chf','amount in chf','einzelbetrag','betrag','amount','montant'],
  debit:['belastung','debit','lastschrift','soll','ausgang'],
  credit:['gutschrift','credit','haben','eingang'],
  currency:['wahrung','currency','devise'],
  origCurrency:['originalwahrung','foreign currency','fremdwahrung','devise originale','original currency'],
  origAmount:['amount in foreign currency','betrag in fremdwahrung','originalbetrag','montant original','original amount'],
  sign:['debit/credit','soll/haben','credit/debit'],
  card:['kartennummer','card number','numero de carte']
};
function nfStSplit(line,d){
  const r=[];let cur='',q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++;continue;}q=!q;continue;}
    if(ch===d&&!q){r.push(cur);cur='';continue;}
    cur+=ch;
  }
  r.push(cur);
  return r.map(x=>x.trim());
}
function nfStHeader(cells){
  const h=cells.map(c=>nfStFold(c).replace(/[^a-z0-9\/ ]+/g,' ').replace(/\s+/g,' ').trim());
  const used=new Set();const col={};
  const find=names=>{
    for(const pass of [0,1,2])for(const n of names){
      const i=h.findIndex((x,idx)=>!used.has(idx)&&x&&(pass===0?x===n:pass===1?x.startsWith(n):x.includes(n)));
      if(i>=0){used.add(i);return i;}
    }
    return -1;
  };
  for(const k of ['sign','origCurrency','origAmount','date','debit','credit','currency','label','amount','card'])col[k]=find(NF_ST_COLS[k]);
  const ok=col.date>=0&&(col.amount>=0||col.debit>=0||col.credit>=0);
  return {col,ok,score:Object.values(col).filter(i=>i>=0).length,h};
}
function nfStIsCredit(label){return /\b(your payment|payment thank|thank you|zahlung danke|ruckzahlung|gutschrift|remboursement|paiement merci|credit)\b/.test(nfStNorm(label).replace(/ +/g,' '));}
function nfParseStatementCsv(raw){
  const lines=String(raw||'').replace(/^\ufeff/,'').split(/\r?\n/).filter(l=>l.trim().length>0&&!/^sep=/i.test(l.trim()));
  let best=null;
  for(let i=0;i<Math.min(40,lines.length);i++){
    for(const d of [';','\t',',']){
      if(lines[i].indexOf(d)<0)continue;
      const head=nfStHeader(nfStSplit(lines[i],d));
      if(head.ok&&(!best||head.score>best.head.score))best={i,d,head};
    }
    if(best&&best.i===i)break;
  }
  if(!best)return null;
  const {col}=best.head;const d=best.d;const rows=[];
  const at=(c,k)=>col[k]>=0?(c[col[k]]||''):'';
  for(let i=best.i+1;i<lines.length;i++){
    const c=nfStSplit(lines[i],d);
    if(c.length<2)continue;
    const date=nfStDate(at(c,'date'));
    if(!date)continue;
    let label=at(c,'label');
    if(!label){const alt=c.find((x,idx)=>idx!==col.date&&/[a-z]{3}/i.test(x)&&isNaN(nfStAmount(x)));label=alt||'';}
    label=label.replace(/;/g,', ').replace(/\s+/g,' ').trim();
    let amount=NaN;
    const deb=nfStAmount(at(c,'debit')),cre=nfStAmount(at(c,'credit'));
    if(!isNaN(deb)&&deb!==0)amount=-Math.abs(deb);
    else if(!isNaN(cre)&&cre!==0)amount=Math.abs(cre);
    else if(col.amount>=0&&!(col.origCurrency>=0&&col.debit>=0&&col.origAmount<0))amount=nfStAmount(at(c,'amount'));
    if(isNaN(amount))continue;
    if(col.sign>=0){const s=nfStNorm(at(c,'sign'));if(/credit|haben|gutschrift|^cr$/.test(s))amount=Math.abs(amount);else if(/debit|soll|belastung|^dr$/.test(s))amount=-Math.abs(amount);}
    const row={date,label,amount,currency:'CHF'};
    if(col.origCurrency>=0){
      const cur=String(at(c,'origCurrency')).toUpperCase().trim();
      const oaRaw=col.origAmount>=0?at(c,'origAmount'):(col.debit>=0&&col.amount>=0?at(c,'amount'):'');
      const oa=nfStAmount(oaRaw);
      if(/^[A-Z]{3}$/.test(cur)&&!isNaN(oa)&&oa!==0)row.orig={currency:cur,amount:Math.abs(oa)};
    }
    if(col.card>=0){const k=String(at(c,'card')).replace(/\s/g,'');if(k)row.card='\u2026'+k.slice(-4);}
    rows.push(row);
  }
  // Un export de carte ne liste que des debits, en positif.
  if(rows.length&&!rows.some(r=>r.amount<0)&&col.credit<0&&col.sign<0){
    rows.forEach(r=>{r.amount=nfStIsCredit(r.label)?Math.abs(r.amount):-Math.abs(r.amount);});
  }
  const info=lines.slice(0,best.i).map(l=>nfStSplit(l,d).filter(Boolean).join(' ')).filter(l=>l.length>2).slice(0,3).join(' \u00b7 ');
  return {rows,info,kind:'csv'};
}
// Lignes de texte d'un releve PDF (texte de la page ou OCR).
function nfParseStatementText(text){
  const lines=String(text||'').split(/\r?\n/);
  const rows=[];let card='';let last=null;const totals={};
  const isSwisscard=/swisscard/i.test(text);
  for(const raw of lines){
    const line=raw.replace(/[\u2014\u2013]/g,'-').replace(/\s+/g,' ').trim();
    if(!line){continue;}
    const cardM=line.match(/\b(Amex|American Express|Master ?card|Visa)\b[^,]*,\s*([0-9X]{4}[0-9X ]{6,})/i);
    if(cardM){card=(/amex|american/i.test(cardM[1])?'Amex':/visa/i.test(cardM[1])?'Visa':'Mastercard')+' \u2026'+cardM[2].replace(/\s/g,'').slice(-4);last=null;continue;}
    // Le total imprime par carte sert de controle a la lecture d'un scan.
    const tot=line.match(/total cardholder transactions\s+(-?\d[0-9'\u2019 ]*[.,]\d{2})\s*$/i);
    if(tot){if(card)totals[card]=nfStAmount(tot[1]);last=null;continue;}
    const fx=line.match(/^([A-Z]{3})\s+([0-9][0-9'\u2019.,]*\d)\s*,/);
    if(fx&&last){
      const cur=fx[1]==='GHF'||fx[1]==='CHE'?'CHF':fx[1];
      const oa=nfStAmount(fx[2]);
      if(!isNaN(oa)&&oa>0)last.orig={currency:cur,amount:oa};
      last=null;continue;
    }
    const m=line.match(/(\d{1,2})[.,](\d{1,2})[.,](\d{2,4})\s+(.+?)\s+(-?\d{1,3}(?:['\u2019 ]?\d{3})*[.,]\d{2})\s*(-|CR)?$/);
    if(!m||m.index>14){if(!/^\s*$/.test(line))last=last&&/handling|rate|amount in/i.test(line)?last:null;continue;}
    const date=nfStDate(m[1]+'.'+m[2]+'.'+m[3]);
    const label=m[4].replace(/\s+/g,' ').trim();
    if(!date||!/[a-z]{2}/i.test(label)){last=null;continue;}
    if(/transfer to company account|sub ?total|^total|balance|saldo|previous page/i.test(label)){last=null;continue;}
    let amount=nfStAmount(m[5]);
    if(isNaN(amount)){last=null;continue;}
    amount=(nfStIsCredit(label)||m[6])?Math.abs(amount):-Math.abs(amount);
    last={date,label,amount,currency:'CHF'};
    if(card)last.card=card;
    rows.push(last);
  }
  const cards=[...new Set(rows.map(r=>r.card).filter(Boolean))];
  let info=(isSwisscard?'Swisscard statement':'PDF statement')+(cards.length?' \u00b7 '+cards.join(', '):'');
  const checked=Object.keys(totals);
  let totalsOk=null;
  if(checked.length){
    const off=checked.filter(c=>Math.abs(rows.filter(r=>r.card===c&&r.amount<0).reduce((s,r)=>s-r.amount,0)-totals[c])>0.004);
    totalsOk=off.length===0;
    info+=totalsOk?' \u00b7 totals match the statement':' \u00b7 totals differ for '+off.join(', ')+': check the amounts';
  }
  return {rows,info,kind:'text',totalsOk};
}
function nfParseStatement(raw){
  const csv=nfParseStatementCsv(raw);
  if(csv&&csv.rows.length)return csv;
  const txt=nfParseStatementText(raw);
  if(txt.rows.length)return txt;
  return csv||txt;
}
const NF_ST_STOP=new Set(['sa','ag','gmbh','sarl','sagl','ltd','inc','llc','the','and','des','les','du','de','la','le','zur','zum','und','chez','com','www','net','org','card','payment','zahlung','debitkarte','kartennummer','xxxx','trip','help','online','sas','srl','spa','plc','bv','ab','oy']);
const NF_ST_WEAK=new Set(['geneve','geneva','genf','zurich','bern','berne','basel','bale','lausanne','zug','luzern','lucerne','lugano','winterthur','london','paris','dublin','berlin','munich','munchen','milan','milano','york','francisco','restaurant','cafe','hotel','parking','parkhaus','taxi','shop','store','airport','flughafen','aeroport','bahnhof','gare','station','tankstelle','service','international','switzerland','schweiz','suisse','france','fra','che','gbr']);
function nfStTokens(s){return [...new Set(nfStNorm(s).split(' ').filter(t=>t.length>=3&&!/^\d+$/.test(t)&&!NF_ST_STOP.has(t)))];}
function nfStLabelSim(a,b){
  const ta=nfStTokens(a),tb=nfStTokens(b);
  let strong=0,weak=0;
  for(const t of ta){
    const hit=tb.some(u=>u===t||(t.length>=4&&u.length>=4&&(u.startsWith(t)||t.startsWith(u))));
    if(hit){if(NF_ST_WEAK.has(t))weak++;else strong++;}
  }
  if(!strong){
    const ja=nfStNorm(a).replace(/ /g,''),jb=nfStNorm(b).replace(/ /g,'');
    if(ja.length>=4&&jb.length>=4&&(ja.includes(jb)||jb.includes(ja)))strong=1;
  }
  return {strong,weak};
}
function nfStDays(a,b){return Math.abs((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000);}
// Score d'un couple frais / ligne, ou null s'ils ne peuvent pas aller ensemble.
function nfStPair(exp,row){
  if(!(row.amount<0)||!exp.date||!row.date)return null;
  const dd=nfStDays(exp.date,row.date);
  if(dd>4)return null;
  const ra=Math.abs(row.amount);
  const foreign=exp.currency&&exp.currency!=='CHF';
  let amt=0;
  const rel=(x,y)=>Math.abs(x-y)/Math.max(Math.abs(y),0.01);
  if(row.orig&&foreign&&row.orig.currency===exp.currency){
    const r=rel(Number(exp.amount),row.orig.amount);
    amt=r<=0.005?1:r<=0.03?0.8:(row.orig.amount>Number(exp.amount)&&r<=0.2)?0.5:0;
  }else{
    const base=row.orig&&row.orig.currency==='CHF'&&!foreign?row.orig.amount:ra;
    const ea=Math.abs(Number(foreign?(exp.amountCHF||exp.amount):(exp.amount||exp.amountCHF))||0);
    const r=rel(ea,base);
    if(foreign)amt=r<=0.07?0.6:0;
    else amt=r<=0.005?1:r<=0.05?0.75:(base>ea&&(base-ea)<=Math.max(0.2*ea,10))?0.45:0;
  }
  if(!amt)return null;
  const lab=nfStLabelSim(exp.merchant,row.label);
  const exact=amt===1&&dd<=1;
  if(!lab.strong&&!exact&&!(lab.weak&&amt>=0.75&&dd<=2))return null;
  return lab.strong*3+lab.weak*0.6+amt*2+(1-dd*0.15);
}
function nfReconcile(expenses,rows){
  const pairs=[];
  expenses.forEach((e,i)=>rows.forEach((r,j)=>{const s=nfStPair(e,r);if(s!=null)pairs.push([s,i,j]);}));
  pairs.sort((a,b)=>b[0]-a[0]);
  const eUsed=new Map(),rUsed=new Set();
  for(const [,i,j] of pairs){if(eUsed.has(i)||rUsed.has(j))continue;eUsed.set(i,j);rUsed.add(j);}
  const updated=expenses.map((exp,i)=>{
    if(!eUsed.has(i))return {...exp,status:'pending',ubsRow:null,amtDiff:0};
    const row=rows[eUsed.get(i)];
    const charged=Math.abs(row.amount);
    if(exp.currency&&exp.currency!=='CHF'){
      return {...exp,status:'reconciled',ubsRow:row,amtDiff:0,nfCardChf:Math.round(charged*100)/100};
    }
    const ea=Math.abs(Number(exp.amountCHF||exp.amount)||0);
    return {...exp,status:'reconciled',ubsRow:row,amtDiff:Math.abs(ea-charged)>0.005?charged-ea:0};
  });
  const forgotten=rows.filter((r,j)=>!rUsed.has(j)&&r.amount<0).map(r=>{
    // Le frais qui ressemble le plus a cette ligne, pour « Link » plutot que
    // « + Create » : meme montant a 25 % pres ou meme commercant, ±5 jours.
    let best=null,bestScore=0;
    expenses.forEach((e,i)=>{
      if(eUsed.has(i)||!e.date)return;
      const dd=nfStDays(e.date,r.date);if(dd>5)return;
      const ea=Math.abs(Number(e.amountCHF||e.amount)||0),ra=Math.abs(r.amount);
      const close=Math.abs(ea-ra)/Math.max(ra,0.01);
      const lab=nfStLabelSim(e.merchant,r.label);
      const s=(lab.strong?3:0)+(close<=0.25?2-close*4:0)-dd*0.2;
      if((lab.strong||close<=0.25)&&s>bestScore){bestScore=s;best=e;}
    });
    return best?{...r,candidate:{id:best.id,merchant:best.merchant,date:best.date,amount:best.amountCHF||best.amount,currency:best.currency||'CHF'}}:r;
  });
  return {expenses:updated,forgotten};
}
// ── PDF ─────────────────────────────────────────────────────────────
function nfStLoadScript(src,test){
  if(test())return Promise.resolve();
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve();s.onerror=()=>reject(new Error('Could not load '+src));document.head.appendChild(s);});
}
async function nfStLoadPdfJs(){
  // Le worker de pdf.js est charge comme simple script : pdf.js travaille alors
  // dans la page, sans Worker blob: (que Safari tue, voir le piege Tesseract).
  await nfStLoadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.worker.min.js',()=>!!window.pdfjsWorker);
  await nfStLoadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/pdf.min.js',()=>!!window.pdfjsLib);
  return window.pdfjsLib;
}
function nfStPageText(content){
  const items=(content.items||[]).filter(it=>it&&typeof it.str==='string'&&it.str.trim());
  const rows=[];
  items.forEach(it=>{
    const y=it.transform[5],x=it.transform[4];
    let row=rows.find(r=>Math.abs(r.y-y)<=3);
    if(!row){row={y,parts:[]};rows.push(row);}
    row.parts.push({x,s:it.str});
  });
  rows.sort((a,b)=>b.y-a.y);
  return rows.map(r=>r.parts.sort((a,b)=>a.x-b.x).map(p=>p.s).join('  ')).join('\n');
}
async function nfStOcrCanvas(canvas,state){
  if(!window.Tesseract)await nfStLoadScript('https://cdn.jsdelivr.net/npm/tesseract.js@4.1.4/dist/tesseract.min.js',()=>!!window.Tesseract);
  if(!state.worker){
    state.worker=await window.Tesseract.createWorker({workerPath:'/tesseract-worker.min.js',workerBlobURL:false});
    await state.worker.loadLanguage('eng');
    await state.worker.initialize('eng');
    await state.worker.setParameters({preserve_interword_spaces:'1'});
  }
  const out=await state.worker.recognize(canvas);
  return out&&out.data&&out.data.text||'';
}
async function nfReadStatementPdf(file,onProgress){
  const pdfjs=await nfStLoadPdfJs();
  const data=new Uint8Array(await file.arrayBuffer());
  const doc=await pdfjs.getDocument({data,isEvalSupported:false}).promise;
  const texts=[];const state={};let scanned=0;
  try{
    for(let p=1;p<=doc.numPages;p++){
      onProgress&&onProgress('Reading page '+p+' of '+doc.numPages+'\u2026');
      const page=await doc.getPage(p);
      let text=nfStPageText(await page.getTextContent());
      if(text.replace(/\s/g,'').length<40){
        // Page scannee : on la dessine et on la lit comme une photo de recu.
        scanned++;
        onProgress&&onProgress('Reading scanned page '+p+' of '+doc.numPages+'\u2026');
        const viewport=page.getViewport({scale:2.4});
        const canvas=document.createElement('canvas');
        canvas.width=Math.round(viewport.width);canvas.height=Math.round(viewport.height);
        const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
        await page.render({canvasContext:ctx,viewport}).promise;
        text=await nfStOcrCanvas(canvas,state);
      }
      texts.push(text);
    }
  }finally{
    if(state.worker)state.worker.terminate().catch(()=>{});
  }
  const parsed=nfParseStatementText(texts.join('\n'));
  if(scanned&&parsed.totalsOk!==true)parsed.info=(parsed.info?parsed.info+' \u00b7 ':'')+'scanned, check the amounts';
  return parsed;
}
async function nfReadStatementFile(file,onProgress){
  if(/\.pdf$/i.test(file.name||'')||file.type==='application/pdf')return nfReadStatementPdf(file,onProgress);
  const buf=await file.arrayBuffer();
  let text=new TextDecoder('utf-8').decode(buf);
  if(text.indexOf('\ufffd')>=0){try{text=new TextDecoder('windows-1252').decode(buf);}catch(_e){}}
  return nfParseStatement(text);
}
`;

  if(typeof module!=='undefined'&&module.exports){module.exports={CORE};}
  if(typeof window==='undefined')return;

  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_STATEMENT_V1')) return html;
    const rep = (label, target, replacement) => {
      if(!html.includes(target)) throw new Error('statement: cible introuvable ('+label+')');
      html = html.replace(target, replacement);
    };

    // 1. Les fonctions, avant l'ancien parseur.
    rep('core', '/* UBS PARSER */', CORE + '\n/* UBS PARSER */');

    // 2. Rapprochement sur toute la periode du releve, pas seulement le mois
    //    affiche. Un releve Swisscard va du 15 au 14 : importe en octobre, il
    //    rapproche aussi les frais du 15 au 30 septembre. Les frais hors de
    //    la periode du releve gardent leur etat (un releve precedent les a
    //    peut-etre deja rapproches). Pour l'employe, un mois soumis est clos
    //    (le serveur refuse) : ses frais ne sont pas touches, ses lignes ne
    //    sont pas proposees « sans recu ». Les frais en devise prennent le
    //    montant reellement debite.
    rep('handle rows', "const mr=rows.filter(r=>r.date.startsWith(month));",
      "const nfFin=window.notesFraisRole==='finance';const nfShift=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};const mr=rows.filter(r=>r.date);const nfDs=mr.map(r=>r.date).sort();const nfFrom=nfDs.length?nfShift(nfDs[0],-4):month+'-01';const nfTo=nfDs.length?nfShift(nfDs[nfDs.length-1],4):lastDayOfMonth(month);const nfClosed=new Set(nfFin?[]:expenses.filter(e=>e.submissionStatus==='submitted'&&e.reviewStatus!=='to_fix').map(e=>String(e.date).slice(0,7)));const nfInScope=e=>!!e.date&&e.date>=nfFrom&&e.date<=nfTo&&(nfFin||e.submissionStatus!=='submitted'||e.reviewStatus==='to_fix');let nfFail=0;");
    rep('handle scope', "const monthExpenses=expenses.filter(e=>e.date?.startsWith(month));\n    const otherExpenses=expenses.filter(e=>!e.date?.startsWith(month));",
      "const monthExpenses=expenses.filter(nfInScope);\n    const otherExpenses=expenses.filter(e=>!nfInScope(e));");
    rep('handle reconcile', "const{expenses:recMonth,forgotten:forg}=reconcile(resetMonthExpenses,mr);",
      "const{expenses:recMonth,forgotten:forgAll}=nfReconcile(resetMonthExpenses,mr);const forg=forgAll.filter(r=>!nfClosed.has(String(r.date).slice(0,7)));");
    rep('handle save', "await Promise.all(changed.map(e=>updateStatus(e.id,e.status,e.ubsRow?.label||'',e.ubsRow?.date||null,e.amtDiff||0)));",
      "await Promise.all(changed.map(e=>updateStatus(e.id,e.status,e.ubsRow?.label||'',e.ubsRow?.date||null,e.amtDiff||0).catch(()=>{nfFail++;})));\n    await Promise.all(recMonth.filter(e=>e.nfCardChf&&Math.abs(e.nfCardChf-Number(e.amountCHF||0))>0.004).map(async e=>{try{const{data}=await sb.from('expenses').update({amount_chf:e.nfCardChf,fx_source:'card',ubs_date:e.ubsRow?.date||null}).eq('id',e.id);const row=Array.isArray(data)?data[0]:data;if(row){e.amountCHF=parseFloat(row.amount_chf);e.fxRate=row.fx_rate==null?null:parseFloat(row.fx_rate);e.fxSource=row.fx_source||'card';}}catch(_x){}}));");
    rep('handle notify', "notify('\u2705 UBS statement imported');", "notify(nfFail?'\u26a0\ufe0f Statement read, but '+nfFail+' expense'+(nfFail>1?'s':'')+' could not be updated. Try again.':'\u2705 Statement imported \u00b7 '+recMonth.filter(e=>e.status==='reconciled').length+' of '+recMonth.length+' matched');");

    // 3. « Link » : rattacher une ligne au frais propose.
    rep('link', "const addForgotten=useCallback(", "const nfLinkForgotten=useCallback(async(f)=>{const c=f&&f.candidate;if(!c)return;const exp=expenses.find(x=>x.id===c.id);if(!exp)return;const charged=Math.abs(f.amount);const foreign=exp.currency&&exp.currency!=='CHF';const diff=foreign?0:(Math.abs(Number(exp.amountCHF||exp.amount)-charged)>0.005?charged-Number(exp.amountCHF||exp.amount):0);try{await updateStatus(exp.id,'reconciled',f.label,f.date,diff);let patch={status:'reconciled',ubsRow:f,amtDiff:diff};if(foreign){const{data}=await sb.from('expenses').update({amount_chf:charged,fx_source:'card',ubs_date:f.date}).eq('id',exp.id);const row=Array.isArray(data)?data[0]:data;if(row)patch={...patch,amountCHF:parseFloat(row.amount_chf),fxRate:row.fx_rate==null?null:parseFloat(row.fx_rate),fxSource:row.fx_source};}setExpenses(prev=>prev.map(x=>x.id===exp.id?{...x,...patch}:x));setForgotten(p=>p.filter(x=>x!==f));notify('\u2705 Linked to '+exp.merchant);}catch(e){notify('\u274c '+(e.message||e));}},[expenses]);\n  const addForgotten=useCallback(");
    rep('link button', "<button onClick={()=>addForgotten(f)} style={{...bS,padding:'6px 12px',fontSize:12,color:'var(--red)',borderColor:'#F09595'}}>+ Create</button>",
      "{f.candidate&&<button data-nf-link onClick={()=>nfLinkForgotten(f)} style={{...bS,padding:'6px 12px',fontSize:12,color:'#0F5E92',borderColor:'#9CC3E0',background:'#fff'}}>Link</button>}<button onClick={()=>addForgotten(f)} style={{...bS,padding:'6px 12px',fontSize:12,color:'var(--red)',borderColor:'#F09595'}}>+ Create</button>");
    rep('link hint', "<div style={{fontSize:11,color:'#A32D2D',marginTop:2}}>{fd(f.date)}</div></div>",
      "<div style={{fontSize:11,color:'#A32D2D',marginTop:2}}>{fd(f.date)}{f.card?' \\u00b7 '+f.card:''}{f.orig&&f.orig.currency!=='CHF'?' \\u00b7 '+f.orig.currency+' '+fmt(f.orig.amount):''}</div>{f.candidate&&<div data-nf-candidate style={{fontSize:12,color:'#0F5E92',marginTop:4}}>{'Looks like '+f.candidate.merchant+' \\u00b7 '+fd(f.candidate.date)+' \\u00b7 CHF '+fmt(f.candidate.amount)}</div>}</div>");

    // 4. La fenetre d'import : PDF Swisscard ou CSV.
    rep('modal state', "  const [drag,setDrag]=useState(false);\n  const fRef=useRef();\n  const process=text=>{setError(null);try{const r=parseUBS(text);if(r.rows.length===0){setError('No transaction found in this file.');return;}setParsed(r);setStep('preview');}catch(e){setError('Erreur: '+e.message);}};\n  const hFile=f=>{const r=new FileReader();r.onload=e=>process(e.target.result);r.readAsText(f,'UTF-8');};",
      "  const [drag,setDrag]=useState(false);\n  const [nfBusy,setNfBusy]=useState('');\n  const fRef=useRef();\n  const nfNone='No transaction found in this file. NotesFrais reads the Swisscard statement (PDF, even scanned) and CSV exports from UBS e-banking.';\n  const nfShow=r=>{if(!r||!r.rows||r.rows.length===0){setError(nfNone);return;}setParsed(r);setStep('preview');};\n  const process=text=>{setError(null);try{nfShow(nfParseStatement(text));}catch(e){setError('Error: '+e.message);}};\n  const hFile=async f=>{setError(null);setNfBusy('Reading '+(f.name||'the file')+'\\u2026');try{nfShow(await nfReadStatementFile(f,setNfBusy));}catch(e){setError('Could not read this file: '+(e&&e.message||e));}finally{setNfBusy('');}};");
    rep('modal kicker', "<div style={{fontSize:11,color:'var(--t3)',letterSpacing:'0.08em',marginBottom:2}}>UBS SWITZERLAND AG</div>",
      "<div style={{fontSize:11,color:'var(--t3)',letterSpacing:'0.08em',marginBottom:2}}>CARD OR BANK STATEMENT</div>");
    rep('modal accept', '<input ref={fRef} type="file" accept=".csv,.txt" style={{display:\'none\'}}',
      '<input ref={fRef} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv" style={{display:\'none\'}}');
    rep('modal drop', "<div style={{fontWeight:500,fontSize:14,marginBottom:4}}>Drop your UBS CSV here</div>\n            <div style={{fontSize:12,color:'var(--t3)'}}>or click to browse</div>",
      "<div style={{fontWeight:500,fontSize:14,marginBottom:4}}>{nfBusy||'Drop your statement here'}</div>\n            <div style={{fontSize:12,color:'var(--t3)'}}>{nfBusy?'A scanned PDF takes about 10 seconds a page':'Swisscard PDF or UBS CSV \\u00b7 tap to browse'}</div>");
    rep('modal help', "<div style={{fontWeight:500,color:'var(--accent)',marginBottom:8}}>Export from UBS e-banking</div>\n            {['E-banking \u2192 Accounts & cards','Select your card','Transactions \u2192 Export \u2192 CSV','Download the .csv']",
      "<div style={{fontWeight:500,color:'var(--accent)',marginBottom:8}}>Which file?</div>\n            {['Swisscard: the monthly statement PDF, or a scan or photo-PDF of the paper one','UBS e-banking: Accounts & cards \u2192 Transactions \u2192 Export \u2192 CSV','Payments in USD or EUR are matched on their original amount']");
    // Les donnees de demo ne servent qu'a la finance : un toucher par erreur
    // melangeait des frais fictifs a ceux de Mike.
    rep('modal demo', "<button onClick={()=>process(UBS_DEMO)} style={{...bP,justifyContent:'center'}}>\u{1F9EA} Demo data</button>",
      "{window.notesFraisRole==='finance'?<button onClick={()=>process(UBS_DEMO)} style={{...bP,justifyContent:'center'}}>\u{1F9EA} Demo data</button>:null}");
    rep('modal preview row', "<div style={{color:'var(--t3)',fontSize:11,marginTop:2}}>{fd(r.date)}</div></div><div style={{fontFamily:'DM Mono',fontWeight:600,color:'var(--red)',whiteSpace:'nowrap'}}>CHF {fmt(Math.abs(r.amount))}</div>",
      "<div style={{color:'var(--t3)',fontSize:11,marginTop:2}}>{fd(r.date)}{r.card?' \\u00b7 '+r.card:''}</div></div><div style={{fontFamily:'DM Mono',fontWeight:600,color:'var(--red)',whiteSpace:'nowrap',textAlign:'right'}}>CHF {fmt(Math.abs(r.amount))}{r.orig&&r.orig.currency!=='CHF'&&<div style={{fontSize:11,color:'var(--t3)',fontWeight:500}}>{r.orig.currency+' '+fmt(r.orig.amount)}</div>}</div>");
    rep('modal preview count', "{exp.slice(0,20).map((r,i)=>", "{exp.slice(0,60).map((r,i)=>");
    rep('modal preview count 2', "borderBottom:i<exp.slice(0,20).length-1?", "borderBottom:i<exp.slice(0,60).length-1?");
    return html;
  };
})();
