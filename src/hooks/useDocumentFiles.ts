import { useEffect, useRef, useState } from 'react';
import type { TimingDiagramData } from '../types';
import { parseDiagram, serializeDiagram } from '../document';
import type { FileGateway } from '../fileGateway';
import { INITIAL_DIAGRAM } from '../utils';
export type UnsavedChoice = 'save' | 'discard' | 'cancel';
interface Options {
  diagram: TimingDiagramData; dirty: boolean; gateway: FileGateway;
  load: (diagram: TimingDiagramData) => void; markSaved: (written: TimingDiagramData) => void;
  finishEdit: () => void; getSvg: () => string; notify: (message: string) => void;
  undo: () => void; redo: () => void; openDonate: () => void;
}
export function useDocumentFiles(options: Options) {
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const resolver = useRef<((choice: UnsavedChoice) => void) | null>(null);
  const running = useRef(false);
  const latest = useRef({ ...options, path }); latest.current = { ...options, path };
  const ask = () => new Promise<UnsavedChoice>(resolve => { resolver.current=resolve; setConfirmOpen(true); });
  const answer = (choice: UnsavedChoice) => { setConfirmOpen(false); resolver.current?.(choice); resolver.current=null; };
  const save = async (saveAs=false) => {
    const o=latest.current;
    o.finishEdit();
    const snapshot=o.diagram;
    const destination = await o.gateway.save(serializeDiagram(snapshot),saveAs?null:o.path,'json');
    if (destination===null) return false;
    setPath(destination);
    // Browser downloads cannot confirm that the user actually kept the file.
    if (o.gateway.native) o.markSaved(snapshot);
    o.notify(o.gateway.native?'Diagram saved':'JSON download started');
    return serializeDiagram(latest.current.diagram) === serializeDiagram(snapshot);
  };
  const guard = async () => {
    if (!latest.current.dirty) return true;
    const choice=await ask();
    if (choice==='cancel') return false;
    if (choice==='discard') return true;
    if (!latest.current.gateway.native) { await save(); return false; }
    return save();
  };
  const run = async (action: string) => {
    if (running.current) return;
    if (action==='donate') { latest.current.openDonate(); return; }
    if (action==='undo' || action==='redo') {
      const focused=document.activeElement;
      if (focused instanceof HTMLElement && focused.matches('input,textarea,[contenteditable="true"]')) document.execCommand?.(action);
      else latest.current[action]();
      return;
    }
    if (!['new','open','save','save-as','export-svg','close','quit'].includes(action)) return;
    running.current=true; setBusy(true);
    try {
      if (action==='save' || action==='save-as') { await save(action==='save-as'); return; }
      if (action==='export-svg') {
        const destination=await latest.current.gateway.save(latest.current.getSvg(),null,'svg');
        if (destination) latest.current.notify('SVG exported'); return;
      }
      if (!await guard()) return;
      const o=latest.current;
      if (action==='new') { o.finishEdit(); o.load(structuredClone(INITIAL_DIAGRAM)); setPath(null); }
      if (action==='open') {
        const before=serializeDiagram(o.diagram);
        const file=await o.gateway.open();
        if (!file) return;
        const parsed=parseDiagram(file.content);
        if (serializeDiagram(latest.current.diagram)!==before) { o.notify('Open cancelled: diagram changed while choosing a file'); return; }
        o.finishEdit(); o.load(parsed); setPath(file.path);
      }
      if (action==='close') await o.gateway.close();
      if (action==='quit') await o.gateway.quit();
    } catch(error) { latest.current.notify(`${action} failed: ${error instanceof Error?error.message:String(error)}`); }
    finally { running.current=false; setBusy(false); }
  };
  const runRef=useRef(run); runRef.current=run;
  useEffect(() => {
    let disposed=false; let cleanup:(()=>void)|undefined;
    options.gateway.subscribe(action=>void runRef.current(action),()=>void runRef.current('close'))
      .then(stop=>{ if(disposed) stop(); else cleanup=stop; })
      .catch(error=>latest.current.notify(`Desktop events unavailable: ${String(error)}`));
    return () => { disposed=true; cleanup?.(); resolver.current?.('cancel'); resolver.current=null; };
  },[options.gateway]);
  useEffect(() => {
    void options.gateway.title(`${options.dirty?'● ':''}${path?.split(/[\\/]/).pop() || 'Untitled'} — Tickwave`).catch(()=>{});
  },[path,options.dirty,options.gateway]);
  useEffect(() => {
    if (options.gateway.native || !options.dirty) return;
    const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',prevent); return()=>window.removeEventListener('beforeunload',prevent);
  },[options.gateway.native,options.dirty]);
  return { path, busy, confirmOpen, answer, run, clearPath:()=>setPath(null) };
}
