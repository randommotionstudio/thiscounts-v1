import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import { useTrip } from '../app/useTrip';
import * as actions from '../data/actions';
import { effStore, moveInOrder, onTrip, townsOf } from '../lib/logic';
import type { Item, Stop } from '../lib/types';
import { ElsewhereSheet } from '../sheets/ElsewhereSheet';
import { StandInSheet } from '../sheets/StandInSheet';
import { StoreSheet } from '../sheets/StoreSheet';
import { TownSheet } from '../sheets/TownSheet';
import { Avatar, ConnPill, LabeledRule, TabBar, TextLink, useHeaderHeight } from '../ui/kit';
import { StopCard } from './plan/StopCard';
import { WaitingSection } from './plan/WaitingSection';

const ACC = '#F3752E', PALE = '#F3EADF', INK = '#2A1F17';

const resetBtn = { border: 'none', background: 'none', padding: '6px 0', color: '#8A7A6D', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 } as const;

/** Plan: the route of this trip – in the chosen town, with stand-ins and what waits for another town */
export function PlanScreen() {
  const app = useApp();
  const { list, items, navigate, toast, data } = app;
  const { route, fullRoute, onlyStop, goOnly, itemsAt, doneOf, nextStore, goStore, finish, unavailable, temp, previewIn, orderIn } = useTrip();
  const [planSort, setPlanSort] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [headRef, headH] = useHeaderHeight();
  const [elsewhere, setElsewhere] = useState<'pick' | 'new' | null>(null);
  const [townPick, setTownPick] = useState(false);
  const [askStandIn, setAskStandIn] = useState<string | null>(null);
  const multiTown = app.towns.length >= 2;
  // V1.5: one person shops at a time – while someone else is on a trip with this list, nobody else starts one
  const locked = !!app.shopper && !app.currentStop;
  const awayTown = multiTown && app.town !== app.towns[0]?.id ? app.town : null;

  // Store names in the household's store order ("Netto, Edeka"), not in the order the items came in
  const inStoreOrder = (ids: (string | null)[]) => data.stores.filter(s => ids.includes(s.id)).map(s => s.name);
  const storeName = (id: string | null) => data.stores.find(s => s.id === id)?.name || '';
  const insteadOf = (i: Item) => { const t = temp(i); return t ? storeName(t.from) : null; };

  // V1.4: what stand-ins would do here (for "Heute in … ersetzen") and in the town being asked about
  const herePreview = useMemo(() => (app.town ? previewIn(app.town) : null), [previewIn, app.town]);
  const askPreview = useMemo(() => (askStandIn ? previewIn(askStandIn) : null), [previewIn, askStandIn]);

  // V1.4: items whose store has no branch in this town, grouped by store
  const allIds = new Set(data.stores.map(s => s.id));
  const waiting = data.stores
    .map(s => ({ store: s, items: unavailable.filter(i => effStore(i, list, allIds) === s.id) }))
    .filter(g => g.items.length);
  const tempItems = items.filter(i => onTrip(i) && temp(i));

  // "Woanders einkaufen": the whole list at any store, nothing gets reassigned
  const openItems = items.filter(i => !i.checked && !i.pendingDecision && !i.nextTrip).length;
  const spontaneousId = app.currentStop && app.currentStop.startsWith('spontan:') ? app.currentStop.slice(8) : null;
  const spontaneousStore = spontaneousId ? data.stores.find(s => s.id === spontaneousId) || null : null;
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
  const answerStandIn = (yes: boolean) => {
    const tName = app.towns.find(t => t.id === askStandIn)?.name || '';
    app.setStandIn(yes);
    toast(yes ? 'Heute in ' + tName + ' · ' + (askPreview?.missing.length ?? 0) + ' Artikel woanders' : 'Heute in ' + tName);
    setAskStandIn(null);
  };

  // Sorting: stores you've already been to on this trip stay where they are, and so does the main store ("immer zuerst") –
  // unless it was put off this trip with "Später erledigen": then it moves like any other store
  const plannedIds = route.filter(s => !s.custom).map(s => s.id);
  const fixedLabel = (id: string) => (id === app.currentStop ? 'gerade hier' : app.visited.includes(id) ? 'schon besucht' : id === list.mainStoreId && !list.mainFree ? 'immer zuerst' : null);
  const sortable = plannedIds.filter(id => !fixedLabel(id));
  const canSortPlan = sortable.length >= 2;
  // Nothing left to sort (e.g. after a change on the other phone) → sort mode ends by itself
  const sorting = planSort && canSortPlan;
  useEffect(() => { if (!canSortPlan) setPlanSort(false); }, [canSortPlan]);
  const parked = items.filter(i => i.parked);

  const moveTrip = (id: string, dir: -1 | 1) => {
    const moved = moveInOrder(sortable, id, dir);
    if (!moved) return;
    const next = [...plannedIds.filter(x => app.visited.includes(x)), ...moved];
    // In another town the order is remembered for that town (it also decides where stand-in items go)
    if (awayTown) actions.setTownOrder(list.id, awayTown, [...next, ...(orderIn(awayTown) || []).filter(x => !next.includes(x))]);
    else actions.updateList(list.id, { tripOrder: next, deferred: [] });
  };
  // Back to the usual order: main store first again, nothing put off
  const resetOrder = () => {
    if (awayTown && list.townOrder[awayTown]) actions.setTownOrder(list.id, awayTown, null);
    actions.updateList(list.id, awayTown ? { deferred: [], mainFree: false } : { tripOrder: null, deferred: [], mainFree: false });
    setPlanSort(false);
    toast('Reihenfolge zurückgesetzt');
  };
  const allHere = (s: Stop) => {
    const n = items.filter(onTrip).length;
    actions.allHere(items, list, s.id);
    setMenu(null);
    goStore(s.id);
    toast('Alle ' + n + ' Artikel jetzt bei ' + s.name + ' · nur ein Stopp');
  };
  const defer = (s: Stop) => {
    actions.updateList(list.id, { deferred: [...list.deferred.filter(x => x !== s.id), s.id], ...(s.id === list.mainStoreId ? { mainFree: true } : {}) });
    setMenu(null);
    toast(s.name + ' ans Ende der Route verschoben');
  };

  const card = (s: Stop, idx: number) => {
    const key = 'stop:' + s.id, sortThis = sorting && !s.custom, done = doneOf(s), at = sortable.indexOf(s.id);
    return (
      <StopCard key={s.id} stop={s} idx={idx} items={itemsAt(s.id)} done={done}
        isCur={s.id === app.currentStop} isNext={!!nextStore && s.id === nextStore.id} insteadOf={insteadOf}
        menuOpen={menu === key} onToggleMenu={() => setMenu(m => (m === key ? null : key))}
        sort={sortThis ? { fixed: fixedLabel(s.id), onUp: () => moveTrip(s.id, -1), onDown: () => moveTrip(s.id, 1), noUp: at <= 0, noDown: at >= sortable.length - 1 } : null}
        onStart={locked ? null : () => goStore(s.id)} onAllHere={!locked && !done && route.length > 1 ? () => allHere(s) : null} allCount={items.filter(onTrip).length}
        onOnly={!locked && !app.currentStop && !onlyStop && fullRoute.length > 1 ? () => goOnly(s.id) : null} onDefer={() => defer(s)} />
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
            <div className="ellipsis" style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#6F6055' }}>Reihenfolge · <span style={{ fontWeight: 600, color: INK }}>{awayTown ? 'für ' + app.townName : list.tripOrder || list.mainFree ? 'nur für diesen Einkauf' : 'deine Reihenfolge'}</span></div>
            {(awayTown ? !!list.townOrder[awayTown] : !!list.tripOrder) || list.mainFree ? (
              <button onClick={resetOrder} style={resetBtn}>Zurücksetzen</button>
            ) : null}
            <button onClick={() => { setPlanSort(v => !v); setMenu(null); }} style={{ border: 'none', background: sorting ? ACC : PALE, color: INK, borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, minHeight: 36 }}>{sorting ? 'Fertig' : 'Ändern'}</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          {planned.map(([s, i]) => card(s, i))}
          {manual.length > 0 && <LabeledRule style={{ margin: '6px 4px 0' }}>Ohne feste Reihenfolge</LabeledRule>}
          {manual.map(([s, i]) => card(s, i))}
        </div>
        {onlyStop && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 4px 0', fontSize: 13, color: '#6F6055' }}>
            <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty' }}>Nur {onlyStop.name} – die anderen Läden bleiben für nächstes Mal.</span>
            <button onClick={() => { app.endOnly(); toast('Wieder die ganze Route'); }} style={resetBtn}>Ganze Route</button>
          </div>
        )}
        {app.standIn && tempItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 4px 0', fontSize: 13, color: '#6F6055' }}>
            <span style={{ width: 16, height: 10, border: '1.5px dashed rgba(42,31,23,.45)', borderRadius: 999, flexShrink: 0, display: 'block' }} />
            <span style={{ flex: 1, minWidth: 0, textWrap: 'pretty' }}>Heute statt {inStoreOrder(tempItems.map(i => temp(i)!.from)).join(', ')} – ihr gewohnter Laden bleibt.</span>
            <button onClick={() => { app.setStandIn(false); toast('Ersatz aufgehoben'); }} style={resetBtn}>Aufheben</button>
          </div>
        )}
        {waiting.length > 0 && (
          <WaitingSection groups={waiting} townName={app.townName}
            elsewhere={s => townsOf(s, app.towns).filter(t => t.id !== app.town).map(t => t.name)}
            onReplace={app.town && !app.standIn && herePreview && herePreview.stores.length > 0 && herePreview.missing.length > 0 ? () => setAskStandIn(app.town) : null} />
        )}
        {openItems > 0 && data.stores.length > 0 && !locked && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
            <TextLink onClick={() => setElsewhere('pick')}>Woanders einkaufen …</TextLink>
          </div>
        )}
      </div>
      <div className="bottom-fade" style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'none', paddingTop: 24 }}>
        {route.length > 0 && (
          <div style={{ padding: '0 20px 10px', pointerEvents: 'auto' }}>
            {locked && app.shopper && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 4px 10px', padding: '10px 12px', background: 'rgba(255,253,250,.82)', WebkitBackdropFilter: 'blur(18px)', backdropFilter: 'blur(18px)', borderRadius: 16, boxShadow: '0 1px 0 #EADCCD' }}>
                <span style={{ position: 'relative', display: 'flex', flexShrink: 0 }}>
                  <Avatar person={app.shopper.person} size={28} />
                  <span style={{ position: 'absolute', right: -2, bottom: -2, width: 10, height: 10, borderRadius: '50%', background: '#3E9B5F', border: '2px solid #FFFDFA', display: 'block' }} />
                </span>
                <span style={{ fontSize: 13, color: '#6F6055', textWrap: 'pretty' }}>
                  <span style={{ fontWeight: 600, color: INK }}>{app.shopper.person.name} kauft gerade ein.</span> Du kannst starten, sobald der Einkauf abgeschlossen ist.
                </span>
              </div>
            )}
            {locked ? (
              <button className="cta off" disabled aria-disabled="true" style={{ color: '#8A7A6D', cursor: 'default' }}>
                {nextStore ? 'Einkauf starten bei ' + nextStore.name : 'Einkauf abschließen'}
              </button>
            ) : spontaneousStore ? (
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
        <ElsewhereSheet stores={data.stores} towns={app.towns} currentTown={app.town} onPick={startSpontaneous} onNewStore={() => setElsewhere('new')} onClose={() => setElsewhere(null)} />
      )}
      {elsewhere === 'new' && (
        <StoreSheet initial={{ mode: 'new', name: '', branch: '', logo: null }} towns={app.towns} defaultTown={app.town} onClose={() => setElsewhere('pick')}
          onSave={v => { const id = actions.saveStore(v, null); toast('„' + v.name + '“ gespeichert'); startSpontaneous(id, v.town ?? app.towns[0]?.id ?? null); }} />
      )}
      {askStandIn && askPreview && (
        <StandInSheet preview={askPreview} townName={app.towns.find(t => t.id === askStandIn)?.name || ''}
          fromNames={inStoreOrder(askPreview.missing.map(i => effStore(i, list, allIds)))} onAnswer={answerStandIn} onClose={() => setAskStandIn(null)} />
      )}
      {townPick && <TownSheet towns={app.towns} current={app.town} stores={data.stores} onPick={chooseTown} onClose={() => setTownPick(false)} />}
    </div>
  );
}
