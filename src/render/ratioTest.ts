// A test switch for how sharply the game draws on a phone (Mark, 2 November 2026: "the stars looked a
// bit blurry"). An iPhone's screen is 3×, and the game draws at 2× and lets the phone stretch it, for the
// battery. Whether 3× is worth 2.25 times the pixels can only be judged on the phone itself, so:
//   /play/?ratio=3    draw at 3×, with a frame-rate readout
//   /play/?ratio=2    today's 2×, with the same readout, to compare
//   /play/?ratio=off  back to normal
// It's kept on this device until it's turned off. Nobody meets it by accident.

const KEY = 'witchspace-ratio-test';

function chosen(): number | null {
  try {
    const asked = new URLSearchParams(location.search).get('ratio');
    if (asked === 'off') localStorage.removeItem(KEY);
    else if (asked === '2' || asked === '3') localStorage.setItem(KEY, asked);
    const kept = localStorage.getItem(KEY);
    return kept ? Number(kept) : null;
  } catch {
    return null;
  }
}

/** The ratio under test, or null in normal play. */
export const testRatio = chosen();

/** A small readout in the corner while testing: the ratio, and frames a second over the last second. */
export function showRatioReadout() {
  if (testRatio === null) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:50%;top:max(4px,env(safe-area-inset-top));transform:translateX(-50%);z-index:9999;padding:2px 8px;font:12px monospace;color:#3dffb0;background:rgba(0,0,0,.6);pointer-events:none';
  document.body.append(el);
  let frames = 0;
  let since = performance.now();
  const tick = (now: number) => {
    frames++;
    if (now - since >= 1000) {
      el.textContent = `${testRatio}× · ${Math.round((frames * 1000) / (now - since))} fps`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
