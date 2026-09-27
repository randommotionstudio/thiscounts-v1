// V1.2 profile picture: initials or one of 11 icons, in one of 4 colors. No photo upload.

export const AV_ICONS = ['apple', 'carrot', 'cherry', 'egg', 'fish', 'pizza', 'cookie', 'coffee', 'cup-soda', 'soup', 'milk'] as const;
export const AV_ICON_DE: Record<string, string> = {
  apple: 'Apfel', carrot: 'Karotte', cherry: 'Kirschen', egg: 'Ei', fish: 'Fisch', pizza: 'Pizza',
  cookie: 'Keks', coffee: 'Kaffee', 'cup-soda': 'Limo', soup: 'Suppe', milk: 'Milch',
};
export const AV_COLORS = [
  { bg: '#F3752E', fg: '#2A1F17', name: 'Orange' },
  { bg: '#FDE4D1', fg: '#9C4412', name: 'Pfirsich' },
  { bg: '#DDF0E3', fg: '#1E5A34', name: 'Mint' },
  { bg: '#2A1F17', fg: '#FBF5EE', name: 'Espresso' },
];

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
