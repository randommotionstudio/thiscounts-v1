import { useEffect, useState } from 'react';
import { useApp } from './AppContext';
import { paths } from './router';
import * as actions from '../data/actions';
import { StorePickSheet } from '../sheets/StorePickSheet';

/**
 * On the way to the plan (from the list or the profile): items without a store ("Laden wählen", e.g. after
 * "… führt … nicht") would silently stay behind on the trip. So first a store is chosen for each – the plan only
 * opens once every item has one; closing the choice stays where it was. Rare, so it may stop you. Not during a
 * trip: there "… führt … nicht" was just said on purpose.
 */
export function usePlanGate() {
  const app = useApp();
  const { items, list, data, navigate, toast } = app;
  const [open, setOpen] = useState(false);
  // Chosen a moment ago (the change is still on its way into the list)
  const [handled, setHandled] = useState<string[]>([]);
  const waiting = items.filter(i => i.parked && !handled.includes(i.id));
  const goPlan = () => { if (waiting.length && !app.currentStop) setOpen(true); else navigate(paths.plan); };
  const cur = open ? waiting[0] || null : null;
  // Nothing left without a store (e.g. chosen on the other phone) → on to the plan
  useEffect(() => { if (open && !cur) { setOpen(false); navigate(paths.plan); } }, [open, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const sheet = cur && (
    <StorePickSheet key={cur.id} itemName={cur.name} stores={data.stores.filter(s => list.storeIds.includes(s.id))}
      sub={(waiting.length > 1 ? 'Noch ' + waiting.length + ' Artikel ohne Laden. ' : '') + 'Ohne Laden kommt ' + cur.name + ' beim Einkauf nicht mit. Der Laden wird gemerkt.'}
      onClose={() => setOpen(false)}
      onPick={id => { actions.setItemStore(cur, id); setHandled(h => [...h, cur.id]); toast(cur.name + ' kommt mit zu ' + (data.stores.find(s => s.id === id)?.name || '')); }} />
  );
  return { goPlan, sheet };
}
