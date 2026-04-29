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

    const pwaHead = '<link rel="manifest" href="' + manifest + '"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.svg"><meta name="theme-color" content="#1A3FB5"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="' + appTitle + '"><meta name="apple-mobile-web-app-status-bar-style" content="default">';

    if(html.includes('rel="manifest"')){
      html = html.replace(/<link rel="manifest" href="[^"]*">/, '<link rel="manifest" href="' + manifest + '">');
    }else{
      html = html.replace('</head>', pwaHead + '</head>');
    }

    if(!html.includes('serviceWorker.register')){
      const register = '<script>(function(){if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){});});}})();</scr' + 'ipt>';
      html = html.replace('</body>', register + '</body>');
    }
    return html;
  };
})();
