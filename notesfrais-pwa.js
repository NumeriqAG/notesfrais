(function(){
  const basePatch=window.patchNotesFrais;
  window.patchNotesFrais=function(html){
    html=basePatch?basePatch(html):html;
    if(!html.includes('manifest.webmanifest')){
      const pwaHead='<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" href="/icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/icon.svg"><meta name="theme-color" content="#1A3FB5"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="NotesFrais"><meta name="apple-mobile-web-app-status-bar-style" content="default">';
      html=html.replace('</head>',pwaHead+'</head>');
    }
    if(!html.includes('serviceWorker.register')){
      const register='<script>(function(){if(\'serviceWorker\' in navigator){window.addEventListener(\'load\',function(){navigator.serviceWorker.register(\'/sw.js\').catch(function(){});});}})();</scr'+'ipt>';
      html=html.replace('</body>',register+'</body>');
    }
    return html;
  };
})();
