// The controls and the docking drill, as plain data: the in-game controls card,
// the owner's manual in the game and the owner's manual pages on the site all
// read them, so none can drift from the others. No DOM, no state: whoever calls
// says which scheme, whether the lasers are gimballed and whether it's Modern.

/** Fraction of top speed under which a canister can be scooped; any faster and it bounces off. */
export const SCOOP_SPEED = 0.4;

/** The two ways to fly on a computer, as HTML. */
export const SCHEMES = 'Two ways to fly: <b>mouse and keyboard</b> (the ship follows the ring) or <b>keyboard only</b>, as in 1984. K switches between them, F1 shows the card in flight.';

/** Tilt and Invert on a phone. */
export const TILT = 'Tilt steers by tilting the phone, like a flight stick: tip the top towards you to climb. Invert swaps up and down, for dragging and tilting. Turn the phone on its side for the widest view.';

/** Every control, as key and what it does. */
export function controlRows(scheme: boolean | 'bbc', o: { gimballed: boolean; modern: boolean }): string[][] {
  if (scheme === 'bbc') return bbcRows(controlRows(false, o));
  const mouse = scheme;
  return (
    mouse
      ? [
          ['Click', 'Capture the mouse (Esc releases it)'],
          ['Mouse', 'Aim: the ship turns to follow the ring'],
          ['Left click / F', o.gimballed ? 'Fire: gimballed lasers hit what\'s under the ring' : 'Fire: lasers fire straight ahead at the centre cross'],
          ['Right click', 'Centre the aim and level the wings'],
          ['Hold right + mouse', 'Roll, nose held steady; the ship keeps that bank'],
          ['W / S', 'Throttle up / down'],
          ['A / D', 'Roll'],
          ['Q / E', 'Yaw (fine sideways adjustment)'],
          ['Swipe / scroll', 'Throttle; sideways swipe rolls (Magic Mouse, trackpad)'],
        ]
      : [
          ['W / S', 'Dive / climb (I inverts)'],
          ['A / D', 'Roll'],
          ['Space / Shift', 'Throttle up / down'],
          ['F', 'Fire laser'],
          ['Swipe / scroll', 'Throttle; sideways swipe rolls'],
        ]
  )
    .concat([
      ['C', 'Docking computer'],
      ['H', 'Hyperspace to your destination (10 s countdown; H again cancels)'],
      ['O', 'Combat computer: it flies, you man the turrets (needs one fitted; any flight control takes over)'],
      ['9', 'Survey autopilot: flies to whatever is left to survey or find here, and holds you in range (explorers; any flight control takes over)'],
      ['P', 'Take a photo of the view, without the HUD, into your flight log (share it when docked)'],
      ['Shift+P', 'Flight recorder: keep the last 30 seconds (or hold the camera button)'],
      ['J', 'In-system jump: leap ~10 km ahead (not near ships, the station or the planet)'],
      ['T', 'Arm a missile: hold a ship in your sights until the tone goes solid (Classic: lock at once). Again to disarm'],
      ['X', 'Launch the locked missile'],
      ['Z', 'ECM: destroy every missile nearby, yours included (needs an ECM)'],
      ['1 2 3 4 / V', 'Look front, rear, left or right (V cycles); fire uses that mount\'s laser'],
      ['R', 'Scanner range: 4 km for dogfights, 12 km for traffic'],
      ['B', 'Energy bomb: destroy every ship within 6 km (single use)'],
      ['Y', 'Galactic hyperdrive: jump to the next galaxy (single use)'],
      ['U', 'Surrender to the police: the ship stops itself, then 5 seconds (fine, record cleared)'],
      ...(o.modern ? [['0', 'Transponder off / on: run dark, unidentified (police will hail you; it switches back on after a jump, or to dock when it\'s safe)']] : []),
      ...(o.modern
        ? [
            ['L', 'Hail the ship in your sights (or the station, within 5 km; anywhere with a comms array)'],
            ["'", 'Radio log: open / close'],
            ['Enter', 'Accept the latest offer on the radio'],
            ['`', 'Emergency beacon: Mayday, out of fuel, hull failing, request escort (1–4 to send)'],
          ]
        : []),
      ['Scoop', `Fly slowly (under ${Math.round(SCOOP_SPEED * 100)}% speed) straight into a cargo canister, a yellow dot on the scanner (needs Fuel Scoops)`],
      ['G', 'Galaxy map (Tab: local chart, arrows + Enter: choose destination)'],
      ['K', 'Switch control scheme: mouse and keyboard, keyboard only, or the BBC Micro\'s keys'],
      ['I', 'Invert pitch'],
      ['M', '1984 mode'],
      ['N', 'Sound: full / effects only / off'],
      ['F1', 'Show / hide this card (Esc hides it too)'],
    ]);
}

