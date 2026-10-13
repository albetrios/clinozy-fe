// Prevent theme FOUC: put the app's one look and the saved mode on <html>
// before React hydrates. Mirrors applyTheme() in shared/theme/presets.ts (the
// `data-theme` id) and useThemeStore's rehydrate (the `.dark` class).
//
// It writes no inline custom property. An inline token outranks both `:root`
// and `.dark`, so one left behind would pin its colour to the boot mode for the
// life of the document — the half-dark page a later mode switch used to leave.
// Every colour the splash paints comes from index.html's pre-paint fallbacks
// and the stylesheet's own blocks.
var root = document.documentElement;
root.dataset.theme = 'clinozy-zinc-pastel';
try {
  var raw = localStorage.getItem('theme-preference');
  var stored = raw ? JSON.parse(raw) : {};
  var theme = (stored.state || {}).theme;
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // No stored mode = the store's default, light (the design's default).
  var isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
} catch (e) {}
