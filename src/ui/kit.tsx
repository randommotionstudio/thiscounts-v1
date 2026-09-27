import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { LOGOS, logoUrl } from '../lib/logic';
import type { Conn } from '../app/useConnection';
import { AV_COLORS, DEFAULT_AVATAR, avatarIconUrl, type AvatarPref } from '../lib/avatar';

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
  const c = AV_COLORS[av.color] || AV_COLORS[0];
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
