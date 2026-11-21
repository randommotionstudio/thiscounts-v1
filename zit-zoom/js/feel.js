// Haptics. Stand-in for Core Haptics in the iOS build.
// - Android / Chrome: the Vibration API.
// - iOS Safari (18+) has no Vibration API, but toggling a native
//   <input type="checkbox" switch> plays the system's light haptic tick.
//   It only fires inside a user gesture, so on iPhone you feel taps, not landings.

const PATTERNS = { light: 8, medium: 18, heavy: [26, 24, 16] };

export class Haptics {
  constructor() {
    this.enabled = true;
    this.vibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this.label = document.getElementById('haptic-switch');
  }

  pulse(kind) {
    if (!this.enabled) return;
    if (this.vibrate) {
      try { navigator.vibrate(PATTERNS[kind] || 10); } catch { /* ignore */ }
    } else if (this.label) {
      this.label.click();
      if (kind === 'heavy') setTimeout(() => this.label.click(), 70);
    }
  }
}
