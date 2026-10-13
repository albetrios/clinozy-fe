// Skip the boot splash on the load right after a sign-out: hide it and show the
// app before the first paint, so the page being left stays on screen until the
// login screen paints. Mirrors skipAppSplashOnNextLoad() and APP_SPLASH_SKIP in
// src/lib/app-splash.ts (the sessionStorage key and the <html> class), and
// index.html's `.app-splash-skip` rules. One load only: the key goes as it is read.
try {
  if (sessionStorage.getItem('app-splash-skip') === '1') {
    sessionStorage.removeItem('app-splash-skip');
    document.documentElement.classList.add('app-splash-skip');
  }
} catch (e) {}