/** Docking, step by step, as HTML (the station's roll must be matched within `rollDeg`). */
/** `fitted`: the hull leaves the yard with a docking computer (shipyard.ts standardKit). */
export const DOCKING = (rollDeg: number, fitted = false): string[] => [
  `Fly towards the station and slow down. The slot is the lit rectangle on the face that points at the planet.`,
  `Within 3 km a docking aid opens: <b>Slot</b> (how far), <b>Approach</b> (how straight you're coming in) and <b>Roll</b> (how level you are with the slot). Green is good.`,
  `The station turns. Roll until the marker sits in the middle: your wings must be within ${rollDeg}° of the slot. On a phone, drag sideways on the left of the screen, or tilt if you've turned Tilt on.`,
  `Fly straight in, slowly. Too fast, too crooked or too far off level and you scrape the hull: shields first, then the ship.`,
  `<b>Or let the docking computer do it</b> (C, or the Dock button that appears by itself on a phone when you're close). ${fitted ? 'She has one fitted as standard.' : 'It’s 1,500 Cr at any station, and the best money a new pilot spends.'}`,
];

/** The phone's fixed controls, as label and what it does. */
export const PHONE: string[][] = [
  ['Left side', 'Drag to aim, like a stick: the further you drag, the faster she turns. Sideways rolls. In a rear or side view, dragging turns that view.'],
  ['Speed', 'Slide up for faster; it stays where you leave it. The fill is the speed you\'re doing, the tick the speed you asked for: when the docking computer slows you, the fill falls and the tick stays.'],
  ['Fire', 'Hold to fire the laser.'],
  ['Missile', 'Tap to arm a missile, and hold a ship in your sights until it locks. Then press and hold to launch; a tap lets go of the lock.'],
  ['ECM', 'Destroys every missile nearby, yours included (needs an E.C.M. system).'],
  ['The big button', 'The obvious next thing, by itself: Dock near a station (with a docking computer), Survey near something to survey, Hyper when your destination is in range, otherwise Jump.'],
  ['The arrow', 'Tap for front, rear, left or right: the arrow points where you\'re looking, and your lasers fire that way if one is fitted there. To glance, hold it and slide onto a direction: you look that way while you hold, and ahead again when you let go.'],
  ['The camera', 'Tap for a photo of the view; hold to keep the last 30 seconds in your flight log.'],
  ['The scanner', 'Tap it to switch range: 4 km for a fight, 12 km for the traffic around you.'],
  ['The radio', 'Calls arrive as cards: tap an answer, or let them go. Tap the Radio pill to read what was said.'],
];

/** The dashboard, label by label (Marketing's copy, 29 October 2026). */
export const DASHBOARD: string[][] = [
  ['The scanner', 'The ellipse in the middle: you sit at its centre, facing up. Each contact is a blip on a stalk; a stalk rising means it\'s above you, falling means below.'],
  ['SH · HL', 'Shields and hull.'],
  ['SP · FU', 'Speed and fuel.'],
  ['LT', 'Laser temperature: let it cool, or the laser cuts out.'],
  ['CT', 'Cabin temperature: it climbs too close to a sun.'],
  ['RL · DC', 'Roll, and dive or climb: how you\'re turning.'],
  ['The compass', 'Points to the station: centred and solid, it\'s ahead; hollow, it\'s behind you.'],
  ['AUTO · DARK', 'AUTO lights while the docking computer flies; DARK while your transponder is off.'],
  ['The pips', 'Your missiles.'],
];

