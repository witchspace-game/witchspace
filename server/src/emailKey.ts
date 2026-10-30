// One inbox, one account: the key an email address is matched by, so a second account can't be had
// for free with the same inbox. "name+anything@" is delivered to "name@" by most mail services, and
// Gmail ignores dots and answers to googlemail.com too. The address itself is kept as typed.

const GMAIL = new Set(['gmail.com', 'googlemail.com']);

export function emailKey(email: string): string {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 1) return email.trim().toLowerCase();
  const lower = email.trim().toLowerCase();
  let local = lower.slice(0, at).split('+')[0] || lower.slice(0, at);
  let domain = lower.slice(at + 1);
  if (GMAIL.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}
