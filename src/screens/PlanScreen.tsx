import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import { useTrip } from '../app/useTrip';
import * as actions from '../data/actions';
import { effStore, moveInOrder, onTrip, storesInTown, tint, townsOf } from '../lib/logic';
import type { Stop } from '../lib/types';
import { StoreSheet } from '../sheets/StoreSheet';
import { ConnPill, LogoTile, Sheet, TabBar, UpDown, useHeaderHeight } from '../ui/kit';

const ACC = '#F3752E', LINE = '#EADCCD', PALE = '#F3EADF', INK = '#2A1F17';

const menuBtn = (first: boolean) => ({ textAlign: 'left' as const, height: 48, padding: '0 14px', border: 'none', borderTop: first ? 'none' : '1px solid #EADCCD', background: 'none', fontSize: 15, fontWeight: 600, color: INK, cursor: 'pointer' });

function Dots({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button onClick={onClick} title="Mehr" className="dots" style={{ width: 36, height: 36, border: 'none', borderRadius: '50%', background: 'none', color: '#6F6055', cursor: 'pointer', flexShrink: 0, marginRight: -8, padding: 0 }}>
      <span /><span /><span />
    </button>
  );
}

export function PlanScreen() {
  const app = useApp();
  const { list, items, navigate, toast } = app;
  const { route, itemsAt, doneOf, nextStore, goStore, finish, unavailable, temp, previewIn, orderIn } = useTrip();
  const [planSort, setPlanSort] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [headRef, headH] = useHeaderHeight();
  const [elsewhere, setElsewhere] = useState<'pick' | 'new' | null>(null);
  const [townPick, setTownPick] = useState(false);
  const [askStandIn, setAskStandIn] = useState<string | null>(null);
  const multiTown = app.towns.length >= 2;
  const awayTown = multiTown && app.town !== app.towns[0]?.id ? app.town : null;

  // "Woanders einkaufen": the whole list at any store, nothing gets reassigned
  const openItems = items.filter(i => !i.checked && !i.pendingDecision && !i.nextTrip).length;
  const startSpontaneous = (storeId: string, townId: string | null = app.town) => {
    setElsewhere(null);
    if (townId !== app.town) app.setTown(townId);
    app.setCurrentStop('spontan:' + storeId);
    navigate(paths.spontan(storeId));
  };
  const chooseTown = (id: string) => {
    setTownPick(false); setMenu(null); setPlanSort(false);
    if (id === app.town) return;
    app.setTown(id);
    const p = previewIn(id);
    // Stores missing there: ask whether their items should go to stores in that town for this trip
    if (p.missing.length && p.stores.length) setAskStandIn(id);
    else toast('Heute in ' + (app.towns.find(t => t.id === id)?.name || ''));
  };

  // V1.4: items whose store has no branch in this town, grouped by store
  const allIds = new Set(app.data.stores.map(s => s.id));
  const storeName = (id: string | null) => app.data.stores.find(s => s.id === id)?.name || '';
  const tempItems = items.filter(i => onTrip(i) && temp(i));
  // Store names in the household's store order ("Netto, Edeka"), not in the order the items came in
  const inStoreOrder = (ids: (string | null)[]) => app.data.stores.filter(s => ids.includes(s.id)).map(s => s.name);
  const tempFrom = inStoreOrder(tempItems.map(i => temp(i)!.from));
  const waiting = app.data.stores
    .map(s => ({ store: s, items: unavailable.filter(i => effStore(i, list, allIds) === s.id) }))
    .filter(g => g.items.length);
  const spontaneousId = app.currentStop && app.currentStop.startsWith('spontan:') ? app.currentStop.slice(8) : null;
  const spontaneousStore = spontaneousId ? app.data.stores.find(s => s.id === spontaneousId) || null : null;

  const plannedN = route.filter(s => !s.custom).length;
  const sortMin = route[0] && route[0].id === list.mainStoreId ? 1 : 0;
  const canSortPlan = plannedN - sortMin >= 2;
  const parked = items.filter(i => i.parked);

  const moveTrip = (id: string, dir: -1 | 1) => {
    const ids = route.filter(s => !s.custom).map(s => s.id);
    const next = moveInOrder(ids, id, dir, ids[0] === list.mainStoreId ? 1 : 0);
    if (!next) return;
    // In another town the order is remembered for that town (it also decides where stand-in items go)
    if (awayTown) actions.setTownOrder(list.id, awayTown, [...next, ...(orderIn(awayTown) || []).filter(x => !next.includes(x))]);
    else actions.updateList(list.id, { tripOrder: next, deferred: [] });
  };
  const allHere = (s: Stop) => {
    const n = items.filter(onTrip).length;
    actions.allHere(items, list, s.id);
    setMenu(null);
    goStore(s.id);
    toast('Alle ' + n + ' Artikel jetzt bei ' + s.name + ' · nur ein Stopp');
  };
  const defer = (s: Stop) => {
    actions.updateList(list.id, { deferred: [...list.deferred.filter(x => x !== s.id), s.id] });
    setMenu(null);
    toast(s.name + ' ans Ende der Route verschoben');
  };

  const card = (s: Stop, idx: number) => {
    const isMainStop = idx === 0 && s.id === list.mainStoreId;
    const sorting = planSort && !s.custom;
    const its = itemsAt(s.id), done = doneOf(s);
    const isCur = s.id === app.currentStop, isNext = !!nextStore && s.id === nextStore.id;
    const key = 'stop:' + s.id, menuOpen = menu === key;
    const toggleMenu = (e: React.MouseEvent) => { e.stopPropagation(); setMenu(m => (m === key ? null : key)); };
    const status = (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, padding: '3.5px 10px', borderRadius: 999, border: `1.5px solid ${done ? '#B9DFC4' : LINE}`, color: done ? '#2E6B41' : '#6F6055', whiteSpace: 'nowrap' }}>{done ? 'Erledigt' : its.length + ' Artikel'}</span>
        {its.map(i => {
          const t = temp(i);
          return (
            <span key={i.id} title={t ? 'statt ' + storeName(t.from) : undefined} style={{ fontSize: 13, padding: t ? '3.5px 8.5px' : '5px 10px', borderRadius: 999, background: i.checked ? PALE : tint(i.category), color: i.checked ? '#8A7A6D' : INK, textDecoration: i.checked ? 'line-through' : 'none', border: t ? '1.5px dashed rgba(42,31,23,.35)' : 'none' }}>{i.name}</span>
          );
        })}
      </div>
    );
    if (s.custom) {
      return (
        <div key={s.id} className="card" style={{ border: '2px solid #fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: done ? '#B9DFC4' : isCur ? ACC : PALE, border: '2px dashed #F3752E', boxSizing: 'border-box', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>?</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#8A7A6D' }}>Einmaliger Stopp</div>
            </div>
            <Dots onClick={toggleMenu} />
          </div>
          {menuOpen && (
            <div style={{ marginTop: 10, background: '#FBF5EE', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <button onClick={() => goStore(s.id)} style={menuBtn(true)}>Mit diesem Stopp starten</button>
            </div>
          )}
          {status}
        </div>
      );
    }
    return (
      <div key={s.id} className="card" style={{ border: '2px solid #fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: done ? '#B9DFC4' : isCur ? ACC : PALE, boxShadow: !done && isNext && !isCur ? 'inset 0 0 0 2px ' + ACC : 'none', color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{idx + 1}</div>
          <LogoTile store={s} size={36} radius={10} initialSize={15} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
            <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
          </div>
          {!sorting && <Dots onClick={toggleMenu} />}
          {sorting && !isMainStop && <UpDown onUp={() => moveTrip(s.id, -1)} onDown={() => moveTrip(s.id, 1)} noUp={idx <= sortMin} noDown={idx >= plannedN - 1} />}
          {sorting && isMainStop && <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', flexShrink: 0 }}>immer zuerst</span>}
        </div>
        {menuOpen && !sorting && (
          <div style={{ marginTop: 10, background: '#FBF5EE', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => goStore(s.id)} style={menuBtn(true)}>Mit diesem Laden starten</button>
            {!done && route.length > 1 && (
              <button onClick={() => allHere(s)} style={menuBtn(false)}>Alles hier einkaufen <span style={{ color: '#8A7A6D', fontWeight: 500 }}>· nur ein Stopp</span></button>
            )}
            <button onClick={() => defer(s)} style={menuBtn(false)}>Später erledigen</button>
          </div>
        )}
        {status}
        {!done && !isNext && (
          <button onClick={() => goStore(s.id)} style={{ marginTop: 12, width: '100%', height: 44, border: '2px solid #EADCCD', borderRadius: 14, background: '#fff', color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Stattdessen hier starten</button>
        )}
      </div>
    );
  };

  const planned = route.map((s, i) => [s, i] as const).filter(([s]) => !s.custom);
  const manual = route.map((s, i) => [s, i] as const).filter(([s]) => s.custom);

  return (
    <div className="screen">
      <div ref={headRef} className="glass-head" style={{ padding: 'calc(var(--safe-top) + 20px) 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px', fontSize: 13, color: '#8A7A6D', fontWeight: 600, minHeight: 24 }}>
          <span>{route.length} {route.length === 1 ? 'Stopp' : 'Stopps'} · {list.name}</span>
          <ConnPill conn={app.conn} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 0 0' }}>
          <h1 className="h1" style={{ margin: 0 }}>Deine Route</h1>
          {multiTown && (
            <button onClick={() => setTownPick(true)} aria-label={'Ort wählen, gerade ' + app.townName} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: PALE, color: INK, borderRadius: 999, padding: '0 12px 0 14px', height: 36, fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 1, minWidth: 0 }}>
              <span className="ellipsis">in {app.townName}</span>
              <span style={{ width: 6, height: 6, borderRight: '2px solid #2A1F17', borderBottom: '2px solid #2A1F17', transform: 'translateY(-2px) rotate(45deg)', display: 'block', flexShrink: 0 }} />
            </button>
          )}
        </div>
      </div>
      <div className="scroll" style={{ padding: '0 20px calc(var(--safe-bottom) + 160px)', paddingTop: headH ? headH + 14 : 'calc(var(--safe-top) + 98px)' }}>
        {parked.length > 0 && <div style={{ marginBottom: 12, fontSize: 13, color: '#8A7A6D' }}>{parked.map(i => i.name).join(', ') + (parked.length > 1 ? ' warten' : ' wartet') + ' auf der Liste ohne Laden.'}</div>}
        {!route.length && (
          <div style={{ textAlign: 'center', padding: '30px 12px' }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 19 }}>{waiting.length ? 'In ' + app.townName + ' gibt’s nichts zu holen' : 'Noch keine Stopps'}</div>
            <div style={{ fontSize: 14, color: '#8A7A6D', marginTop: 4 }}>{waiting.length ? 'Deine offenen Artikel gibt’s nur in einem anderen Ort.' : 'Setz etwas auf die Liste – dann planen wir die Route.'}</div>
          </div>
        )}
        {canSortPlan && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 4px 0' }}>
            <div className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#6F6055' }}>Reihenfolge · <span style={{ fontWeight: 600, color: INK }}>{awayTown ? 'für ' + app.townName : list.tripOrder ? 'nur für diesen Einkauf' : 'deine Reihenfolge'}</span></div>
            {awayTown && list.townOrder[awayTown] && (
              <button onClick={() => { actions.setTownOrder(list.id, awayTown, null); setPlanSort(false); toast('Reihenfolge zurückgesetzt'); }} style={{ border: 'none', background: 'none', padding: '6px 0', color: '#8A7A6D', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Zurücksetzen</button>
            )}
            {!awayTown && list.tripOrder && (
              <button onClick={() => { actions.updateList(list.id, { tripOrder: null }); setPlanSort(false); toast('Reihenfolge zurückgesetzt'); }} style={{ border: 'none', background: 'none', padding: '6px 0', color: '#8A7A6D', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Zurücksetzen</button>
            )}
            <button onClick={() => { setPlanSort(v => !v); setMenu(null); }} style={{ border: 'none', background: planSort ? ACC : PALE, color: INK, borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, minHeight: 36 }}>{planSort ? 'Fertig' : 'Ändern'}</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {planned.map(([s, i]) => card(s, i))}
          {manual.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 4px 0' }}>
              <span style={{ flex: 1, height: 1, background: '#E3D5C6', display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D' }}>Ohne feste Reihenfolge</span>
              <span style={{ flex: 1, height: 1, background: '#E3D5C6', display: 'block' }} />
            </div>
          )}
          {manual.map(([s, i]) => card(s, i))}
        </div>
        {app.standIn && tempItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 4px 0', fontSize: 13, color: '#6F6055' }}>
            <span style={{ width: 16, height: 10, border: '1.5px dashed rgba(42,31,23,.45)', borderRadius: 999, flexShrink: 0, display: 'block' }} />
            <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty' }}>Heute statt {tempFrom.join(', ')} – ihr gewohnter Laden bleibt.</span>
            <button onClick={() => { app.setStandIn(false); toast('Ersatz aufgehoben'); }} style={{ border: 'none', background: 'none', padding: '6px 0', color: '#8A7A6D', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Aufheben</button>
          </div>
        )}
        {waiting.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 4px 10px' }}>
              <span style={{ flex: 1, height: 1, background: '#E3D5C6', display: 'block' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D' }}>Gibt’s in {app.townName} nicht</span>
              <span style={{ flex: 1, height: 1, background: '#E3D5C6', display: 'block' }} />
            </div>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(255,255,255,.6)' }}>
              {waiting.map(g => {
                const where = townsOf(g.store, app.towns).filter(t => t.id !== app.town).map(t => t.name);
                return (
                  <div key={g.store.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <LogoTile store={g.store} size={28} radius={8} initialSize={12} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>{g.store.name}</div>
                        {where.length > 0 && <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>gibt’s in {where.join(', ')}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {g.items.map(i => <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: PALE, color: '#6F6055' }}>{i.name}</span>)}
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 12, color: '#8A7A6D', textWrap: 'pretty' }}>Bleiben auf der Liste, bis du wieder dort einkaufst.</div>
              {app.town && !app.standIn && previewIn(app.town).stores.length > 0 && previewIn(app.town).missing.length > 0 && (
                <button onClick={() => setAskStandIn(app.town)} style={{ height: 40, border: '2px solid #EADCCD', borderRadius: 12, background: '#fff', color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Heute in {app.townName} ersetzen …</button>
              )}
            </div>
          </div>
        )}
        {openItems > 0 && app.data.stores.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <button onClick={() => setElsewhere('pick')} style={{ border: 'none', background: 'none', padding: '12px 8px', minHeight: 44, fontSize: 14, color: '#6F6055', cursor: 'pointer' }}>
              <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#C9B8A6' }}>Woanders einkaufen …</span>
            </button>
          </div>
        )}
      </div>
      <div className="bottom-fade" style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'none', paddingTop: 24 }}>
        {route.length > 0 && (
          <div style={{ padding: '0 20px 10px', pointerEvents: 'auto' }}>
            {spontaneousStore ? (
              <button className="cta" onClick={() => navigate(paths.spontan(spontaneousStore.id))}>Weiter einkaufen bei {spontaneousStore.name}</button>
            ) : (
              <button className="cta" onClick={() => (nextStore ? goStore(nextStore.id) : finish())}>
                {!nextStore ? 'Einkauf abschließen' : app.currentStop ? 'Weiter einkaufen bei ' + nextStore.name : 'Einkauf starten bei ' + nextStore.name}
              </button>
            )}
          </div>
        )}
        <TabBar active="plan" go={navigate} />
      </div>
      {elsewhere === 'pick' && (
        <Sheet title="Woanders einkaufen" sub="Du siehst deine ganze Liste in diesem Laden. Was du nicht abhakst, bleibt bei seinem Laden." onClose={() => setElsewhere(null)} scrollBody>
          {(multiTown ? [...app.towns].sort((a, b) => (a.id === app.town ? -1 : b.id === app.town ? 1 : 0)) : [null]).map(t => (
          <div key={t ? t.id : 'all'} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {t && <div className="section-label" style={{ margin: '4px 4px 0' }}>In {t.name}</div>}
            {(t ? storesInTown(app.data.stores, app.towns, t.id) : app.data.stores).map(s => (
              <button key={s.id} onClick={() => startSpontaneous(s.id, t ? t.id : app.town)} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '10px 12px', minHeight: 60, border: '2px solid #EADCCD', borderRadius: 16, background: '#fff', color: INK, cursor: 'pointer' }}>
                <LogoTile store={s} size={36} radius={10} initialSize={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontWeight: 600 }}>{s.name}</div>
                  <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{s.branch || 'Eigener Laden'}</div>
                </div>
                <span style={{ color: '#8A7A6D', fontSize: 20 }}>›</span>
              </button>
            ))}
          </div>
          ))}
          <button onClick={() => setElsewhere('new')} style={{ marginTop: 10, border: 'none', background: 'none', padding: '12px 8px', minHeight: 44, fontSize: 14, color: '#6F6055', cursor: 'pointer', alignSelf: 'center' }}>
            <span style={{ textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: '#C9B8A6' }}>Laden fehlt? Neu anlegen</span>
          </button>
        </Sheet>
      )}
      {askStandIn && (() => {
        const p = previewIn(askStandIn);
        const tName = app.towns.find(t => t.id === askStandIn)?.name || '';
        const from = inStoreOrder(p.missing.map(i => effStore(i, list, allIds)));
        const groups = p.stores.map(s => ({ store: s, items: p.missing.filter(i => p.stopOf(i) === s.id) })).filter(g => g.items.length);
        const close = () => { setAskStandIn(null); };
        return (
          <Sheet title={from.join(' und ') + ' gibt’s in ' + tName + ' nicht'} sub={'Sollen ' + (p.missing.length === 1 ? 'der Artikel' : 'die ' + p.missing.length + ' Artikel') + ' bei diesem Einkauf in ' + tName + ' mit? Ihr gewohnter Laden bleibt.'} onClose={close} scrollBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
              {groups.map(g => (
                <div key={g.store.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <LogoTile store={g.store} size={28} radius={8} initialSize={12} />
                    <div className="ellipsis" style={{ fontWeight: 600, fontSize: 14 }}>{g.store.name}</div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {g.items.map(i => {
                      const maybe = p.temp(i)?.maybeNot;
                      return <span key={i.id} style={{ fontSize: 13, padding: '5px 10px', borderRadius: 999, background: maybe ? 'transparent' : tint(i.category), border: maybe ? '1.5px dashed #D8CBBD' : 'none', color: maybe ? '#8A7A6D' : INK }}>{i.name}</span>;
                    })}
                  </div>
                </div>
              ))}
              {groups.some(g => g.items.some(i => p.temp(i)?.maybeNot)) && (
                <div style={{ fontSize: 12, color: '#8A7A6D', textWrap: 'pretty' }}>Gestrichelt: gibt’s dort laut eurem Weg vermutlich nicht – steht im Laden ganz unten.</div>
              )}
            </div>
            <button onClick={() => { app.setStandIn(true); close(); toast('Heute in ' + tName + ' · ' + p.missing.length + ' Artikel woanders'); }} style={{ marginTop: 20, width: '100%', height: 52, border: 'none', borderRadius: 999, background: ACC, color: INK, fontSize: 16, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Ja, heute dort einkaufen</button>
            <button onClick={() => { app.setStandIn(false); close(); toast('Heute in ' + tName); }} style={{ marginTop: 10, width: '100%', minHeight: 52, border: '2px solid #2A1F17', borderRadius: 999, background: 'transparent', color: INK, fontSize: 15, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Nein, auf der Liste lassen</button>
          </Sheet>
        );
      })()}
      {townPick && (
        <Sheet title="Wo kaufst du heute ein?" sub={'Gilt nur für dich und nur für diesen Einkauf. Danach geht’s wieder in ' + app.towns[0]?.name + ' los.'} onClose={() => setTownPick(false)} scrollBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {app.towns.map(t => {
              const here = storesInTown(app.data.stores, app.towns, t.id), on = t.id === app.town;
              return (
                <button key={t.id} onClick={() => chooseTown(t.id)} aria-pressed={on} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '12px 14px', minHeight: 62, border: `2px solid ${on ? ACC : LINE}`, borderRadius: 16, background: on ? '#FDE4D1' : '#fff', color: INK, cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div className="ellipsis" style={{ fontSize: 12, color: '#8A7A6D' }}>{here.length + (here.length === 1 ? ' Laden' : ' Läden') + (here.length ? ' · ' + here.map(s => s.name).join(', ') : '')}</div>
                  </div>
                  {on && <span style={{ width: 24, height: 24, borderRadius: '50%', background: ACC, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><span className="check-tick" style={{ borderColor: INK }} /></span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}
      {elsewhere === 'new' && (
        <StoreSheet initial={{ mode: 'new', name: '', branch: '', logo: null }} towns={app.towns} defaultTown={app.town} onClose={() => setElsewhere('pick')}
          onSave={v => { const id = actions.saveStore(v, null); toast('„' + v.name + '“ gespeichert'); startSpontaneous(id, v.town ?? app.towns[0]?.id ?? null); }} />
      )}
    </div>
  );
}
