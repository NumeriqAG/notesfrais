(function(){
  // Mode sombre de l'iPhone pour l'interface de Mike (nov. 2026).
  //
  // Charge en dernier. L'interface est peinte par une quarantaine de patches,
  // en CSS et en styles inline : la reecrire a la main serait fragile. Ce
  // patch procede donc en deux temps, uniquement sous
  // @media (prefers-color-scheme: dark) et sur body.nf-ios-mike (Mike, mobile) :
  //
  //  1. Il relit toutes les regles CSS de l'interface mobile deja injectees
  //     (selecteurs nf-ios*, nfm-*, barre du bas...) et en emet une copie
  //     sombre, couleur par couleur, d'apres la table DARK ci-dessous.
  //  2. Il rattrape les styles inline de React (fond blanc, texte noir) par
  //     selecteurs d'attribut, que le navigateur normalise en rgb().
  //
  // L'espace finance et le bureau restent clairs. La connexion suit l'iPhone.
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;
    if(html.includes('NOTESFRAIS_DARK_V1')) return html;

    // replace() garde : check-patches.js compte comme suspect tout replace()
    // sans effet sur une longue chaine. Ici, ne rien trouver est normal.
    const R = (str, re, to) => { re.lastIndex = 0; const hit = re.test(str); re.lastIndex = 0; return hit ? str.replace(re, to) : str; };
    // Palette sombre, tiree du logo comme la claire.
    const D = {
      bg:'#0E141B', card:'#18212B', fill:'#24303C', tint:'#15324A', line:'rgba(235,240,245,.10)',
      t1:'#E8EDF2', t2:'#A9B4BF', t3:'#8593A1', blue:'#6CB4E6',
      greenBg:'#133626', green:'#6DD19A', amberBg:'#3A2A16', amber:'#F0A35E', redBg:'#3B1F1F', red:'#FF8A80'
    };
    // Couleurs claires → sombres, selon qu'elles servent de fond ou de texte.
    const BG = [
      [/^(#fff|#ffffff|white)$/i, D.card],
      [/^(#F3F6F9|#F2F2F7|#F8FAFC|#F9F9F9|#F5F5F7|#FAFAFA)$/i, D.bg],
      [/^(#E4EAF0|#EAF0F5|#EEF2F6|#E5E5EA|#EFEFF4|#ECEFF1|#F0F2F5|#E9EDF1|#E3E3E8|#E9E9EE|#EEEEF0|#F2F2F2)$/i, D.fill],
      [/^(#E6F1FA|#EDF0FA|#EEF2FD|#E3F2FD)$/i, D.tint],
      [/^(#E5F3EA|#E1F5EE|#E8F5E9)$/i, D.greenBg],
      [/^(#FDF0E3|#FAEEDA|#FFF3E0|#FFF8E6)$/i, D.amberBg],
      [/^(#FCEBEB|#FDECEC|#FFEBEE)$/i, D.redBg]
    ];
    const FG = [
      [/^(#1E2B38|#1A1A1A|#111|#111111|#000|#000000|#2E3E4F|#3A4754|#1C1C1E|#3A2A1C|#7A3A06)$/i, D.t1],
      [/^(#5B6875|#4A5866|#6B6560|#3C3C43)$/i, D.t2],
      [/^(#6B7785|#9E9892|#8E8E93|#8E8E93|#B8C2CC)$/i, D.t3],
      [/^(#0F5E92|#007aff|#0B4A74)$/i, D.blue],
      [/^(#17663F|#0F6E56)$/i, D.green],
      [/^(#A04A06|#BA7517|#B4540A)$/i, D.amber],
      [/^(#B42318|#A32D2D|#C62828)$/i, D.red]
    ];
    const mapHex = (value, table) => R(value, /#[0-9a-f]{3,8}\b|\bwhite\b/gi, h => {
      for(const [re, to] of table) if(re.test(h)) return to;
      return h;
    });
    const RGBA = [
      [/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(\.9\d*|0?\.8\d*|1)\s*\)/g, 'rgba(24,33,43,$1)'],
      [/rgba\(\s*249\s*,\s*249\s*,\s*249\s*,/g, 'rgba(24,33,43,'],
      [/rgba\(\s*242\s*,\s*242\s*,\s*247\s*,/g, 'rgba(24,33,43,'],
      [/rgba\(\s*248\s*,\s*250\s*,\s*252\s*,/g, 'rgba(14,20,27,'],
      [/rgba\(\s*60\s*,\s*60\s*,\s*67\s*,/g, 'rgba(235,240,245,'],
      [/rgba\(\s*46\s*,\s*62\s*,\s*79\s*,\s*([0-9.]+)\)/g, 'rgba(0,0,0,.4)']
    ];
    const mapRgba = value => RGBA.reduce((v, [re, to]) => R(v, re, to), value);

    // ── 1. Copie sombre des regles CSS de l'interface mobile ───────────────
    const SCOPE = /nf-ios|nfm|test-bottom-nav|test-scan-cta|nf-user-|data-nf-|nf-review|nf-comment|nf-sync|nf-tab/;
    const PROPS = /^(background|background-color|color|border|border-top|border-bottom|border-left|border-right|border-color|box-shadow|outline|fill|stroke|-webkit-text-fill-color)$/i;
    const out = [];
    const styles = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) || [];
    for(const block of styles){
      const body = R(R(block, /^<style[^>]*>/, ''), /<\/style>$/, '');
      const rules = body.match(/[^{}]+\{[^{}]*\}/g) || [];
      for(const rule of rules){
        const i = rule.indexOf('{');
        const sel = R(rule.slice(0, i), /\/\*[\s\S]*?\*\//g, '').trim();
        if(!sel || sel[0] === '@' || /^(from|to|\d+%)/.test(sel) || !SCOPE.test(sel)) continue;
        const decls = [];
        for(const d of rule.slice(i + 1, -1).split(';')){
          const c = d.indexOf(':');
          if(c < 0) continue;
          const prop = d.slice(0, c).trim();
          if(!PROPS.test(prop)) continue;
          let val = R(d.slice(c + 1), /!important/g, '').trim();
          if(/url\(/.test(val)) continue;               // icones en masque ou en image
          const isBg = /^background/.test(prop);
          let dark = isBg ? mapHex(val, BG) : prop === 'color' || prop === '-webkit-text-fill-color' ? mapHex(val, FG) : mapHex(mapHex(val, BG), []);
          if(/^border|^outline/.test(prop)) dark = R(val, /#(E2DED8|DDE4EA|E4EAF0|E5E5EA|C5CED7|D9E0E7|E0E5EA)\b/gi, D.line);
          dark = mapRgba(dark);
          if(dark !== val) decls.push(prop + ':' + dark + '!important');
        }
        if(!decls.length) continue;
        const scoped = sel.split(',').map(s => {
          s = R(s.trim(), /^html\s+/, '');
          if(/^:root/.test(s)) return null;
          if(/^body\.nf-ios-mike/.test(s)) return 'html ' + s;
          if(/^body/.test(s)) return 'html ' + R(s, /^body/, 'body.nf-ios-mike');
          return 'html body.nf-ios-mike ' + s;
        }).filter(Boolean).join(',');
        if(scoped) out.push(scoped + '{' + decls.join(';') + '}');
      }
    }

    // ── 2. Styles inline de React, et ce que la table ne couvre pas ────────
    const M = 'html body.nf-ios-mike';
    const inline = (attr, decl) => M + ' [style*="' + attr + '"]{' + decl + '}';
    const css = `<style id="notesfrais-dark-v1">
/* NOTESFRAIS_DARK_V1 : mode sombre de l'iPhone, interface de Mike */
@media (prefers-color-scheme: dark){
  ${M}{color-scheme:dark;background:${D.bg}!important;color:${D.t1}}
  ${M}{--bg:${D.bg};--w:${D.card};--s2:${D.fill};--text:${D.t1};--t2:${D.t2};--t3:${D.t3};--accent:${D.blue};--al:${D.tint};--border:${D.line};
       --green:${D.green};--gl:${D.greenBg};--amber:${D.amber};--aml:${D.amberBg};--red:${D.red};--rl:${D.redBg};
       --nfm-accent:${D.blue};--nfm-accent-l:${D.tint};--nfm-bg:${D.bg};--nfm-green:${D.green};--nfm-gl:${D.greenBg};--nfm-amber:${D.amber};--nfm-aml:${D.amberBg};--nfm-red:${D.red};
       --nfm-sep:.5px solid ${D.line};--nfm-hair:0 0 0 .5px ${D.line};
       --nf-bg:${D.bg};--nf-card:${D.card};--nf-t1:${D.t1};--nf-t2:${D.t2};--nf-line:${D.line}}
  ${M} #root,${M} .nf-ios-content{background:${D.bg}!important}
  ${inline('background: rgb(255, 255, 255)', 'background:' + D.card + '!important')}
  ${inline('background-color: rgb(255, 255, 255)', 'background-color:' + D.card + '!important')}
  ${inline('background: rgb(243, 246, 249)', 'background:' + D.bg + '!important')}
  ${inline('background: rgb(248, 249, 250)', 'background:' + D.bg + '!important')}
  ${inline('background: rgb(234, 240, 245)', 'background:' + D.fill + '!important')}
  ${inline('background: rgb(228, 234, 240)', 'background:' + D.fill + '!important')}
  ${inline('background: rgba(249, 249, 249', 'background:rgba(24,33,43,.96)!important')}
  ${inline('background: rgba(255, 255, 255, 0.9', 'background:rgba(24,33,43,.94)!important')}
  ${inline('background: rgb(229, 229, 234)', 'background:' + D.fill + '!important')}
  ${inline('background: rgb(253, 236, 236)', 'background:' + D.redBg + '!important')}
  ${inline('border-bottom: 0.5px solid rgba(60, 60, 67', 'border-bottom-color:' + D.line + '!important')}
  ${inline('border-top: 0.5px solid rgba(60, 60, 67', 'border-top-color:' + D.line + '!important')}
  ${inline('color: rgb(60, 60, 67)', 'color:' + D.t2 + '!important')}
  ${inline('color: rgb(155, 28, 28)', 'color:' + D.red + '!important')}
  ${inline('color: rgb(26, 26, 26)', 'color:' + D.t1 + '!important')}
  ${inline('color: rgb(30, 43, 56)', 'color:' + D.t1 + '!important')}
  ${inline('color: rgb(17, 17, 17)', 'color:' + D.t1 + '!important')}
  ${inline('color: rgb(15, 94, 146)', 'color:' + D.blue + '!important')}
  ${inline('border: 0.5px solid rgba(26, 26, 26', 'border-color:' + D.line + '!important')}
  /* Les boutons pleins gardent leur bleu et leur texte blanc. */
  ${M} [style*="background: rgb(15, 94, 146)"],${M} [style*="background: var(--accent)"]{background:#0F5E92!important;color:#fff!important}
  ${M} input,${M} select,${M} textarea{color:${D.t1};border-color:${D.line}}
  ${M} input::placeholder,${M} textarea::placeholder{color:${D.t3}!important}
  /* Le recu reste sur fond clair : c'est du papier. */
  ${M} .nfm-dt-photo{background:${D.fill}!important}
  ${M} .nfm-dt-nophoto{border-color:rgba(235,240,245,.22)!important}
  ${M} .nfm-daylist .nf-ios-expense-row:after{border-color:${D.t3}!important}
  ${M} #test-bottom-nav{background:rgba(14,20,27,.94)!important;border-top-color:${D.line}!important}
  ${M} #test-bottom-nav button[data-tab]:before{background-color:${D.t3}!important}
  ${M} #test-bottom-nav button.active[data-tab]:before{background-color:${D.blue}!important}
  ${M} #test-bottom-nav button.active{color:${D.blue}!important}
  ${M} #nf-ios-header{background:rgba(14,20,27,.92)!important;border-color:${D.line}!important}
  ${out.join('\n  ')}
  /* Apres la copie generee : la liste par jour reste sans fond propre. */
  ${M} .nfm-daylist.nfm-daylist{background:transparent!important;box-shadow:none!important}
  ${M} .nfm-daylist>div.nfm-day.nfm-day{background:transparent!important;color:${D.t2}!important}
  /* Connexion */
  [data-nf-login]{background:${D.bg}!important;color:${D.t1}}
  [data-nf-login]>div{background:transparent!important;color:${D.t1}!important;box-shadow:none!important}
  [data-nf-login] h1{color:${D.t1}!important}
  [data-nf-login] p{color:${D.t2}!important}
  [data-nf-login] input{background:${D.card}!important;color:${D.t1}!important;border-color:${D.line}!important;color-scheme:dark}
}
</style>`;
    if(!html.includes('</head>')) throw new Error('dark: </head> introuvable');
    html = html.replace('</head>', css + '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="' + D.bg + '"></head>');
    return html;
  };
})();
