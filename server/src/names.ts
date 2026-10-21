// Callsigns nobody can simply claim. Two kinds:
//
//   never      Not for anyone: names that would mislead (sounding official),
//              that belong to everyone (Jameson), or that are offensive.
//   protected  Held back for the right person. An admin can release one to a
//              particular email address (tools/names.ts), and only the account
//              signed in with that address can then claim it.
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
  { name: 'Moxon', rule: 'protected', within: true, why: 'Kept back by request' },
  { name: 'Oolite', rule: 'protected', within: true, why: 'The open-source Elite: for its people' },

  // This project
  { name: 'Witchspace', rule: 'protected', within: true, why: 'This project' },

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
