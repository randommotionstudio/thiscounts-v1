// The launch screen: the app icon on beige, written into index.html so it shows the moment the app opens, before
// any code has run – and looking exactly like the phone's own launch screen (on iPhone: the launch images made
// from the same markup by scripts/make-launch-images.cjs). It stays until the first screen is complete and then
// fades out, so nothing visibly fills in piece by piece. No minimum time; at most LAUNCH_MAX_MS, so it can never
// get stuck.

const LAUNCH_MAX_MS = 1500;
const FADE_MS = 150;

export function hideLaunch() {
  const el = document.getElementById('launch');
  if (!el || el.dataset.out) return;
  el.dataset.out = '1';
  el.classList.add('out');
  setTimeout(() => el.remove(), FADE_MS + 50);
}

/** Started once with the app: the upper limit */
export function limitLaunch() {
  setTimeout(hideLaunch, LAUNCH_MAX_MS);
}
