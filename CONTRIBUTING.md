# Contributing to Witchspace

Welcome, Commander. 🚀 Whether you design ships, write lore, build missions or hack on the engine, there's room for you here.

## Add a ship in 5 minutes

1. Copy an existing ship, e.g. `content/ships/viper.json`, to `content/ships/<your-ship-id>.json`.
2. Change the `id` to match the file name. Ids are kebab-case, like `asp-mk2`.
3. Edit the name, description, stats and geometry. Put yourself in `credits.authors`. Set `stats.ratingValue` (combat rating points for a kill) in line with ships of similar strength: a Sidewinder is 0.33, a Cobra Mk III 0.91 (see [combat rating](docs/design/combat-rating.md#ship-value)).
4. Run `npm run dev` and press → until your ship appears. Drag to rotate it.
5. Run `npm run validate -- --fix` until every file shows ✓.
6. Open a pull request with a screenshot of your ship.

## Design a section of the Titanoboa

Wexley-Yorozu's Titanoboa is built from modules on one coupling, and anyone can design a new one: a greenhouse, an ice refinery, a shipyard cradle, whatever you can imagine.

1. Copy a core module, e.g. `content/modules/furnace.json`, to `content/modules/<your-module-id>.json`.
2. Give it a `zone` (where it goes, prow to stern: intake, industry, logistics, crew, fabrication, add-on, power), a `length`, which ends couple, one sentence in Wexley-Yorozu's catalogue voice, and your commander name as `designer`.
3. Draw the body: one shape with one job, at most 256 vertices. It stops 35 m short of each coupled end, and must end there in a flat face covering the 140 m coupling square. The game adds the necks.
4. Run `npm run validate` until it shows ✓, and open a pull request with a picture.

The standard, and why each core module looks as it does: [the Titanoboa design](docs/design/ship-the-titanoboa.md#designing-a-module-the-standard). Accepted modules are fitted in yards, and Wexley-Yorozu pays the designer's commander 5,000 Cr (in game credits).

### Geometry rules

- Units are metres. **+Z is the nose**, +Y is up and +X is port (left). This is the glTF convention.
- `vertices` are `[x, y, z]` points. `faces` are lists of vertex indices.
- Every face must be **flat** and **convex**. If it isn't, split it into triangles.
- The hull should be **closed**, with every edge shared by exactly two faces.
- Wind faces counter-clockwise when seen from outside. If you're not sure, `--fix` sorts it out.
- Edges are drawn automatically from the faces. Use `details` for extra lines such as engines, cockpits and docking slots. Lift detail lines about 0.2–0.5m off the hull so it doesn't hide them.
- An `insignia` (optional) is a mark in its own colour, drawn as lines like `details` and lifted off the hull the same way: a captain's or maker's sign. Keep it small, a nod rather than a badge, and never a symbol with a real-world hateful meaning.
- **Police markings are not yours to add.** Beacons and the hull band are applied by the game to ships in the `police` role; a ship file can't declare them. Don't draw police-like stripes or lights as `details` on other ships.
- Keep it lean. Classic ships have roughly 5–40 vertices. The look comes from clean silhouettes, not polygon count.

### Style guide

- Neo-vector colours by role: traders and multirole ships are green, police blue, pirates red/magenta, aliens purple and stations amber. Every hull glows at full strength: the glowing, coloured hull is Witchspace's signature, so don't dim a ship to make it stealthy or moody. (A ship running dark is shown in a cold white by the game until its hull is read; that's the game's job, not the ship file's.)
- Elegance over detail. A Witchspace ship is a few glowing lines that read at a glance: a strong silhouette, clean edges, every line earning its place. We don't chase rendered realism (textures, surface clutter, modelled interiors); others do that beautifully, and restraint is what makes ours ours. When in doubt, take a line away.
- Descriptions are one or two sentences, in-universe, dry and a little wry.
- Stats should sit inside the existing range. A ship that's fastest, toughest *and* cheapest will be asked to pick one.

## Legends and homages

Legends are rare easter-egg ships, and fans are warmly invited to build them. Nods to films, TV and books are part of the fun, but a homage has to be **ours**:

- ✅ **Names** that wink at the source, especially ones that are ordinary words or myth anyway (*Event Horizon*, *Prometheus*).
- ✅ **Original geometry that evokes the feel**, such as a ring-shaped gravity drive or an impossibly small box. Design it from the idea, not from a reference image.
- ✅ **Flavour text that hints** and lets players get the joke.
- ❌ **Tracing or modelling the actual on-screen design**, using logos or insignia, or quoting dialogue.

Until the legends system lands (see the [roadmap](https://witchspace.org.uk/roadmap/)), add a legend as a normal ship file and mention in your pull request where and how rarely you'd like it to appear. Reviewers will check homages against these rules before merging, because merging publishes the work under the project's name.

## Using AI to contribute

You're encouraged to. See [AGENTS.md](AGENTS.md), which your AI assistant can read directly. Please:

- Set `"aiAssisted": true` in your file's `credits`.
- **Look at and playtest what you submit.** You are the author and you're responsible for it.
- Keep pull requests focused. One good ship is better than ten rushed ones.

## Ground rules

- **Original work only.** Don't copy code, vertex data, text or art from *Elite*, *Elite Dangerous*, *Oolite* or any other game. Ship *names* from the original *Elite* are welcome as a tribute (see [CREDITS.md](CREDITS.md)), but the geometry and words must be yours.
- By contributing you agree that code is licensed under GPL-3.0 and content under CC BY-SA 4.0.
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- Be kind. This is a project of love.

## Code contributions

```bash
npm install
npm run dev        # play locally
npm run typecheck  # TypeScript checks
npm run validate   # content checks
npm run build      # production build
```

For anything bigger than a bug fix, open an issue first so we can talk it through.
