// If the game didn't start, say why, plainly (a player on an old Mac found the market wouldn't
// buy). Old syntax on purpose: this has to run where the game can't. main.ts sets the flag as
// its last line, so a browser too old to read it, or one that stops partway, lands here.
window.addEventListener('load', function () {
  setTimeout(function () {
    if (window.__witchspaceStarted) return;
    var box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;left:16px;right:16px;top:30%;max-width:520px;margin:0 auto;padding:18px 20px;border:1px solid #3dffb0;border-radius:10px;background:#00140c;color:#d7fff0;font:16px/1.45 system-ui,sans-serif;z-index:99;text-align:left';
    box.innerHTML = '<p style="margin:0 0 8px;color:#3dffb0;font-weight:600">Your browser can’t fly this ship.</p>' +
      '<p style="margin:0 0 8px">Witchspace needs a browser from the last few years: Safari 14, Chrome 87, Firefox 78 or Edge 88, or newer. On an older Mac, Chrome or Firefox will usually still install.</p>' +
      '<p style="margin:0;color:#6fa894">Tell us what you’re using at hello@witchspace.org.uk and we’ll see what we can do.</p>';
    document.body.appendChild(box);
  }, 1500);
});
