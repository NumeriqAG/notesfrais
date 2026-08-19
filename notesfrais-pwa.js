(function(){
  const basePatch = window.patchNotesFrais;
  window.patchNotesFrais = function(html){
    html = basePatch ? basePatch(html) : html;

    const channel = window.NOTESFRAIS_CHANNEL || 'main';
    const manifest = channel === 'test'
      ? '/manifest-test.webmanifest'
      : channel === 'mike'
        ? '/manifest-mike.webmanifest'
        : '/manifest.webmanifest';
    const appTitle = channel === 'test' ? 'NotesFrais Test' : 'NotesFrais';
    const swScript = channel === 'mike' ? '/mike-sw.js' : '/sw.js';
    const swScope = channel === 'mike' ? '/mike' : '/';

    const pwaHead = '<link rel="manifest" href="' + manifest + '"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.svg"><meta name="theme-color" content="#1A3FB5"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="' + appTitle + '"><meta name="apple-mobile-web-app-status-bar-style" content="default">';

    if(html.includes('rel="manifest"')){
      html = html.replace(/<link rel="manifest" href="[^"]*">/, '<link rel="manifest" href="' + manifest + '">');
    }else{
      html = html.replace('</head>', pwaHead + '</head>');
    }

    if(!html.includes('serviceWorker.register')){
      const register = '<script>(function(){if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(reg){if(reg.active&&reg.active.scriptURL&&reg.active.scriptURL.endsWith("/sw.js")&&"' + channel + '"!=="main"){reg.unregister().catch(function(){});}});}).finally(function(){navigator.serviceWorker.register("' + swScript + '",{scope:"' + swScope + '"}).catch(function(){});});});}})();</scr' + 'ipt>';
      html = html.replace('</body>', register + '</body>');
    }
    return html;
  };
})();
