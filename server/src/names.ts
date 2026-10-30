// Callsigns nobody can simply claim. Two kinds:
//
//   never      Not for anyone: names that would mislead (sounding official),
//              that belong to everyone (Jameson), or that are offensive.
//   protected  Held back for the right person. An admin can release one to a
//              particular email address (tools/names.ts), and only the account
//              signed in with that address can then claim it.
//
// Any other name can be released the same way, which protects it too: that's
// how we hold an original fan's old callsign for them (launch/outreach.md).
//
// Names are matched loosely: case, spaces, punctuation, a CMDR prefix and
// look-alike digits are ignored, so "CMDR J4meson" and "D. Braben" count.
// `within` also catches the name inside a longer one; keep that for names
// distinctive enough not to catch anyone by accident ("Bell" would catch
// Campbell, so it's exact only).

export type NameRule = { name: string; rule: 'never' | 'protected'; within?: boolean; why: string };

export const NAMES: NameRule[] = [
  // Elite itself
  { name: 'Jameson', rule: 'protected', within: true, why: 'Elite’s own commander, flown by Witchspace’s founder' },
  { name: 'Elite', rule: 'never', why: 'The game we pay tribute to' },
  { name: 'Commander', rule: 'never', why: 'The title, and the name shared space gives guests' },
  { name: 'Cmdr', rule: 'never', why: 'The title' },
  { name: 'GalCop', rule: 'never', why: 'The police: nobody should look official' },

  // Elite's makers and their companies
  { name: 'Ian Bell', rule: 'protected', within: true, why: 'Co-author of Elite' },
  { name: 'Bell', rule: 'protected', why: 'Co-author of Elite' },
  { name: 'David Braben', rule: 'protected', why: 'Co-author of Elite' },
  { name: 'Braben', rule: 'protected', within: true, why: 'Co-author of Elite' },
  { name: 'Acornsoft', rule: 'protected', within: true, why: 'Elite’s first publisher' },
  { name: 'Firebird', rule: 'protected', why: 'Published Elite on other machines' },
  { name: 'Frontier', rule: 'protected', why: 'Braben’s company and Elite’s sequel' },
  { name: 'Moxon', rule: 'protected', within: true, why: 'Mark Moxon, whose annotated Elite source (bbcelite.com) guided us' },
  { name: 'Oolite', rule: 'protected', within: true, why: 'The open-source Elite: for its people' },

  // This project
  { name: 'Witchspace', rule: 'protected', within: true, why: 'This project' },

  // Nods to the films we love: held back until the founder says who gets them
  { name: 'Maverick', rule: 'protected', why: 'Film nod (Top Gun), held by the founder' },
  { name: 'Top Gun', rule: 'protected', why: 'Film nod, held by the founder' },
  { name: 'Iceman', rule: 'protected', why: 'Film nod (Top Gun), held by the founder' },
  { name: 'Goose', rule: 'protected', why: 'Film nod (Top Gun), held by the founder' },

  // Famous aces, held by the founder like the film nods. Exact only: Ace, Red, Hawk stay free.
  { name: 'Biggles', rule: 'protected', why: 'Fictional ace (W.E. Johns), held by the founder' },
  { name: 'Snoopy', rule: 'protected', why: 'The Red Baron’s famous foe, held by the founder' },

  // Marvel's characters: theirs, not ours to hand out. Held by the founder, like the film nods.
  // Distinctive names only; names that are ordinary words or older myths (Thor, Loki, Storm,
  // Vision, Falcon, Phoenix) stay free, and so does our own Legend.
  { name: 'Marvel', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'Avengers', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Iron Man', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Tony Stark', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Spider-Man', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Peter Parker', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Captain America', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Steve Rogers', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'Black Widow', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Black Panther', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Wakanda', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Wolverine', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Deadpool', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Thanos', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Groot', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'Star-Lord', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Rocket Raccoon', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Hawkeye', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'Nick Fury', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Doctor Strange', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Scarlet Witch', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Ultron', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Magneto', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Professor X', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'X-Men', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'Daredevil', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Incredible Hulk', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Hulk', rule: 'protected', why: 'Marvel character, held by the founder' },
  { name: 'Gamora', rule: 'protected', within: true, why: 'Marvel character, held by the founder' },
  { name: 'Shuri', rule: 'protected', why: 'Marvel character, held by the founder' },

  { name: 'Red Baron', rule: 'protected', within: true, why: 'Brand name (the pizza), and the WWI ace: held back' },

  // Real public figures: in shared space a "Putin" or a "Trump" ends up on the news board, the
  // feed and clips, and reads as our political joke. Exact only, never `within` ("Trumpet"), and
  // common surnames alone (Johnson, Harris, Charles, Kim) stay free. Accents don't matter.
  { name: 'Donald Trump', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Trump', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Joe Biden', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Biden', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Kamala Harris', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'JD Vance', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Obama', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Keir Starmer', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Starmer', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Farage', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Boris Johnson', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Rishi Sunak', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Sunak', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Macron', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Pedro Sánchez', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Meloni', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Zelensky', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Putin', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Xi Jinping', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Kim Jong Un', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Netanyahu', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Erdoğan', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Modi', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'King Charles', rule: 'never', why: 'A real public figure: nobody flies as one' },
  { name: 'Prince William', rule: 'never', why: 'A real public figure: nobody flies as one' },

  // Sounding official
  { name: 'Admin', rule: 'never', why: 'Sounds official' },
  { name: 'Administrator', rule: 'never', why: 'Sounds official' },
  { name: 'Moderator', rule: 'never', why: 'Sounds official' },
  { name: 'Mod', rule: 'never', why: 'Sounds official' },
  { name: 'Official', rule: 'never', why: 'Sounds official' },
  { name: 'Staff', rule: 'never', why: 'Sounds official' },
  { name: 'Support', rule: 'never', why: 'Sounds official' },
  { name: 'System', rule: 'never', why: 'Sounds official' },

  // Offensive: add more as they turn up
  { name: 'Fuck', rule: 'never', within: true, why: 'Offensive' },
  { name: 'Nazi', rule: 'never', within: true, why: 'Offensive' },
  { name: 'Hitler', rule: 'never', within: true, why: 'Offensive' },
  { name: 'Cunt', rule: 'never', why: 'Offensive (exact only: Scunthorpe)' },
  { name: 'Shit', rule: 'never', why: 'Offensive' },
];

const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' };

/** A name reduced to what matters for matching: "CMDR J4meson" → "jameson". */
export function nameKey(name: string): string {
  return name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[0-9]/g, (d) => LOOKALIKE[d] ?? d)
    .replace(/[^a-z]/g, '')
    .replace(/^(commander|cmdr)(?=.)/, '');
}

/** The rule a name falls under, or null if it's free. A `never` rule wins over a `protected` one. */
export function nameRule(name: string): NameRule | null {
  const key = nameKey(name);
  const hits = NAMES.filter((r) => {
    const k = nameKey(r.name);
    return key === k || (r.within && key.includes(k));
  });
  return hits.find((r) => r.rule === 'never') ?? hits[0] ?? null;
}
