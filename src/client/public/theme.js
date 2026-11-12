// Sets the theme before the page draws, so it never flashes the wrong colours.
// The choice ("system", "light" or "dark") is kept in this browser by Settings.
(function () {
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  function apply() {
    var choice = 'system';
    try { choice = localStorage.getItem('dirigo.theme') || 'system'; } catch { /* storage blocked */ }
    var dark = choice === 'dark' || (choice !== 'light' && media.matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
  apply();
  media.addEventListener('change', apply);
  window.addEventListener('storage', function (e) { if (e.key === 'dirigo.theme') apply(); });
  window.dirigoApplyTheme = apply;
})();
