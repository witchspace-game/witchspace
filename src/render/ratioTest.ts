// A test switch for how sharply the game draws on a phone (Mark, 2 November 2026: "the stars looked a
// bit blurry"). An iPhone's screen is 3×, and the game draws at 2× and lets the phone stretch it, for the
// battery. Whether 3× is worth 2.25 times the pixels can only be judged on the phone itself, so:
//   /play/?ratio=3    draw at 3×, with a frame-rate readout
//   /play/?ratio=2    today's 2×, with the same readout, to compare
//   /play/?ratio=off  back to normal
// With buttons to switch off each suspect in turn, if the frame rate is low.
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

/** What the test buttons have switched off, to see what each costs on the phone itself. */
export const perfTest = { noRecorder: false, noGlow: false, frameMs: 0 };

/**
 * A readout while testing: the ratio, frames a second, and milliseconds of the game's own work a frame;
 * and buttons to switch off each suspect. Blurs: the panels' blurred backgrounds. Shadows: the glow on the
 * arrows and brackets. Glow: the 3D glow. Rec: the flight recorder. Mark's iPhone showed 16 fps at 2×.
 */
export function showRatioReadout() {
  if (testRatio === null) return;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:max(8px,env(safe-area-inset-left));top:30%;z-index:9999;display:grid;gap:4px;width:130px;font:12px monospace;color:#3dffb0';
  const read = document.createElement('div');
  read.style.cssText = 'padding:3px 6px;background:rgba(0,0,0,.75);line-height:1.3';
  box.append(read);
  const style = document.createElement('style');
  document.head.append(style);
  const rules = new Set<string>();
  const css = () => (style.textContent = [...rules].join(''));
  const toggle = (label: string, off: () => void, on: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    let isOff = false;
    const draw = () => {
      b.textContent = `${label}: ${isOff ? 'OFF' : 'on'}`;
      b.style.cssText = `min-height:34px;padding:0 6px;font:12px monospace;text-align:left;border:1px solid #3dffb0;background:${isOff ? '#3dffb0' : 'rgba(0,0,0,.75)'};color:${isOff ? '#000' : '#3dffb0'}`;
    };
    b.onclick = (e) => {
      e.stopPropagation();
      isOff = !isOff;
      (isOff ? off : on)();
      draw();
    };
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    draw();
    box.append(b);
  };
  const blur = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
  const shadow = '#indicators *,#hit-dir{filter:none!important}';
  toggle('Blurs', () => (rules.add(blur), css()), () => (rules.delete(blur), css()));
  toggle('Shadows', () => (rules.add(shadow), css()), () => (rules.delete(shadow), css()));
  toggle('Glow', () => (perfTest.noGlow = true), () => (perfTest.noGlow = false));
  toggle('Rec', () => (perfTest.noRecorder = true), () => (perfTest.noRecorder = false));
  document.body.append(box);
  let frames = 0;
  let since = performance.now();
  const tick = (now: number) => {
    frames++;
    if (now - since >= 1000) {
      read.textContent = `${testRatio}× · ${Math.round((frames * 1000) / (now - since))} fps\nwork ${perfTest.frameMs.toFixed(0)} ms`;
      read.style.whiteSpace = 'pre';
      frames = 0;
      since = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
