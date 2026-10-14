import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LOGOS, logoUrl } from '../lib/logic';
import type { Conn } from '../app/useConnection';
import { DEFAULT_AVATAR, avColor, avatarIconUrl, type AvatarPref } from '../lib/avatar';

/** Store logo in a white tile, or the store's initial when there's no logo. */
export function LogoTile({ store, size, radius, initialSize, bordered = true, style }: {
  store: { name: string; logo: string | null } | null;
  size: number; radius: number; initialSize: number; bordered?: boolean; style?: CSSProperties;
}) {
  const L = store && store.logo ? LOGOS[store.logo] : null;
  return (
    <div className="logo-tile" style={{ width: size, height: size, borderRadius: radius, border: bordered ? undefined : 'none', ...style }}>
      {L ? (
        <span className="logo-img" style={{ width: L.size, height: L.size, borderRadius: L.radius, backgroundImage: `url(${logoUrl(store!.logo!)})` }} />
      ) : (
        <span className="logo-initial" style={{ fontSize: initialSize }}>{((store && store.name) || '?').charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

/** Offline / syncing indicator. Nothing is shown while online and synced. */
export function ConnPill({ conn, dark }: { conn: Conn; dark?: boolean }) {
  if (conn === 'online') return null;
  return (
    <span className={'pill' + (dark ? ' dark' : '')}>
      <span className="pill-dot" style={{ background: conn === 'offline' ? '#C9581A' : '#8A7A6D' }} />
      {conn === 'offline' ? 'Offline · Änderungen werden gespeichert' : 'Wird synchronisiert …'}
    </span>
  );
}

export function TabBar({ active, go }: { active: 'list' | 'plan' | 'profile'; go: (p: string) => void }) {
  return (
    <div className="tabbar">
      <button className={'tab' + (active === 'list' ? ' active' : '')} onClick={() => go('/')}>
        <svg width="20" height="20" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="2.5" rx="1.25" fill="currentColor" /><rect x="3" y="10" width="16" height="2.5" rx="1.25" fill="currentColor" /><rect x="3" y="15" width="10" height="2.5" rx="1.25" fill="currentColor" /></svg>Liste
      </button>
      <button className={'tab' + (active === 'plan' ? ' active' : '')} onClick={() => go('/plan')}>
        <svg width="20" height="20" viewBox="0 0 22 22"><circle cx="11" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2.5" /><circle cx="11" cy="10" r="2" fill="currentColor" /></svg>Plan
      </button>
      <button className={'tab' + (active === 'profile' ? ' active' : '')} onClick={() => go('/profil')}>
        <svg width="20" height="20" viewBox="0 0 22 22"><circle cx="11" cy="7.5" r="4" fill="currentColor" /><rect x="3" y="13.5" width="16" height="7" rx="3.5" fill="currentColor" /></svg>Profil
      </button>
    </div>
  );
}

/** Bottom sheet: dimmer, grab handle, title, close button. */
export function Sheet({ title, sub, onClose, children, head, z = 40, maxHeight = '90%', scrollBody = false }: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; head?: ReactNode; z?: number; maxHeight?: string; scrollBody?: boolean;
}) {
  return (
    <div className="sheet-layer" style={{ zIndex: z }}>
      <div className="sheet-dim" onClick={onClose} />
      <div className="sheet" style={{ maxHeight, overflow: scrollBody ? 'auto' : undefined }}>
        <div className="grab" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {head}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sheet-title">{title}</div>
            {sub && <div className="sheet-sub">{sub}</div>}
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Schließen">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function UpDown({ onUp, onDown, noUp, noDown }: { onUp: () => void; onDown: () => void; noUp: boolean; noDown: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
      <button className="updown" disabled={noUp} title="Nach oben" onClick={e => { e.stopPropagation(); onUp(); }}><span className="chev-up" /></button>
      <button className="updown" disabled={noDown} title="Nach unten" onClick={e => { e.stopPropagation(); onDown(); }}><span className="chev-down" /></button>
    </div>
  );
}

/** A person's avatar (V1.2): their chosen initial or icon on their chosen color. */
export function Avatar({ person, size = 28, iconScale = 0.55, shadow, label, onDark }: {
  person: { name: string; avatar?: AvatarPref }; size?: number; iconScale?: number; shadow?: string; label?: string;
  /** On a dark card: give the Espresso color a faint ring so the circle doesn't disappear */
  onDark?: boolean;
}) {
  const av = person.avatar || DEFAULT_AVATAR;
  const c = avColor(av.color);
  if (onDark && c.bg === '#2A1F17' && !shadow) shadow = '0 0 0 1.5px rgba(251,245,238,.3)';
  return (
    <span title={label ?? person.name} aria-label={label} role={label ? 'img' : undefined} style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: c.bg, color: c.fg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: Math.round(size * 0.4), fontWeight: 700, flexShrink: 0, fontFamily: 'var(--display)', lineHeight: 1, boxShadow: shadow,
    }}>
      {av.kind === 'icon' && av.icon
        ? <IconGlyph icon={av.icon} color={c.fg} size={Math.round(size * iconScale)} />
        : person.name.charAt(0).toUpperCase()}
    </span>
  );
}

/** V1.5: several people, overlapping (at most `max`, then "+n") */
export function AvatarStack({ people, size = 28, max = 3, onDark, ring = '#FBF5EE' }: {
  people: { name: string; avatar?: AvatarPref }[]; size?: number; max?: number; onDark?: boolean; ring?: string;
}) {
  const shown = people.slice(0, people.length > max ? max - 1 : max), more = people.length - shown.length;
  return (
    <span style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -size * 0.3 : 0, borderRadius: '50%', boxShadow: i ? '0 0 0 2px ' + ring : undefined, display: 'flex' }}>
          <Avatar person={p} size={size} onDark={onDark} />
        </span>
      ))}
      {more > 0 && (
        <span style={{ marginLeft: -size * 0.3, width: size, height: size, borderRadius: '50%', background: '#EADCCD', color: '#6F6055', boxShadow: '0 0 0 2px ' + ring, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.38), fontWeight: 700, flexShrink: 0 }}>+{more}</span>
      )}
    </span>
  );
}

