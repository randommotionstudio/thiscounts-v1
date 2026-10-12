// V1.5: invites and the people of a household (pure helpers, no Firebase)

/** No 0/O, 1/I/L: codes are read aloud and typed in by hand */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const INVITE_DAYS = 7;

export function newInviteCode(random: () => number = Math.random): string {
  let c = '';
  for (let i = 0; i < CODE_LENGTH; i++) c += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return c;
}

/** "k7m 4qx", "K7M-4QX" → "K7M4QX"; null if it can't be a code */
export function normalizeCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== CODE_LENGTH) return null;
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return null;
  return c;
}

/** "K7M4QX" → "K7M-4QX" */
export const formatCode = (code: string) => code.slice(0, 3) + '-' + code.slice(3);

export const invitePath = (code: string) => '/einladung/' + code;

/** The code in an invite link's path ("/einladung/K7M4QX"), as typed (not yet checked) */
export function codeFromPath(path: string): string | null {
  const m = path.match(/^\/einladung\/([^/]+)\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

/** "Anna", "Anna und Tom", "Anna, Tom und Lea" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || '';
  return names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1];
}

/** "bis Mo., 19. Okt." */
export function untilLabel(ms: number): string {
  return 'bis ' + new Date(ms).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}
