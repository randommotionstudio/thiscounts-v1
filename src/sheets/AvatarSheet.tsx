import * as actions from '../data/actions';
import { AV_COLORS, AV_ICONS, AV_ICON_DE, DEFAULT_AVATAR, type AvatarPref } from '../lib/avatar';
import { Avatar, IconGlyph, Sheet } from '../ui/kit';

const RING = '0 0 0 2px #FBF5EE, 0 0 0 4px #F3752E', NO_RING = '0 0 0 1px #EADCCD';
const label = { fontSize: 13, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em', margin: '20px 0 10px' } as const;

/** V1.2 "Profilbild": initials or an icon, plus a color. Every tap saves right away. */
export function AvatarSheet({ person, onClose }: { person: { name: string; avatar?: AvatarPref }; onClose: () => void }) {
  const av = person.avatar || DEFAULT_AVATAR;
  const col = AV_COLORS[av.color] || AV_COLORS[0];
  const save = (patch: Partial<AvatarPref>) => actions.setAvatar({ ...av, ...patch });
  const isInit = av.kind !== 'icon';
  const cell = (on: boolean) => ({
    aspectRatio: '1', minHeight: 44, borderRadius: '50%', border: 'none', padding: 0, backgroundColor: on ? col.bg : '#fff',
    boxShadow: on ? RING : NO_RING, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  }) as const;

  return (
    <Sheet title="Profilbild" sub="So sehen dich alle, mit denen du Listen teilst." onClose={onClose} z={45} scrollBody>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <Avatar person={{ name: person.name, avatar: av }} size={96} iconScale={0.52} shadow="0 8px 24px rgba(42,31,23,.14)" />
      </div>
      <div style={label}>Initialen oder Icon</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10 }}>
        <button onClick={() => save({ kind: 'initial' })} title="Initialen" aria-label="Initialen" aria-pressed={isInit}
          style={{ ...cell(isInit), color: isInit ? col.fg : '#6F6055', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18 }}>
          {person.name.charAt(0).toUpperCase()}
        </button>
        {AV_ICONS.map(ic => {
          const on = av.kind === 'icon' && av.icon === ic;
          return (
            <button key={ic} onClick={() => save({ kind: 'icon', icon: ic })} title={AV_ICON_DE[ic]} aria-label={AV_ICON_DE[ic]} aria-pressed={on} style={cell(on)}>
              <IconGlyph icon={ic} color={on ? col.fg : '#6F6055'} size="50%" />
            </button>
          );
        })}
      </div>
      <div style={label}>Farbe</div>
      <div style={{ display: 'flex', gap: 14, paddingLeft: 2 }}>
        {AV_COLORS.map((c, i) => (
          <button key={c.name} onClick={() => save({ color: i })} title={c.name} aria-label={c.name} aria-pressed={av.color === i}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', padding: 0, backgroundColor: c.bg, boxShadow: av.color === i ? RING : NO_RING, cursor: 'pointer', flexShrink: 0 }} />
        ))}
      </div>
      <button onClick={onClose} style={{ marginTop: 22, width: '100%', height: 54, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 17, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Fertig</button>
    </Sheet>
  );
}
