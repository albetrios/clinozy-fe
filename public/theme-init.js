// Prevent theme FOUC: apply mode + saved accent/radius before React hydrates.
// Mirrors useThemeStore onRehydrateStorage (light/dark + preset/custom primary).
try {
  var raw = localStorage.getItem('theme-preference');
  var stored = raw ? JSON.parse(raw) : {};
  var state = stored.state || {};
  var theme = state.theme;
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // No stored mode = the store's default, light (the design's default).
  var isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  var root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Named preset primaries — must match index.css [data-theme] blocks.
  var PRESET_PRIMARY = {
    'clinozy-zinc-pastel': {
      light: ['oklch(0.21 0.006 285.9)', 'oklch(0.985 0 0)'],
      dark: ['oklch(0.967 0.001 286.4)', 'oklch(0.165 0.004 285.9)'],
    },
    violet: {
      light: ['oklch(0.55 0.22 290)', 'oklch(0.985 0 0)'],
      dark: ['oklch(0.62 0.19 290)', 'oklch(0.985 0 0)'],
    },
    emerald: {
      light: ['oklch(0.6 0.14 162)', 'oklch(0.985 0 0)'],
      dark: ['oklch(0.7 0.15 162)', 'oklch(0.205 0 0)'],
    },
    rose: {
      light: ['oklch(0.58 0.21 12)', 'oklch(0.985 0 0)'],
      dark: ['oklch(0.65 0.19 12)', 'oklch(0.985 0 0)'],
    },
    ocean: {
      light: ['oklch(0.55 0.16 230)', 'oklch(0.985 0 0)'],
      dark: ['oklch(0.62 0.14 230)', 'oklch(0.985 0 0)'],
    },
  };

  var CHROMA = {
    subtle: 0.06,
    muted: 0.1,
    balanced: 0.16,
    vibrant: 0.22,
    max: 0.28,
  };

  var RADII = {
    sharp: 0,
    default: 0.5,
    rounded: 0.75,
    round: 1,
  };

  var mode = isDark ? 'dark' : 'light';
  // DEFAULT_PRESET, and the store's v4 migration: a stored base palette from
  // before v4 means the preset was never picked, so the new default applies.
  var preset = state.preset || 'clinozy-zinc-pastel';
  if ((stored.version || 0) < 4 && preset === 'default') {
    preset = 'clinozy-zinc-pastel';
  }

  // Shape language, for the boot surface. Under Sharp nothing in the app is
  // round — and the splash is the first thing on screen: its progress track (a
  // `pill` the React slot renders inside it) and the BrandLoader that takes over
  // from it are square from their first frame, whatever order the bundle applies
  // the look in. Mirrors applyDataAxis(root, 'shape', …) in
  // shared/theme/presets.ts, which re-applies (or clears) it once the bundle loads.
  if (preset === 'custom' && state.customTheme && state.customTheme.shapeId === 'sharp') {
    root.dataset.shape = 'sharp';
  }

  // Fast path: the exact palette the app resolved last time it applied THIS
  // theme, written by persistBootThemeVars() in shared/theme/presets.ts. Replay
  // it verbatim. The approximation below cannot run the real contrast math
  // (accentForeground lives in a bundle that has not loaded yet), so it guessed a
  // white --color-primary-foreground; for most accents the real answer is the
  // dark one, and the splash logo flipped colour the moment React caught up.
  // Guarded on preset AND mode: a snapshot from a different look or a different
  // light/dark state is worse than the fallback.
  //
  // Replayed by name — the exact list presets.ts snapshots (BOOT_SPLASH_VARS),
  // i.e. every colour and radius the splash in index.html paints from. A
  // snapshot an older build wrote can carry names this build no longer hands
  // back to the stylesheet; replaying one would pin it to the boot mode.
  var BOOT_VARS = [
    '--color-background',
    '--color-card',
    '--color-foreground',
    '--color-primary',
    '--color-primary-foreground',
    '--color-brand-mark',
    '--color-brand-mark-strong',
    '--radius-lg',
  ];
  var applied = false;
  var bootRaw = localStorage.getItem('theme-boot-vars');
  var boot = bootRaw ? JSON.parse(bootRaw) : null;
  if (boot && boot.preset === preset && boot.mode === mode && boot.vars) {
    for (var i = 0; i < BOOT_VARS.length; i++) {
      var value = boot.vars[BOOT_VARS[i]];
      if (typeof value === 'string' && value) {
        root.style.setProperty(BOOT_VARS[i], value);
      }
    }
    applied = true;
  }

  var primary;
  var fg;

  if (applied) {
    // Nothing to derive — the snapshot above already set every splash variable.
  } else if (preset === 'custom' && state.customTheme) {
    var look = state.customTheme;
    var hue = ((Math.round(look.hue) % 360) + 360) % 360;
    var chroma = CHROMA[look.intensityId] || 0.16;
    primary = 'oklch(0.58 ' + chroma + ' ' + hue + ')';
    // Boot-safe foreground — full contrast math lives in presets.ts applyAccent.
    fg = 'oklch(0.985 0 0)';
    if (look.radiusId && RADII[look.radiusId] !== undefined) {
      root.style.setProperty('--radius-lg', RADII[look.radiusId] + 'rem');
    }
  } else if (PRESET_PRIMARY[preset]) {
    root.dataset.theme = preset;
    primary = PRESET_PRIMARY[preset][mode][0];
    fg = PRESET_PRIMARY[preset][mode][1];
  }

  if (primary) {
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--color-primary-foreground', fg);
  }
} catch (e) {}
