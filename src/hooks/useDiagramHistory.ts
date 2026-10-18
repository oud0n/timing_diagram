import { useCallback, useRef, useState } from 'react';
import type { TimingDiagramData } from '../types';
import { beginTransaction, createHistory, editHistory, endTransaction, History, isDirty, markSaved, redoHistory, undoHistory } from '../history';
export function useDiagramHistory(initial: TimingDiagramData) {
  const [history, setHistory] = useState(() => createHistory(initial));
  const current = useRef(history);
  const apply = useCallback((operation: (h: History) => History) => {
    current.current = operation(current.current);
    setHistory(current.current);
  }, []);
  const edit = useCallback((update: TimingDiagramData | ((d: TimingDiagramData) => TimingDiagramData)) => {
    apply(h => editHistory(h, d => typeof update === 'function' ? update(d) : update));
  }, [apply]);
  return {
    diagram: history.present, edit, dirty: isDirty(history),
    canUndo: history.past.length > 0 || (history.transaction !== null && JSON.stringify(history.transaction) !== JSON.stringify(history.present)),
    canRedo: history.future.length > 0,
    undo: useCallback(() => apply(undoHistory), [apply]),
    redo: useCallback(() => apply(redoHistory), [apply]),
    begin: useCallback(() => apply(beginTransaction), [apply]),
    end: useCallback(() => apply(endTransaction), [apply]),
    markSaved: useCallback((written?: TimingDiagramData) => apply(h => markSaved(h, written)), [apply]),
    load: useCallback((diagram: TimingDiagramData) => apply(() => createHistory(diagram)), [apply]),
  };
}