/** The flight recorder, for the manual (as it is today; Marketing's copy). */
export const RECORDER = [
  'Your ship keeps your best moments: a fight, a Legend, the Marshals, a discovery, a big trade, your last moments.',
  'When you dock, <b>Your moments</b> shows what this trip kept, the best first. <b>Share</b> one, <b>☆ star</b> it to keep it forever, or swipe it away to let it go. Anything you don\'t star clears after a week; they\'re all in the <b>Flight log</b>.',
  '<b>More</b> has the rest: an upright version for Reels and Shorts, saving the video, and <b>Watch it from outside</b> when there\'s a fight to watch, rebuilt so you can see what got you.',
  'Sharing gives a moment its own page, with its own card, that plays for anyone you send it to.',
];

/** What each drawer button does, said for a phone: no keys (they're the keyboard's). By the key it presses. */
export const PHONE_DRAWER: Record<string, string> = {
  KeyJ: 'In-system jump: leap about 10 km ahead (not near ships, the station or the planet).',
  KeyH: 'Hyperspace to your destination: a 10-second countdown; tap again to cancel.',
  KeyC: 'Docking computer: it flies you into the slot.',
  KeyO: 'Combat computer: it flies the fight while you man the turrets. Needs one fitted; touching the flight controls takes over.',
  KeyG: 'Galaxy map: see where you can go, and choose your destination.',
  KeyU: 'Surrender to the police: the ship stops itself, then 5 seconds (a fine, and your record is cleared).',
  KeyB: 'Energy bomb: destroys every ship within 6 km, whoever they are. Single use.',
  KeyL: 'Hail the ship in your sights, or the station within 5 km.',
  Backquote: 'Emergency beacon: a Mayday, out of fuel, hull failing, or a call for an escort.',
  Digit9: 'Survey autopilot: flies to whatever is left to survey or find here, and holds you in range.',
  Digit0: 'Transponder off or on: run dark, unidentified. Police will hail you; it switches back on after a jump.',
  KeyN: 'Sound: full, effects only, or off.',
};

/**
 * What a drawer button does (the drawer is in play/index.html): from the key it
 * presses, looked up in the controls list (\`data-key\`, e.g. "KeyJ"), or else
 * its own title.
 */
export function drawerHelp(code: string | undefined, title: string, rows: string[][]): string {
  if (code) {
    const k = code === 'Backquote' ? '`' : code.replace(/^Key|^Digit/, '');
    const row = rows.find((r) => r[0].split(/[\s/]+/).includes(k));
    if (row) return row[1];
  }
  return title;
}

/**
 * The BBC Micro's own keys (maniacminer, Stardot t=33815: "M for missile, S/X up down, A fire laser"):
 * the keyboard-only list, with flying, the laser and the missiles moved to where 1984 had them.
 */
function bbcRows(keyboard: string[][]): string[][] {
  const flying = [
    ['X / S', 'Climb / dive (I inverts)'],
    ['< / >', 'Roll'],
    ['Space / ?', 'Throttle up / down'],
    ['A', 'Fire laser'],
  ];
  const moved: Record<string, string[][]> = {
    T: [['T', 'Arm a missile (target): hold a ship in your sights until the tone goes solid'], ['M', 'Launch the locked missile'], ['U', 'Unarm the missile']],
    X: [],
    Z: [['E / Z', 'ECM: destroy every missile nearby, yours included (needs an ECM)']],
    U: [['Q', 'Surrender to the police: the ship stops itself, then 5 seconds (fine, record cleared)']],
    M: [['M (docked)', '1984 mode (in flight, M is the missile)']],
  };
  const firstKeys = new Set(['W / S', 'A / D', 'Space / Shift', 'F', 'Swipe / scroll']);
  const rest = keyboard
    .filter(([k]) => !firstKeys.has(k))
    .flatMap((row) => moved[row[0]] ?? [row]);
  return [...flying, ['Swipe / scroll', 'Throttle; sideways swipe rolls'], ...rest];
}
