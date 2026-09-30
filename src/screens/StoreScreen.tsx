import { useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import { useTrip } from '../app/useTrip';
import { enterStore, markStoreDone, notifiedItems, reportProgress, seenSet } from '../app/shopping';
import * as actions from '../data/actions';
import {
  CHECK_AFTER, agoText, ageDays, effStore, icon, movePatch, onTrip, posInfo, stopById, storeGroups, storeOrderInfo, storeToStop, tint,
} from '../lib/logic';
import type { Item, Stop } from '../lib/types';
import { Avatar, CatIcon, ConnPill, LogoTile, RoundCheck, Sheet, useHeaderHeight } from '../ui/kit';

export function useCurrentStop(stopId: string): Stop {
  const app = useApp();
  const { route } = useTrip();
  return stopById(stopId, app.data.stores, app.items) || route[0] || (app.mainStore ? storeToStop(app.mainStore) : { id: stopId, name: '–', branch: '', logo: null, categoryOrder: null, custom: true });
}

/** The route glyph used on the "Filiale einrichten" cards */
export function RouteGlyph() {
  return (
    <div style={{ width: 38, height: 38, borderRadius: 12, background: '#F3752E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ display: 'block' }}>
        <polyline points="4,20 9,8 17,18 23,7" fill="none" stroke="#2A1F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points="18.5,7.5 23,7 23.5,11.5" fill="none" stroke="#2A1F17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy="20" r="2.6" fill="#2A1F17" /><circle cx="9" cy="8" r="2.6" fill="#2A1F17" /><circle cx="17" cy="18" r="2.6" fill="#2A1F17" />
      </svg>
    </div>
  );
}

/** Im-Laden-Modus: items grouped by the store's fixed path, with check-off and progress. */
export function StoreScreen({ stopId }: { stopId: string }) {
  const app = useApp();
  const { list, navigate, toast, data, user, other } = app;
  const { route, itemsAt, doneOf, goStore, finish, storeIds } = useTrip();
  const [menu, setMenu] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [headRef, headH] = useHeaderHeight();
  const [notif, setNotif] = useState<{ title: string; body: string } | null>(null);
  const cur = useCurrentStop(stopId);
  const store = cur.custom ? null : data.stores.find(s => s.id === cur.id) || null;

  const curIdx = route.findIndex(s => s.id === cur.id);
  const curItems = itemsAt(cur.id);

  const order = cur.categoryOrder || data.defaultCategoryOrder;
  const orderKey = order.join('|');

  // ---- V1.1 shopping session: written when entering the stop ----
  // Waits for the sessions snapshot, so a reload mid-trip continues the trip instead of starting a new one.
  const [session, setSession] = useState<ReturnType<typeof enterStore>['session'] | null>(null);
  useEffect(() => {
    if (!data.sessionsReady || (session && session.storeId === cur.id)) return;
    const doneStops = route.filter(s => s.id !== cur.id && doneOf(s)).map(s => s.id);
    const r = enterStore(list.id, cur.id, Math.max(curIdx, 0) + 1, route.length, data.sessions[user.uid], doneStops, orderKey);
    // A new trip: items held back for "next time" on an earlier, unfinished trip are back on
    if (r.newTrip) app.items.filter(i => i.nextTrip && i.createdAtMs < r.session.startedAtMs).forEach(i => actions.updateItem(i, { nextTrip: false }));
    setSession(r.session);
  }, [data.sessionsReady, cur.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Added by someone else during this trip → "new" (tag + border, maybe a banner)
  const lateFromOther = (i: Item) => !!session && !!i.createdBy && i.createdBy !== user.uid && i.createdAtMs > session.startedAtMs;
  const floor = session && session.storeId === cur.id && session.orderKey === orderKey ? session.position : 0;
  const pi = posInfo(curItems.map(i => ({ category: i.category, checked: i.checked, lateFromOther: lateFromOther(i) })), order, floor);
  const checkedHere = curItems.filter(i => i.checked).length;
  useEffect(() => { if (session) reportProgress(cur.id, pi.pos, orderKey); }, [session, cur.id, pi.pos, checkedHere, orderKey]);

  // ---- V1.1 in-app banner (R2): a new item lands here in a category we've already passed ----
  // An item counts once it is on the trip *at this stop* — e.g. also after a Rückfrage answered with "mitnehmen".
  useEffect(() => {
    if (!session) return;
    const here = (i: Item) => onTrip(i) && effStore(i, list, storeIds) === cur.id;
    const seen = seenSet(session.startedAtMs, cur.id, () => app.items.filter(here).map(i => i.id));
    for (const i of app.items) {
      if (!here(i) || seen.has(i.id)) continue;
      seen.add(i.id);
      if (notifiedItems.has(i.id) || !lateFromOther(i) || i.checked || !pi.passed(i.category)) continue;
      notifiedItems.add(i.id);
      if (data.notifyWhileShopping) setNotif({ title: other.name + ' hat ' + i.name + ' hinzugefügt', body: i.category + ' hast du schon hinter dir – noch mal kurz zurück?' });
    }
  }, [app.items, session]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = storeGroups(curItems, order);
  const doneCount = curItems.filter(i => i.checked).length;
  const allDone = curItems.length > 0 && doneCount === curItems.length;
  const openAfter = route.slice(curIdx + 1).find(s => !doneOf(s));
  const openBefore = curIdx > 0 ? route.slice(0, curIdx).find(s => !doneOf(s)) : undefined;
  const nextStop = openAfter || openBefore || null, nextIsBack = !openAfter && !!openBefore;
  const openAtNext = nextStop ? itemsAt(nextStop.id).filter(i => !i.checked).length : 0;
  const openHere = curItems.length - doneCount;
  const nextLabel = nextStop
    ? (nextIsBack ? 'Zurück zu ' : 'Weiter zu ') + nextStop.name + (nextIsBack ? ' (' + openAtNext + ' offen)' : allDone ? '' : ' (' + openHere + ' hier offen)')
    : allDone ? 'Einkauf abschließen' : 'Einkauf abschließen (' + openHere + ' offen)';

  const goNext = () => {
    // Items left unchecked here: ask what should happen to them (also at the last stop, for consistency)
    if (openHere > 0) { setMenu(false); setLeaving(true); return; }
    if (!nextStop) { finish(); return; }
    if (allDone) markStoreDone(cur.id);
    goStore(nextStop.id);
  };
  // The last tick reached the list a moment after the tap (or the other person checked the rest):
  // nothing is open any more, so carry on as if the popup had never opened instead of showing "Noch 0 Artikel offen".
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;
  useEffect(() => {
    if (leaving && openHere === 0) { setLeaving(false); goNextRef.current(); }
  }, [leaving, openHere]);
  const leaveWithOpenItems = (takeAlong: boolean) => {
    // Last stop: the open items simply stay on the list with their store when the trip ends
    if (!nextStop) { setLeaving(false); finish(); return; }
    const open = curItems.filter(i => !i.checked);
    const n = open.length, one = n === 1 ? open[0].name : null;
    if (takeAlong) {
      actions.moveOpenItems(open, movePatch(nextStop, list));
      toast(one ? one + ' wandert zu ' + nextStop.name : n + ' Artikel wandern zu ' + nextStop.name);
    } else {
      actions.keepOpenItemsOnList(open);
      toast(one ? one + ' bleibt auf der Einkaufsliste' : n + ' Artikel bleiben auf der Einkaufsliste');
    }
    setLeaving(false);
    markStoreDone(cur.id);
    goStore(nextStop.id);
  };
  const skipStore = () => {
    const rest = route.filter(s => s.id !== cur.id && !doneOf(s));
    actions.updateList(list.id, { deferred: [...list.deferred.filter(x => x !== cur.id), cur.id] });
    setMenu(false);
    if (rest.length) goStore(rest[0].id); else navigate(paths.plan);
    toast(cur.name + ' auf später verschoben');
  };

  // ---- V1.1 Filiale einrichten: which entry to show ----
  const orderInfo = store ? storeOrderInfo(store) : null;
  const age = orderInfo ? ageDays(orderInfo.checkedAtMs, Date.now()) : null;
  const refineState = !orderInfo ? null : !orderInfo.isSet ? 'offer' : age != null && age >= CHECK_AFTER ? 'check' : 'cooldown';
  const goRefine = () => navigate(paths.refine(cur.id));

  return (
    <div className="screen">
      <div ref={headRef} style={{ padding: 'calc(var(--safe-top) + 20px) 20px 12px', background: '#2A1F17', color: '#FBF5EE' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className="back-link" style={{ color: '#F8C5A0' }} onClick={() => navigate(paths.plan)}>‹ Zum Plan</button>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#C9B8A6' }}>Stopp {Math.max(curIdx, 0) + 1} von {route.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
          <LogoTile store={cur} size={44} radius={12} initialSize={18} bordered={false} />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 26, lineHeight: 1.1, margin: '0 0 2px' }}>{cur.name}</h1>
            <div style={{ fontSize: 13, color: '#C9B8A6' }}>{cur.custom ? '' : cur.branch}</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#4A3B2E', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#F3752E', borderRadius: 3, width: (curItems.length ? Math.round(doneCount / curItems.length * 100) : 100) + '%', transition: 'width .3s' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{doneCount} von {curItems.length}</span>
        </div>
        {app.conn !== 'online' && <div style={{ display: 'flex', marginTop: 10 }}><ConnPill conn={app.conn} dark /></div>}
      </div>
      <div className="scroll" style={{ padding: '16px 20px calc(var(--safe-bottom) + 140px)' }}>
        <div style={{ fontSize: 13, color: '#8A7A6D', marginBottom: 12 }}>Sortiert nach dem Weg durch diese Filiale</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groups.map((g, n) => (
            <div key={g.dept}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: tint(g.dept), color: '#2A1F17', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n + 1}</span>
                <CatIcon src={icon(g.dept)} size={16} opacity={0.7} label={g.label} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#6F6055', textTransform: 'uppercase', letterSpacing: '.05em' }}>{g.label}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map(i => {
                  const isNew = lateFromOther(i) && !i.checked;
                  const passed = isNew && pi.passed(i.category);
                  return (
                    <div key={i.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 0 #EADCCD', border: `2px solid ${isNew ? '#F3752E' : '#fff'}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 8px 8px 12px', minHeight: 60 }}>
                      <div onClick={() => actions.setChecked(i, !i.checked)} role="checkbox" aria-checked={i.checked} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', minWidth: 0, alignSelf: 'stretch' }}>
                        <RoundCheck on={i.checked} size={28} color="#3E9B5F" />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 17, color: i.checked ? '#8A7A6D' : '#2A1F17', textDecoration: i.checked ? 'line-through' : 'none', overflowWrap: 'break-word', hyphens: 'auto' }}>{i.name}</div>
                          {i.qty && <div style={{ fontSize: 12, color: '#8A7A6D' }}>{i.qty}</div>}
                          {isNew && (
                            <div style={{ display: 'flex', marginTop: 4 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '3px 9px', background: passed ? '#F3752E' : '#FDE4D1', color: passed ? '#2A1F17' : '#9C4412', whiteSpace: 'nowrap', animation: 'pop .25s ease' }}>
                                {passed ? 'Neu · schon vorbei' : 'Neu von ' + other.name}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); navigate(paths.missing(cur.id, i.id)); }} style={{ height: 40, padding: '0 12px', border: 'none', borderRadius: 12, background: '#F3EADF', color: '#6F6055', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Nicht gefunden</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {!curItems.length && <div style={{ textAlign: 'center', color: '#8A7A6D', padding: '30px 0' }}>Hier ist nichts mehr zu holen.</div>}

        {refineState === 'cooldown' && (
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
            <button onClick={goRefine} style={{ border: 'none', background: 'none', padding: '12px 8px', minHeight: 44, fontSize: 14, color: '#6F6055', cursor: 'pointer' }}>
              <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#C9B8A6' }}>Aufbau der Filiale geändert?</span>
            </button>
          </div>
        )}
        {refineState === 'check' && store && (
          <div style={{ marginTop: 20, background: '#FDE4D1', borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <RouteGlyph />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Stimmt dein Weg noch?</div>
                <div style={{ fontSize: 13, color: '#9C4412' }}>Gespeichert {agoText(age)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { actions.confirmStoreOrder(store.id); toast('Danke! Weg bei ' + cur.name + ' bestätigt'); }} style={{ flex: 1, height: 44, borderRadius: 14, border: '2px solid #F3752E', background: 'transparent', color: '#2A1F17', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Passt noch</button>
              <button onClick={goRefine} style={{ flex: 1, height: 44, borderRadius: 14, border: 'none', background: '#F3752E', color: '#2A1F17', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Anpassen</button>
            </div>
          </div>
        )}
        {refineState === 'offer' && (
          <div onClick={goRefine} style={{ marginTop: 20, background: '#FDE4D1', borderRadius: 18, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <RouteGlyph />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>Hilf mit, diese Filiale genauer zu machen</div>
              <div style={{ fontSize: 13, color: '#9C4412' }}>Abteilungs-Reihenfolge antippen</div>
            </div>
            <span style={{ color: '#9C4412', fontSize: 20 }}>›</span>
          </div>
        )}
      </div>
      {app.toastText && <div className={'toast-inline toast-overlay' + (app.toastLeaving ? ' toast-leaving' : '')} role="status" style={{ top: headH + 16 }}>{app.toastText}</div>}
      <div className="bottom-fade" style={{ padding: '24px 20px calc(var(--safe-bottom) + 20px)' }}>
        {notif && (
          <div role="status" style={{ marginBottom: 10, background: '#2A1F17', color: '#FBF5EE', borderRadius: 20, padding: '12px 10px 12px 14px', boxShadow: '0 14px 34px rgba(42,31,23,.3)', display: 'flex', alignItems: 'flex-start', gap: 12, animation: 'toastIn .3s ease' }}>
            <Avatar person={other} size={36} onDark />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{notif.title}</div>
              <div style={{ fontSize: 13, color: '#C9B8A6', marginTop: 2, textWrap: 'pretty' }}>{notif.body}</div>
            </div>
            <button onClick={() => setNotif(null)} aria-label="Schließen" style={{ border: 'none', background: 'rgba(251,245,238,.12)', color: '#FBF5EE', width: 36, height: 36, borderRadius: '50%', fontSize: 18, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>×</button>
          </div>
        )}
        {menu && (
          <div style={{ marginBottom: 10, background: 'rgba(255,253,250,.6)', WebkitBackdropFilter: 'blur(22px) saturate(1.6)', backdropFilter: 'blur(22px) saturate(1.6)', border: '1px solid rgba(255,255,255,.75)', borderRadius: 22, boxShadow: '0 12px 32px rgba(42,31,23,.16)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'toastIn .2s ease' }}>
            <button onClick={skipStore} style={{ textAlign: 'left', padding: '12px 16px', border: 'none', background: 'none', cursor: 'pointer', color: '#2A1F17' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Diesen Laden überspringen</div>
              <div style={{ fontSize: 13, color: '#8A7A6D' }}>Kommt ans Ende der Route – offene Artikel bleiben hier.</div>
            </button>
            <button onClick={() => navigate(paths.plan)} style={{ textAlign: 'left', height: 48, padding: '0 16px', border: 'none', borderTop: '1px solid #EADCCD', background: 'none', fontSize: 15, fontWeight: 600, color: '#2A1F17', cursor: 'pointer' }}>Zum Plan</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={goNext} className="ellipsis" style={{ flex: 1, minWidth: 0, height: 56, borderRadius: 999, border: '1px solid rgba(255,255,255,.55)', background: allDone ? '#F3752E' : '#F3EADF', color: '#2A1F17', fontSize: 17, fontWeight: 700, cursor: 'pointer', boxShadow: '0 10px 28px rgba(42,31,23,.18), inset 0 1px 0 rgba(255,255,255,.55)', padding: '0 16px' }}>{nextLabel}</button>
          <button onClick={() => setMenu(m => !m)} title="Mehr" style={{ width: 56, height: 56, border: '1px solid rgba(255,255,255,.75)', borderRadius: 999, background: 'rgba(255,253,250,.42)', WebkitBackdropFilter: 'blur(18px) saturate(1.5)', backdropFilter: 'blur(18px) saturate(1.5)', boxShadow: '0 10px 30px rgba(42,31,23,.16), inset 0 1px 0 rgba(255,255,255,.9)', color: '#2A1F17', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'block' }} />
          </button>
        </div>
      </div>
      {leaving && (
        <Sheet
          title={'Noch ' + openHere + ' Artikel offen'}
          sub={'Was soll mit den übrigen Artikeln von ' + cur.name + ' passieren?'}
          onClose={() => setLeaving(false)}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, maxHeight: 132, overflow: 'auto', flexShrink: 0 }}>
            {curItems.filter(i => !i.checked).map(i => (
              <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: tint(i.category), color: '#2A1F17' }}>{i.name}</span>
            ))}
          </div>
          {nextStop && (
            <button onClick={() => leaveWithOpenItems(true)} className="ellipsis" style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0, padding: '0 16px' }}>
              Alle zu {nextStop.name} mitnehmen
            </button>
          )}
          {nextStop ? (
            <button onClick={() => leaveWithOpenItems(false)} style={{ marginTop: 10, width: '100%', minHeight: 52, border: '2px solid #2A1F17', borderRadius: 999, background: 'transparent', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              Auf der Einkaufsliste lassen
            </button>
          ) : (
            <button onClick={() => leaveWithOpenItems(false)} style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              Auf der Einkaufsliste lassen
            </button>
          )}
          <div style={{ fontSize: 13, color: '#8A7A6D', textAlign: 'center', margin: '10px 8px 0', textWrap: 'pretty' }}>Sie behalten ihren Laden und sind beim nächsten Einkauf wieder dabei.</div>
        </Sheet>
      )}
    </div>
  );
}
