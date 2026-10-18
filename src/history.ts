import type { TimingDiagramData } from './types';
import { parseDiagram, reconcileDiagram, serializeDiagram } from './document';
export interface History {
  present: TimingDiagramData;
  past: TimingDiagramData[];
  future: TimingDiagramData[];
  saved: string;
  transaction: TimingDiagramData | null;
}
const equal = (a: TimingDiagramData, b: TimingDiagramData) => JSON.stringify(a) === JSON.stringify(b);
export const createHistory = (diagram: TimingDiagramData): History => ({ present: diagram, past: [], future: [], saved: serializeDiagram(diagram), transaction: null });
export const isDirty = (h: History) => serializeDiagram(h.present) !== h.saved;
// Record the exact snapshot written by a future asynchronous file save.
export const markSaved = (h: History, written: TimingDiagramData = h.present): History => ({ ...h, saved: serializeDiagram(written) });
export const beginTransaction = (h: History): History => h.transaction ? h : { ...h, transaction: h.present };
export function endTransaction(h: History): History {
  if (!h.transaction) return h;
  return { ...h, past: equal(h.transaction, h.present) ? h.past : [...h.past, h.transaction].slice(-100), transaction: null };
}
export function editHistory(h: History, update: (d: TimingDiagramData) => TimingDiagramData): History {
  const present = parseDiagram(JSON.stringify(reconcileDiagram(update(h.present))));
  if (equal(present, h.present)) return h;
  return { ...h, present, past: h.transaction ? h.past : [...h.past, h.present].slice(-100), future: [] };
}
export function undoHistory(input: History): History {
  const h = endTransaction(input);
  if (!h.past.length) return h;
  return { ...h, present: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.present, ...h.future] };
}
export function redoHistory(input: History): History {
  const h = endTransaction(input);
  if (!h.future.length) return h;
  return { ...h, present: h.future[0], past: [...h.past, h.present].slice(-100), future: h.future.slice(1) };
}
