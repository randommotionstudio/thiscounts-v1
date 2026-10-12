// V1.2 profile picture: initials or one of 17 icons (V1.7: +6), in one of 6 colors (V1.7: +2). No photo upload.

export const AV_ICONS = [
  'apple', 'carrot', 'cherry', 'egg', 'fish', 'pizza', 'cookie', 'coffee', 'cup-soda', 'soup', 'milk',
  'citrus', 'grape', 'croissant', 'cake-slice', 'ice-cream-cone', 'popcorn',
] as const;
export const AV_ICON_DE: Record<string, string> = {
  apple: 'Apfel', carrot: 'Karotte', cherry: 'Kirschen', egg: 'Ei', fish: 'Fisch', pizza: 'Pizza',
  cookie: 'Keks', coffee: 'Kaffee', 'cup-soda': 'Limo', soup: 'Suppe', milk: 'Milch',
  citrus: 'Zitrone', grape: 'Trauben', croissant: 'Croissant', 'cake-slice': 'Kuchen', 'ice-cream-cone': 'Eis', popcorn: 'Popcorn',
};
export const AV_COLORS = [
  { bg: '#F3752E', fg: '#2A1F17', name: 'Orange' },
  { bg: '#FDE4D1', fg: '#9C4412', name: 'Pfirsich' },
  { bg: '#DDF0E3', fg: '#1E5A34', name: 'Mint' },
  { bg: '#2A1F17', fg: '#FBF5EE', name: 'Espresso' },
  // V1.7: the blue and purple of the categories
  { bg: '#D2ECFC', fg: '#00496F', name: 'Himmel' },
  { bg: '#EBE3FC', fg: '#4B346F', name: 'Flieder' },
];
/** Order in the picker (Espresso last). The stored color is the index into AV_COLORS, so that order never changes. */
export const AV_COLOR_ORDER = [0, 1, 2, 4, 5, 3];

/** users/{uid}.avatar */
export interface AvatarPref {
  kind: 'initial' | 'icon';
  icon: string | null;
  color: number;
}

export const DEFAULT_AVATAR: AvatarPref = { kind: 'initial', icon: null, color: 0 };

/** Whatever is stored (or nothing) → a valid avatar. Missing field = initial on orange. */
export function normalizeAvatar(v: unknown): AvatarPref {
  if (!v || typeof v !== 'object') return DEFAULT_AVATAR;
  const x = v as Record<string, unknown>;
  const icon = typeof x.icon === 'string' && (AV_ICONS as readonly string[]).includes(x.icon) ? x.icon : null;
  const color = typeof x.color === 'number' && x.color >= 0 && x.color < AV_COLORS.length ? Math.floor(x.color) : 0;
  const kind = x.kind === 'icon' && icon ? 'icon' : 'initial';
  return { kind, icon, color };
}

export const avatarIconUrl = (icon: string) => '/icons/' + icon + '.svg';