/** A line icon tinted with any color (CSS mask). */
export function IconGlyph({ icon, color, size }: { icon: string; color: string; size: number | string }) {
  const url = `url(${avatarIconUrl(icon)}) center/contain no-repeat`;
  return <span style={{ width: size, height: size, display: 'block', backgroundColor: color, WebkitMask: url, mask: url }} />;
}

export function CatIcon({ src, size, opacity = 0.85, label }: { src: string; size: number; opacity?: number; label?: string }) {
  return <span role="img" aria-label={label} style={{ width: size, height: size, display: 'block', opacity, background: `url(${src}) center/${size}px no-repeat` }} />;
}

/** Measures a glass header, so the content below can start right underneath it (headRef in the prototype). */
export function useHeaderHeight(): [(el: HTMLElement | null) => void, number] {
  const [h, setH] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    if (ro.current) { ro.current.disconnect(); ro.current = null; }
    if (!el || typeof ResizeObserver === 'undefined') return;
    ro.current = new ResizeObserver(() => { const nh = el.offsetHeight; if (nh) setH(nh); });
    ro.current.observe(el);
  }, []);
  return [ref, h];
}

export function RoundCheck({ on, size = 26, color = '#F3752E' }: { on: boolean; size?: number; color?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', border: `2px solid ${on ? color : '#D8CBBD'}`, background: on ? color : '#fff',
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>{on && <span className="check-tick" style={size > 27 ? { width: 11 } : undefined} />}</div>
  );
}

/** A thin line with a small label in the middle ("Ohne feste Reihenfolge", "Gibt’s hier vermutlich nicht") */
export function LabeledRule({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }}>
      <span style={{ flex: 1, height: 1, background: '#E3D5C6', display: 'block' }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D' }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: '#E3D5C6', display: 'block' }} />
    </div>
  );
}

/** V1.8: a subtle outlined chip with a line icon for secondary actions under the route ("Reihenfolge ändern") */
export function ActionChip({ icon, onClick, children }: { icon: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px 0 13px', border: '1.5px solid #EADCCD', borderRadius: 999, background: '#fff', color: '#2A1F17', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
      <span aria-hidden style={{ width: 16, height: 16, display: 'block', opacity: 0.75, background: `url(/icons/${icon}.svg) center/16px no-repeat` }} />
      {children}
    </button>
  );
}

/** A quiet, underlined text button for rarely used actions ("Woanders einkaufen …") */
export function TextLink({ onClick, children, style }: { onClick: () => void; children: ReactNode; style?: CSSProperties }) {
  return (
    <button onClick={onClick} style={{ border: 'none', background: 'none', padding: '12px 8px', minHeight: 44, fontSize: 14, color: '#6F6055', cursor: 'pointer', ...style }}>
      <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#C9B8A6' }}>{children}</span>
    </button>
  );
}
