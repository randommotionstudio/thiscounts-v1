// On-device save. Stand-in for iCloud key-value storage / CloudKit in the iOS build.

const KEY = 'zitzoom.save.v1';

const DEFAULTS = {
  goo: 0,
  bestEndless: 0,
  daily: {}, // 'YYYY-MM-DD' → { best, attempts, ghost: [x0, y0, x1, y1, …] }
  owned: ['classic'],
  skin: 'classic',
  maxBiome: 0,
  flags: {},
  sound: true,
  haptics: true,
  runs: 0,
  bestStreak: 0,
};

export function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...structuredClone(DEFAULTS), ...raw };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    // Storage full or blocked: drop ghosts and try once more.
    try {
      for (const d of Object.values(save.daily)) d.ghost = null;
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch { /* private mode */ }
    return false;
  }
}

/** Keep only the last few days of Daily Pop data. */
export function pruneDaily(save, keep = 3) {
  const days = Object.keys(save.daily).sort();
  for (const d of days.slice(0, Math.max(0, days.length - keep))) delete save.daily[d];
}
