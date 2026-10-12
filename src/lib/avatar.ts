// V1.2 profile picture: initials or one of 17 icons (V1.7: +6), in one of 6 colors (V1.7: +2, saved by id). No photo upload.

export const AV_ICONS = [
  'apple', 'carrot', 'cherry', 'egg', 'fish', 'pizza', 'cookie', 'coffee', 'cup-soda', 'soup', 'milk',
  'citrus', 'grape', 'croissant', 'cake-slice', 'ice-cream-cone', 'popcorn',
] as const;
export const AV_ICON_DE: Record<string, string> = {
  apple: 'Apfel', carrot: 'Karotte', cherry: 'Kirschen', egg: 'Ei', fish: 'Fisch', pizza: 'Pizza',
  cookie: 'Keks', coffee: 'Kaffee', 'cup-soda': 'Limo', soup: 'Suppe', milk: 'Milch',
  citrus: 'Zitrone', grape: 'Trauben', croissant: 'Croissant', 'cake-slice': 'Kuchen', 'ice-cream-cone': 'Eis', popcorn: 'Popcorn',
};
/**
 * Colors in picker order. Saved by id (like the icons), so the order can change freely;
 * an unknown id (or an old color number from before V1.7) shows Orange.
 */
export const AV_COLORS = [
  { id: 'orange', bg: '#F3752E', fg: '#2A1F17', name: 'Orange' },
  { id: 'pfirsich', bg: '#FDE4D1', fg: '#9C4412', name: 'Pfirsich' },
  { id: 'mint', bg: '#DDF0E3', fg: '#1E5A34', name: 'Mint' },
  // V1.7: the blue and purple of the categories
  { id: 'himmel', bg: '#D2ECFC', fg: '#00496F', name: 'Himmel' },
  { id: 'flieder', bg: '#EBE3FC', fg: '#4B346F', name: 'Flieder' },
  { id: 'espresso', bg: '#2A1F17', fg: '#FBF5EE', name: 'Espresso' },
];
export const avColor = (id: string) => AV_COLORS.find(c => c.id === id) || AV_COLORS[0];

/** users/{uid}.avatar */
export interface AvatarPref {
  kind: 'initial' | 'icon';
  icon: string | null;
  /** id from AV_COLORS, e.g. "espresso" */
  color: string;
}

export const DEFAULT_AVATAR: AvatarPref = { kind: 'initial', icon: null, color: 'orange' };

/** Whatever is stored (or nothing) → a valid avatar. Missing field = initial on orange. */
export function normalizeAvatar(v: unknown): AvatarPref {
  if (!v || typeof v !== 'object') return DEFAULT_AVATAR;
  const x = v as Record<string, unknown>;
  const icon = typeof x.icon === 'string' && (AV_ICONS as readonly string[]).includes(x.icon) ? x.icon : null;
  const color = typeof x.color === 'string' && AV_COLORS.some(c => c.id === x.color) ? x.color : DEFAULT_AVATAR.color;
  const kind = x.kind === 'icon' && icon ? 'icon' : 'initial';
  return { kind, icon, color };
}

export const avatarIconUrl = (icon: string) => '/icons/' + icon + '.svg';
