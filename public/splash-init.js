// Decide, before the first paint, what this load shows in place of the opening
// splash. The keys and the <html> classes are APP_SPLASH_SKIP, APP_BOOT_FRAME and
// APP_SPLASH_STATIC in src/lib/app-splash.ts; index.html's rules read the classes.
//
// 1. The load right after a sign-out: no splash, and the app at once, so the page
//    being left stays on screen until the login screen paints. forceLogout()
//    writes the key (skipSplashOnNextLoad in src/shared/auth/service.ts). One load
//    only: the key goes as it is read.
// 2. The OAuth hand-off (/callback/<provider>): the provider has just sent the
//    visitor back mid sign-in. The splash stays, at rest from its first frame — a
//    hand-off screen, not an opening with a wordmark to wait for.
// 3. No session hint (this browser never signed in, or signed out): the visit ends
//    on the login screen, so it opens on it — no splash, and the frame that screen
//    sits in paints first. The key is the one markSessionStart() writes
//    (src/shared/auth/session-lifetime.ts); index.html names it. A hint only picks
//    what to paint — it never authorizes anything. Offline, the splash stays: it is
//    where the boot says it cannot reach the server, and offers Retry.
// Its own scope: nothing it names leaks onto `window`.
(function () {
  try {
    var root = document.documentElement;
    if (sessionStorage.getItem('app-splash-skip') === '1') {
      sessionStorage.removeItem('app-splash-skip');
      root.classList.add('app-splash-skip');
    } else if (location.pathname.indexOf('/callback/') === 0) {
      root.classList.add('app-splash-static');
    } else {
      var hintKey = root.getAttribute('data-session-hint-key');
      if (hintKey && navigator.onLine !== false && localStorage.getItem(hintKey) === null) {
        root.classList.add('app-splash-skip', 'app-boot-frame');
      }
    }
  } catch (e) {}
})();
