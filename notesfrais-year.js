(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_YEAR_V1')) return html;

    // L'application etait cablee sur 2026 : MONTHS etait une liste litterale
    // des douze mois de 2026, et le mois par defaut retombait sur 2026-03 hors
    // de cette liste. Au 1er janvier 2027, l'app se serait figee sur mars 2026.
    //
    // MONTHS devient les douze mois de l'ANNEE ACTIVE : l'annee en cours par
    // defaut, ou une annee anterieure choisie dans les selecteurs. En janvier,
    // Mike doit encore soumettre decembre : il faut donc pouvoir revenir en
    // arriere, pas seulement suivre le calendrier.
    //
    // Changer d'annee recharge la page. MONTHS est une constante de module lue
    // partout (chargement des 12 mois, selecteurs, stats, dashboard finance) :
    // la recalculer a chaud imposerait de reecrire chacun de ces appelants.
    // Le choix vit en sessionStorage pour qu'une nouvelle ouverture de l'app
    // revienne d'elle-meme sur l'annee en cours.
    //
    // Charge en DERNIER, apres les traductions : les chaines ci-dessous sont
    // ecrites directement en anglais et les cibles sont du code deja traduit.

    const must = (needle, what) => {
      if(!html.includes(needle)) throw new Error('year: cible introuvable (' + what + ')');
    };
    const swap = (needle, replacement, what) => {
      must(needle, what);
      html = html.split(needle).join(replacement);
    };

    // 1. MONTHS calcule depuis l'annee active.
    const monthsRe = /const MONTHS=\[\{v:'2026-01'[^\n]*?\{v:'2026-12',l:'[^']*'\}\];/;
    if(!monthsRe.test(html)) throw new Error('year: cible introuvable (MONTHS)');
    html = html.replace(monthsRe, String.raw`const NOTESFRAIS_YEAR_V1=true;
const NOTESFRAIS_FIRST_YEAR=2026;
const NOTESFRAIS_YEAR_KEY='notesfrais-year-v1';
const NOTESFRAIS_YEAR_CHOICE=(()=>{
  try{const raw=JSON.parse(sessionStorage.getItem(NOTESFRAIS_YEAR_KEY)||'null');return raw&&typeof raw==='object'?raw:null;}catch(_e){return null;}
})();
const NOTESFRAIS_THIS_YEAR=Math.max(new Date().getFullYear(),NOTESFRAIS_FIRST_YEAR);
const NOTESFRAIS_YEAR=(()=>{
  const y=Number(NOTESFRAIS_YEAR_CHOICE&&NOTESFRAIS_YEAR_CHOICE.year);
  return Number.isInteger(y)&&y>=NOTESFRAIS_FIRST_YEAR&&y<=NOTESFRAIS_THIS_YEAR?y:NOTESFRAIS_THIS_YEAR;
})();
const NOTESFRAIS_YEARS=Array.from({length:NOTESFRAIS_THIS_YEAR-NOTESFRAIS_FIRST_YEAR+1},(_,i)=>NOTESFRAIS_THIS_YEAR-i);
const NOTESFRAIS_OTHER_YEARS=NOTESFRAIS_YEARS.filter(y=>y!==NOTESFRAIS_YEAR);
const NOTESFRAIS_START_MODE=NOTESFRAIS_YEAR_CHOICE&&NOTESFRAIS_YEAR_CHOICE.mode==='year'?'year':'month';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'].map((name,i)=>({v:NOTESFRAIS_YEAR+'-'+String(i+1).padStart(2,'0'),l:name+' '+NOTESFRAIS_YEAR}));
function nfSwitchYear(value,mode){
  const m=/^nfyear:(\d{4})$/.exec(String(value||''));
  if(!m)return false;
  const year=Number(m[1]);
  if(year===NOTESFRAIS_YEAR)return true;
  try{
    if(year===NOTESFRAIS_THIS_YEAR&&mode!=='year')sessionStorage.removeItem(NOTESFRAIS_YEAR_KEY);
    else sessionStorage.setItem(NOTESFRAIS_YEAR_KEY,JSON.stringify({year,mode:mode==='year'?'year':'month'}));
  }catch(_e){}
  window.location.reload();
  return true;
}
function nfOtherYearOptions(){
  if(NOTESFRAIS_OTHER_YEARS.length===0)return null;
  return <optgroup label="Other years">{NOTESFRAIS_OTHER_YEARS.map(y=><option key={y} value={'nfyear:'+y}>{String(y)}</option>)}</optgroup>;
}
function nfYearPicker(style,count){
  const label='Year '+NOTESFRAIS_YEAR+' · '+count+' expenses';
  if(NOTESFRAIS_OTHER_YEARS.length===0)return <div style={style}>{label}</div>;
  return <select data-nf-year-picker="true" value={'nfyear:'+NOTESFRAIS_YEAR} onChange={e=>nfSwitchYear(e.target.value,'year')} style={style}>{NOTESFRAIS_YEARS.map(y=><option key={y} value={'nfyear:'+y}>{y===NOTESFRAIS_YEAR?label:'Year '+y}</option>)}</select>;
}`);

    // 2. Mois par defaut : le mois courant s'il est dans l'annee active, sinon
    //    decembre d'une annee passee (le mois qu'on vient y soumettre).
    swap(
      "return MONTHS.some(m=>m.v===current)?current:'2026-03';",
      "return MONTHS.some(m=>m.v===current)?current:(NOTESFRAIS_YEAR<now.getFullYear()?MONTHS[11].v:MONTHS[0].v);",
      'mois par defaut'
    );

    // 3. Apres un changement d'annee en mode « Full year », on y revient.
    swap(
      "const [periodMode,setPeriodMode]=useState('month');",
      "const [periodMode,setPeriodMode]=useState(NOTESFRAIS_START_MODE);",
      'mode de periode initial'
    );

    // 4. Selecteur de periode utilisateur (PeriodInsideTabs).
    swap(
      "{periodMode==='month'&&<select value={month} onChange={e=>{setMonth(e.target.value);setPeriodFrom(e.target.value);setPeriodTo(e.target.value);}} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}{monthCounts&&monthCounts[m.v]?' ('+monthCounts[m.v]+')':''}</option>)}</select>}",
      "{periodMode==='month'&&<select value={month} onChange={e=>{if(nfSwitchYear(e.target.value,'month'))return;setMonth(e.target.value);setPeriodFrom(e.target.value);setPeriodTo(e.target.value);}} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}{monthCounts&&monthCounts[m.v]?' ('+monthCounts[m.v]+')':''}</option>)}{nfOtherYearOptions()}</select>}",
      'mois de PeriodInsideTabs'
    );
    swap(
      "{periodMode==='year'&&<div style={{...selectStyle,color:'var(--accent)',fontWeight:800}}>Year 2026 · {Object.values(monthCounts||{}).reduce((s,n)=>s+Number(n||0),0)} expenses</div>}",
      "{periodMode==='year'&&nfYearPicker({...selectStyle,color:'var(--accent)',fontWeight:800},Object.values(monthCounts||{}).reduce((s,n)=>s+Number(n||0),0))}",
      'annee de PeriodInsideTabs'
    );
    swap("if(mode==='year')return 'Year 2026';", "if(mode==='year')return 'Year '+NOTESFRAIS_YEAR;", 'libelle de periode');

    // 5. Selecteur de periode finance (FinanceMonthPicker).
    swap(
      "<select value={month} onChange={e=>chooseMonth(e.target.value)} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}{monthCounts&&monthCounts[m.v]?' - '+monthCounts[m.v]+' expenses':''}</option>)}</select>",
      "<select value={month} onChange={e=>{if(nfSwitchYear(e.target.value,'month'))return;chooseMonth(e.target.value);}} style={selectStyle}>{MONTHS.map(m=><option key={m.v} value={m.v}>{m.l}{monthCounts&&monthCounts[m.v]?' - '+monthCounts[m.v]+' expenses':''}</option>)}{nfOtherYearOptions()}</select>",
      'mois de FinanceMonthPicker'
    );
    swap(
      "{mode==='year'&&<div style={{...selectStyle,color:'var(--accent)',fontWeight:900,display:'flex',alignItems:'center'}}>Full year 2026 - {totalYear} expenses</div>}",
      "{mode==='year'&&nfYearPicker({...selectStyle,color:'var(--accent)',fontWeight:900},totalYear)}",
      'annee de FinanceMonthPicker'
    );

    // 6. Onglet Stats.
    swap("const title=scope==='year'?'Year 2026':", "const title=scope==='year'?'Year '+NOTESFRAIS_YEAR:", 'titre des stats');
    swap('<option value="year">Full year 2026</option>', '<option value="year">{\'Full year \'+NOTESFRAIS_YEAR}</option>', 'option annee des stats');
    swap("{m.l.replace(' 2026','')}", "{m.l.replace(' '+NOTESFRAIS_YEAR,'')}", 'mois des stats');

    // 7. Script DOM de delight.js : il repere le titre du mois par son annee.
    //    Hors du script Babel, il ne voit pas NOTESFRAIS_YEAR.
    swap(".find(x=>/2026/.test(x.textContent||''))", ".find(x=>/\\b20\\d\\d\\b/.test(x.textContent||''))", 'titre du mois de delight');

    return html;
  };
})();
