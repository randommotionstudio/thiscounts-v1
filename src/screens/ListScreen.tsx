import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { paths } from '../app/router';
import * as actions from '../data/actions';
import { memoryId } from '../data/refs';
import {
  ALL_DEPTS, UNKNOWN, effStore, icon, normName, parseEntry, pickFor, stopById, tint, usualChips, type Chip, type Pick,
} from '../lib/logic';
import type { Item } from '../lib/types';
import { DeptSheet } from '../sheets/DeptSheet';
import { OnceSheet } from '../sheets/OnceSheet';
import { QtySheet } from '../sheets/QtySheet';
import { Avatar, CatIcon, ConnPill, LogoTile, TabBar, useHeaderHeight } from '../ui/kit';
import { SwipeRow } from '../ui/SwipeRow';
import { useMarkSince } from '../app/markSince';
import { ask as askState, holdForNextTrip } from '../app/shopping';
import { SESSION_STALE_MS } from '../lib/logic';
import type { Session, Stop } from '../lib/types';

const ACC = '#F3752E', SOFT = '#FDE4D1', LINE = '#EADCCD', PALE = '#F3EADF', INK = '#2A1F17';
const CHIP_LIM = 6;

export function ListScreen() {
  const app = useApp();
  const { list, items, data, other, mainName, selectedStores, navigate, toast, guessDept, guessStore } = app;

  const [newItem, setNewItem] = useState('');
  const [inFocus, setInFocus] = useState(false);
  const [chipsAll, setChipsAll] = useState(false);
  const [chipAdded, setChipAdded] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  /** Row whose "Löschen" button is revealed (one at a time) */
  const [swiped, setSwiped] = useState<string | null>(null);
  const closeSwipe = useCallback(() => setSwiped(null), []);
  const [listMenu, setListMenu] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const [deptPick, setDeptPick] = useState<string | null>(null);
  const [onceFor, setOnceFor] = useState<string | null>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const focusAt = useRef(0);
  const [headRef, headH] = useHeaderHeight();

  const storeIdSet = useMemo(() => new Set(data.stores.map(s => s.id)), [data.stores]);
  const markSince = useMarkSince();

  // ---- V1.1: the other person is shopping on this list right now ----
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const shopper: Session | undefined = Object.values(data.sessions)
    .find(s => s.uid !== app.user.uid && s.listId === list.id && now - s.updatedAtMs < SESSION_STALE_MS);
  const shopperAt = shopper ? stopById(shopper.storeId, data.stores, items) : null;
  const shopperDone = shopper ? shopper.doneStoreIds.map(id => stopById(id, data.stores, items)?.name).filter(Boolean) : [];

  // ---- V1.1 Rückfrage (R5): added for a store the shopper has already finished today ----
  const [ask, setAsk] = useState<{ itemId: string; name: string; from: Stop; at: Stop } | null>(null);
  const resolveAsk = (take: boolean) => {
    if (!ask) return;
    const it = items.find(i => i.id === ask.itemId);
    if (it) {
      if (!take) holdForNextTrip(it, data.sessions, app.user.uid);
      else if (ask.at.custom) actions.updateItem(it, { pendingDecision: false, storeId: null, once: true, onceStopName: ask.at.name, parked: false });
      else actions.updateItem(it, { pendingDecision: false, storeId: ask.at.id, once: !list.storeIds.includes(ask.at.id), onceStopName: null, parked: false });
    }
    askState.openItemId = null;
    setAsk(null);
  };
  const resolveRef = useRef(resolveAsk);
  resolveRef.current = resolveAsk;
  useEffect(() => {
    if (!ask) return;
    // Unanswered after 2 minutes (or when leaving the list) → "Beim nächsten Einkauf"
    const t = setTimeout(() => resolveRef.current(false), 2 * 60 * 1000);
    return () => clearTimeout(t);
  }, [ask]);
  useEffect(() => () => { if (askState.openItemId) resolveRef.current(false); }, []);
  // The shopper finished (or went quiet) while the question was open → nothing left to decide
  useEffect(() => { if (ask && !shopper) resolveRef.current(false); }, [ask, shopper]);

  /** Creates the item; asks first if it lands at a store the shopper already finished (R5). */
  const createItem = (data0: { name: string; qty: string | null; category: string; storeId: string | null }): string => {
    const probe = { ...data0, id: '', listId: list.id, once: false, onceStopName: null, parked: false, checked: false, checkedBy: null, createdBy: null, createdAtMs: 0, pendingDecision: false, nextTrip: false };
    const target = effStore(probe, list, storeIdSet);
    if (shopper && shopperAt && target && shopper.doneStoreIds.includes(target) && target !== shopper.storeId) {
      const from = stopById(target, data.stores, items);
      if (from) {
        const id = actions.addItem(list.id, { ...data0, pendingDecision: true });
        askState.openItemId = id;
        inRef.current?.blur();
        setAsk({ itemId: id, name: data0.name, from, at: shopperAt });
        return id;
      }
    }
    return actions.addItem(list.id, data0);
  };
  const liveIds = new Set(items.map(i => i.id));
  const freshLive = fresh.filter(id => liveIds.has(id));

  // ---- Adding ----
  const addEntry = () => {
    const t = newItem.trim();
    if (!t) return;
    const { name, qty } = parseEntry(t);
    const ex = items.find(i => normName(i.name) === normName(name));
    if (ex) { inRef.current?.blur(); setPick(pickFor(ex)); setNewItem(''); return; }
    const id = createItem({ name, qty, category: guessDept(name), storeId: guessStore(name) });
    setNewItem('');
    setFresh(f => [...f, id]);
  };

  const chipOn = (c: Chip) => { const id = chipAdded[c.name]; return id != null && liveIds.has(id); };
  const toggleChip = (c: Chip) => {
    const id = chipAdded[c.name];
    if (id != null && liveIds.has(id)) {
      actions.deleteItem({ listId: list.id, id });
      setFresh(f => f.filter(x => x !== id));
      setChipAdded(m => { const r = { ...m }; delete r[c.name]; return r; });
      return;
    }
    const nid = createItem({ name: c.name, qty: c.qty, category: guessDept(c.name), storeId: guessStore(c.name) });
    setFresh(f => [...f, nid]);
    setChipAdded(m => ({ ...m, [c.name]: nid }));
    setNewItem('');
  };

  // ---- Store assignment ----
  const setStore = (it: Item, sid: string | null) => {
    const had = data.memory[memoryId(it.name)]?.storeId || null;
    actions.setItemStore(it, sid);
    setExpanded(null);
    if (sid && sid !== had) toast('Gemerkt: ' + it.name + ' holst du künftig bei ' + (data.stores.find(s => s.id === sid)?.name || ''));
    else if (!sid && had) toast(it.name + ' wird wieder automatisch zugeordnet');
  };

  // ---- Lists menu ----
  const selectList = (id: string) => {
    setListMenu(false);
    if (id !== list.id) {
      app.setActiveList(id);
      setFresh([]); setChipAdded({}); setExpanded(null);
      toast('Gewechselt zu „' + (data.lists.find(l => l.id === id)?.name || '') + '“');
    }
  };
  const openCreate = () => {
    setListMenu(false);
    app.setDraft({ mode: 'create', name: '', storeIds: [], mainStoreId: null, storeOrder: [] });
    navigate(paths.listNew);
  };
  const openEdit = (id: string) => {
    const l = data.lists.find(x => x.id === id);
    if (!l) return;
    setListMenu(false);
    app.setActiveList(id);
    app.setDraft({ mode: 'edit', listId: id, name: l.name, storeIds: l.storeIds, mainStoreId: l.mainStoreId, storeOrder: l.storeOrder });
    navigate(paths.listEdit);
  };

  // ---- Sections ----
  const qRaw = newItem.trim(), qName = qRaw ? parseEntry(qRaw).name.trim() : '', ql = qName.toLowerCase(), searching = !!ql;
  type Section = { title: string; color: string; canSort: boolean; hint: string | null; items: Item[] };
  let sections: Section[];
  if (searching) {
    const m = items.filter(i => i.name.toLowerCase().includes(ql)), exact = m.some(i => i.name.toLowerCase() === ql);
    sections = m.length ? [{ title: 'Schon auf der Liste', color: '#1E5A34', canSort: false, hint: exact ? 'Enter öffnet die Menge – so steht es nicht doppelt drauf.' : null, items: m }] : [];
  } else {
    const fr = freshLive.slice().reverse().map(id => items.find(i => i.id === id)).filter((x): x is Item => !!x);
    const rest = items.filter(i => !freshLive.includes(i.id));
    const order = [UNKNOWN, ...ALL_DEPTS], rank = (d: string) => { const k = order.indexOf(d); return k < 0 ? 999 : k; };
    const depts = [...new Set(rest.map(i => i.category))].sort((a, b) => rank(a) - rank(b));
    sections = [
      ...(fr.length ? [{ title: 'Gerade hinzugefügt', color: '#C9581A', canSort: true, hint: null, items: fr }] : []),
      ...depts.map(d => ({ title: d === UNKNOWN ? 'Kategorie fehlt' : d, color: d === UNKNOWN ? '#C9581A' : '#8A7A6D', canSort: false, hint: null, items: rest.filter(i => i.category === d) })),
    ];
  }

  // ---- Chips ----
  const allChips = useMemo(() => usualChips(data.history, Date.now()), [data.history]);
  const onList = (n: string) => items.some(i => normName(i.name) === normName(n));
  let pool = allChips.filter(c => chipOn(c) || !onList(c.name));
  if (searching) pool = pool.filter(c => c.name.toLowerCase().includes(ql));
  const baseEmpty = items.every(i => freshLive.includes(i.id));
  const showAll = searching || chipsAll;
  const chipsOpen = pool.length > 0 && (inFocus || (baseEmpty && !searching));
  const keepFocus = (e: React.MouseEvent) => { if (inFocus) e.preventDefault(); };
  const qDept = qName ? guessDept(qName) : '';

  const onListScroll = () => {
    if (swiped) setSwiped(null);
    if (inFocus && Date.now() - focusAt.current > 500) inRef.current?.blur();
  };

  const n = items.length;
  const deptItem = deptPick ? items.find(i => i.id === deptPick) : null;
  const onceItem = onceFor ? items.find(i => i.id === onceFor) : null;

  return (
    <div className="screen">
      <div ref={headRef} className="glass-head" style={{ padding: 'calc(var(--safe-top) + 20px) 20px 10px' }}>
        {app.conn !== 'online' && <div style={{ display: 'flex', margin: '0 0 6px' }}><ConnPill conn={app.conn} /></div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={() => { setListMenu(v => !v); setExpanded(null); }} style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'none', padding: 0, margin: 0, color: INK, cursor: 'pointer', minWidth: 0, textAlign: 'left' }}>
            <h1 className="h1 ellipsis">{list.name}</h1>
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(42,31,23,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRight: '2px solid #2A1F17', borderBottom: '2px solid #2A1F17', transform: listMenu ? 'translateY(2px) rotate(-135deg)' : 'translateY(-2px) rotate(45deg)', display: 'block', transition: 'transform .2s' }} />
            </span>
          </button>
          <span title={'Geteilt mit ' + other.name} style={{ display: 'flex' }}><Avatar person={other} /></span>
        </div>
        {shopper && shopperAt && (
          <div style={{ marginTop: 12, background: '#2A1F17', color: '#FBF5EE', borderRadius: 16, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, animation: 'toastIn .25s ease' }}>
            <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
              <Avatar person={other} size={32} onDark />
              <span style={{ position: 'absolute', right: -2, bottom: -2, width: 11, height: 11, borderRadius: '50%', background: '#3E9B5F', border: '2px solid #2A1F17', display: 'block' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{other.name} kauft gerade ein</div>
              <div className="ellipsis" style={{ fontSize: 12, color: '#C9B8A6' }}>
                {shopperAt.name + ' · Stopp ' + shopper.stopIndex + ' von ' + shopper.stopCount + (shopperDone.length ? ' · ' + shopperDone.join(', ') + ' erledigt' : '')}
              </div>
            </div>
            <LogoTile store={shopperAt} size={32} radius={9} initialSize={14} bordered={false} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input ref={inRef} value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addEntry(); }}
            onFocus={() => { focusAt.current = Date.now(); setInFocus(true); }} onBlur={() => setInFocus(false)}
            enterKeyHint="done" placeholder="z. B. 5 Bananen, 500 g Mehl …" aria-label="Artikel hinzufügen"
            style={{ flex: 1, minWidth: 0, height: 50, border: '1px solid rgba(255,255,255,.8)', borderRadius: 999, padding: '0 18px', fontSize: 16, background: 'rgba(255,255,255,.7)', color: INK, outline: 'none', boxSizing: 'border-box', boxShadow: '0 2px 10px rgba(42,31,23,.06)' }} />
          <button onMouseDown={keepFocus} onClick={addEntry} aria-label="Hinzufügen" style={{ width: 50, height: 50, border: 'none', borderRadius: 999, background: INK, color: '#FBF5EE', fontSize: 26, lineHeight: 1, cursor: 'pointer', flexShrink: 0 }}>+</button>
        </div>
        {chipsOpen && (
          <div style={{ marginTop: 12, animation: 'toastIn .2s ease' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 4px 8px' }}>{searching ? 'Aus deinen üblichen Artikeln' : 'Üblich auf deiner Liste'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pool.slice(0, showAll ? pool.length : CHIP_LIM).map(c => {
                const on = chipOn(c), d = guessDept(c.name);
                return (
                  <button key={c.name} onMouseDown={keepFocus} onClick={() => toggleChip(c)} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 13px 0 5px', borderRadius: 999, border: `1px solid ${on ? ACC : 'rgba(255,255,255,.95)'}`, background: on ? SOFT : 'rgba(255,255,255,.75)', color: INK, fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 4px rgba(42,31,23,.05)', whiteSpace: 'nowrap' }}>
                    {on
                      ? <span style={{ width: 28, height: 28, borderRadius: '50%', background: ACC, color: INK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 800, animation: 'pop .25s ease' }}>✓</span>
                      : <span style={{ width: 28, height: 28, borderRadius: '50%', background: tint(d), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CatIcon src={icon(d)} size={15} opacity={0.8} /></span>}
                    <span>{c.name}</span>
                    {c.qty && <span style={{ color: '#8A7A6D', fontWeight: 500, fontSize: 13 }}>{c.qty}</span>}
                  </button>
                );
              })}
              {!searching && pool.length > CHIP_LIM && (
                <button onMouseDown={keepFocus} onClick={() => setChipsAll(v => !v)} style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px dashed #B8A696', background: 'transparent', color: '#6F6055', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {chipsAll ? 'Weniger' : '+ ' + (pool.length - CHIP_LIM) + ' mehr'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="scroll" onScroll={onListScroll} style={{ padding: '0 20px calc(var(--safe-bottom) + 160px)', paddingTop: headH ? headH + 14 : 'calc(var(--safe-top) + 161px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {sections.map(sec => (
            <div key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px', minHeight: 32 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: sec.color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{sec.title} · {sec.items.length}</div>
                {sec.canSort && <button onClick={() => { setFresh([]); setChipAdded({}); }} style={{ border: 'none', background: 'none', minHeight: 32, padding: '0 8px', marginRight: -8, color: '#C9581A', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Einsortieren</button>}
              </div>
              {sec.hint && <p style={{ margin: '-4px 4px 2px', fontSize: 13, color: '#6F6055', textWrap: 'pretty' }}>{sec.hint}</p>}
              {sec.items.map(it => {
                const isOnce = it.once && !it.parked;
                const auto = !it.once && !(it.storeId && list.storeIds.includes(it.storeId));
                const eff = stopById(effStore(it, list, storeIdSet), data.stores, items);
                const effName = eff ? eff.name : mainName;
                const isAuto = !it.parked && auto;
                const isExp = expanded === it.id;
                const opts = [
                  { id: null as string | null, label: 'Automatisch (' + mainName + ')', on: auto && !it.parked, once: false },
                  ...selectedStores.map(s => ({ id: s.id as string | null, label: s.name, on: !it.once && !it.parked && it.storeId === s.id, once: false })),
                  ...(isOnce ? [{ id: null as string | null, label: effName + ' · einmalig', on: true, once: true }] : []),
                ];
                return (
                  <div key={it.id} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 0 #EADCCD', overflow: 'hidden' }}>
                    <SwipeRow open={swiped === it.id} onOpen={() => { setSwiped(it.id); setExpanded(null); }} onClose={closeSwipe}
                      onDelete={() => { actions.deleteItem(it); setSwiped(null); }} deleteLabel={it.name + ' löschen'}>
                    <div onClick={() => setExpanded(e => (e === it.id ? null : it.id))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', minHeight: 56, cursor: 'pointer', boxSizing: 'border-box' }}>
                      <button onClick={e => { e.stopPropagation(); setDeptPick(it.id); setExpanded(null); }} title="Kategorie ändern" style={{ width: 38, height: 38, border: 'none', padding: 0, borderRadius: 12, background: tint(it.category), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
                        <CatIcon src={icon(it.category)} size={20} label={it.category} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span className="ellipsis" style={{ fontWeight: 600 }}>{it.name}</span>
                          {it.createdBy && it.createdBy !== app.user.uid && it.createdAtMs > markSince && (
                            <Avatar person={other} size={20} label={'Neu von ' + other.name} />
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 12, color: it.category === UNKNOWN ? '#C9581A' : '#8A7A6D' }}>
                          <button onClick={e => { e.stopPropagation(); setPick(pickFor(it)); setExpanded(null); }} title="Menge ändern" style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'inherit', padding: '12px 10px', margin: '-12px -10px', fontSize: 12, fontWeight: 600, lineHeight: 'inherit', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                            {it.qty || '1 Stück'}<span style={{ width: 12, height: 12, display: 'block', opacity: 0.75, background: 'url(/icons/pencil.svg) center/12px no-repeat' }} />
                          </button>
                          <span className="ellipsis">· {it.category === UNKNOWN ? 'Kategorie wählen' : it.category}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '58%', boxSizing: 'border-box', flexShrink: 0,
                        background: it.parked ? INK : isOnce ? SOFT : auto ? 'transparent' : PALE,
                        color: it.parked ? '#FBF5EE' : isOnce ? '#9A3F0C' : '#6F6055',
                        border: isAuto ? '1px dashed #B8A696' : '1px solid transparent' }}>
                        {isAuto && <span title="Automatisch" style={{ width: 14, height: 14, margin: '0 6px 0 -4px', borderRadius: '50%', background: 'currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.85 }}><span style={{ color: '#fff', fontSize: 9, fontWeight: 800, lineHeight: 1 }}>A</span></span>}
                        {isOnce && <span title="Einmaliger Stopp" style={{ margin: '0 6px 0 -4px', padding: '1px 5px', borderRadius: 999, background: '#C9581A', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1.3, flexShrink: 0 }}>1×</span>}
                        <span className="ellipsis" style={{ lineHeight: 1.2 }}>{it.parked ? 'Offen · Laden wählen' : effName}</span>
                      </div>
                    </div>
                    </SwipeRow>
                    {isExp && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 14px 14px', borderTop: '1px solid #F3EADF' }}>
                        {opts.map(o => (
                          <button key={o.label} onClick={e => { e.stopPropagation(); if (o.once) setExpanded(null); else setStore(it, o.id); }}
                            style={{ height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `2px solid ${o.on ? ACC : LINE}`, background: o.on ? SOFT : '#fff', color: INK }}>{o.label}</button>
                        ))}
                        <button onClick={e => { e.stopPropagation(); setOnceFor(it.id); }} style={{ height: 36, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '2px dashed #D8CBBD', background: 'transparent', color: '#6F6055' }}>+ Einmaliger Stopp</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {searching && !sections.length && (
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 0 #EADCCD', padding: '12px 12px 12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, textWrap: 'pretty' }}>„{qName}“ ist noch nicht auf der Liste</div>
              <div style={{ fontSize: 12, color: '#8A7A6D', marginTop: 2 }}>{qDept === UNKNOWN || !qDept ? 'Kategorie wählst du danach' : 'Kommt zu ' + qDept}</div>
            </div>
            <button onMouseDown={keepFocus} onClick={addEntry} style={{ height: 44, padding: '0 16px', border: 'none', borderRadius: 999, background: INK, color: '#FBF5EE', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Hinzufügen</button>
          </div>
        )}
        {n === 0 && !searching && (
          <div style={{ textAlign: 'center', padding: '18px 12px 6px' }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 19 }}>Deine Liste ist leer</div>
            <div style={{ fontSize: 14, color: '#8A7A6D', marginTop: 4 }}>Tipp etwas ein oder wähle aus deinen üblichen Artikeln.</div>
          </div>
        )}
        {items.some(i => i.parked) && !searching && (
          <p style={{ fontSize: 13, color: '#9C4412', margin: '12px 4px 0' }}>Schwarz markierte Artikel waren nicht verfügbar – wähle einen Laden für die nächste Runde.</p>
        )}
        {n > 0 && !searching && (
          <p style={{ fontSize: 13, color: '#8A7A6D', margin: '22px 4px 0' }}>Tipp: Artikel antippen, um den Laden zu ändern. Ohne Zuordnung → {mainName} (Hauptladen).</p>
        )}
      </div>

      {app.toastText && <div className="toast-inline toast-overlay" role="status" style={{ top: headH ? headH + 14 : 'calc(var(--safe-top) + 161px)' }}>{app.toastText}</div>}
      <div className="bottom-fade" style={{ display: 'flex', flexDirection: 'column', pointerEvents: 'none', paddingTop: 24 }}>
        <div style={{ padding: '0 20px 10px', pointerEvents: 'auto' }}>
          <button className={'cta' + (n ? '' : ' off')} onClick={() => navigate(paths.plan)}>{n ? 'Einkaufsplan ansehen · ' + n + ' Artikel' : 'Noch keine Artikel'}</button>
        </div>
        <TabBar active="list" go={navigate} />
      </div>

      {listMenu && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
          <div onClick={() => setListMenu(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(42,31,23,.16)' }} />
          <div style={{ position: 'absolute', left: 14, right: 14, top: 'calc(var(--safe-top) + 72px)', background: 'rgba(255,253,250,.88)', WebkitBackdropFilter: 'blur(24px) saturate(1.6)', backdropFilter: 'blur(24px) saturate(1.6)', border: '1px solid rgba(255,255,255,.8)', borderRadius: 24, boxShadow: '0 18px 44px rgba(42,31,23,.22), inset 0 1px 0 rgba(255,255,255,.9)', padding: 6, animation: 'toastIn .2s ease', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '70%', overflow: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#8A7A6D', textTransform: 'uppercase', letterSpacing: '.06em', padding: '10px 12px 6px' }}>Deine Listen</div>
            {data.lists.map(l => {
              const active = l.id === list.id, cnt = (data.itemsByList[l.id] || []).length;
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 18, background: active ? 'rgba(224,122,44,.10)' : 'transparent' }}>
                  <button onClick={() => selectList(l.id)} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '10px 6px 10px 12px', minHeight: 62, border: 'none', background: 'none', color: INK, cursor: 'pointer' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: active ? ACC : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <span style={{ width: 9, height: 5, borderLeft: '2.5px solid #2A1F17', borderBottom: '2.5px solid #2A1F17', transform: 'rotate(-45deg) translate(1px,-1px)', display: 'block' }} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="ellipsis" style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>{l.name}</span>
                      <span className="ellipsis" style={{ display: 'block', fontSize: 12, color: '#8A7A6D' }}>{cnt} Artikel · mit {other.name}</span>
                    </span>
                  </button>
                  <button onClick={e => { e.stopPropagation(); openEdit(l.id); }} title="Liste bearbeiten" style={{ width: 44, height: 44, marginRight: 8, border: 'none', borderRadius: '50%', background: 'rgba(42,31,23,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                    <span style={{ width: 16, height: 16, display: 'block', opacity: 0.7, background: 'url(/icons/pencil.svg) center/16px no-repeat' }} />
                  </button>
                </div>
              );
            })}
            <div style={{ height: 1, background: 'rgba(42,31,23,.08)', margin: '4px 12px' }} />
            <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '10px 12px', minHeight: 56, border: 'none', background: 'none', borderRadius: 18, color: '#C9581A', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
              <span className="plus-ring lg" />Neue Liste erstellen
            </button>
          </div>
        </div>
      )}

      {deptItem && (
        <DeptSheet name={deptItem.name} current={deptItem.category} onClose={() => setDeptPick(null)}
          onPick={d => { actions.setCategoryForName(app.allItems, deptItem.name, d); setDeptPick(null); toast('Gemerkt: „' + deptItem.name + '“ → ' + d); }} />
      )}
      {onceItem && (
        <OnceSheet
          itemName={onceItem.name}
          suggestions={[...new Set(items.filter(i => i.once && i.onceStopName && i.id !== onceItem.id).map(i => i.onceStopName!.trim()))]}
          stores={data.stores.filter(s => !list.storeIds.includes(s.id))}
          currentStoreId={onceItem.once ? onceItem.storeId : null}
          onClose={() => setOnceFor(null)}
          onText={t => { actions.assignOnce(onceItem, { text: t }); setOnceFor(null); setExpanded(null); toast('Einmaliger Stopp: ' + onceItem.name + ' holst du diesmal bei ' + t); }}
          onStore={s => { actions.assignOnce(onceItem, { storeId: s.id }); setOnceFor(null); setExpanded(null); toast('Einmaliger Stopp: ' + onceItem.name + ' holst du diesmal bei ' + s.name); }}
        />
      )}
      {ask && (
        <div className="sheet-layer" style={{ zIndex: 50 }}>
          <div className="sheet-dim" />
          <div className="sheet">
            <div className="grab" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
                <Avatar person={other} size={44} />
                <span style={{ position: 'absolute', right: -5, bottom: -5, display: 'flex', borderRadius: 7, border: '2px solid #FBF5EE' }}>
                  <LogoTile store={ask.at} size={20} radius={5} initialSize={11} bordered={false} />
                </span>
              </span>
              <div className="sheet-title" style={{ flex: 1, minWidth: 0 }}>{other.name} ist schon bei {ask.at.name}</div>
            </div>
            <p style={{ margin: '12px 0 18px', fontSize: 15, color: '#6F6055', textWrap: 'pretty' }}>
              Bei {ask.from.name} ist {other.name} für heute fertig. Soll {other.name} {ask.name} bei {ask.at.name} mitnehmen?
            </p>
            <button onClick={() => resolveAsk(true)} style={{ width: '100%', height: 52, border: 'none', borderRadius: 999, background: '#F3752E', color: '#2A1F17', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>Bei {ask.at.name} mitnehmen</button>
            <button onClick={() => resolveAsk(false)} style={{ marginTop: 10, width: '100%', minHeight: 52, border: '2px solid #2A1F17', borderRadius: 999, background: 'transparent', color: '#2A1F17', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Beim nächsten {ask.from.name}-Einkauf</button>
          </div>
        </div>
      )}
      {pick && (
        <QtySheet key={pick.editId} initial={pick} dept={guessDept(pick.name)} onClose={() => setPick(null)}
          onSave={q => { const it = items.find(i => i.id === pick.editId); if (it) actions.updateItem(it, { qty: q }); setPick(null); }} />
      )}
    </div>
  );
}
