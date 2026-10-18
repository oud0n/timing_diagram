import { useEffect, useMemo, useRef, useState } from "react";
import { NumberField } from "./components/NumberField";
import { Signal, Marker, Constraint, DiagramConfig, TimingDiagramData, RepeatRange, TimeFold } from "./types";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { SignalEditor } from "./components/SignalEditor";
import { MarkerTable } from "./components/MarkerTable";
import { ConstraintTable } from "./components/ConstraintTable";
import { RepeatFoldManager } from "./components/RepeatFoldManager";
import { parseWaveform, busHasBits, INITIAL_DIAGRAM } from "./utils";
import { parseDiagram, serializeDiagram } from "./document";
import { useDiagramHistory } from "./hooks/useDiagramHistory";
import { serializeWaveformSvg } from "./svgExport";
import { createFileGateway, FileGateway } from "./fileGateway";
import { useDocumentFiles } from "./hooks/useDocumentFiles";
import { clockToBinary, paintWaveCells, WaveState } from "./waveformEditing";
import { MAX_TIMELINE_CYCLES, formatTime, timelineLength } from "./timeline";
import {
  Download,
  Copy,
  Sliders,
  Layers,
  FileCode,
  Code,
  CheckCircle,
  Sun,
  Moon,
  Info,
  Activity,
  RotateCcw,
  Repeat,
  FoldHorizontal,
  Coffee,
} from "lucide-react";
import { DonateModal } from "./components/DonateModal";

export default function App({ gateway: injectedGateway }: { gateway?: FileGateway } = {}) {
  const gateway = useMemo(() => injectedGateway || createFileGateway(), [injectedGateway]);
  // Theme state: default to dark, supports instant toggling
  const [theme, setTheme] = useState<"dark" | "light">(() => { try { return window.localStorage.getItem("timing-editor-theme") === "light" ? "light" : "dark"; } catch { return "dark"; } });
  const isDark = theme === "dark";

  // Core diagram state
  const { diagram, edit: editDiagram, dirty, canUndo, canRedo, undo, redo, begin, end, load, markSaved } = useDiagramHistory(INITIAL_DIAGRAM);
  const [documentEpoch, setDocumentEpoch] = useState(0);
  const [timelineEndRequest, setTimelineEndRequest] = useState(0);
  const [activeCell, setActiveCell] = useState<{ signalId: string; cycleIndex: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    if (activeCell && (!diagram.signals.some(s => s.id === activeCell.signalId) || activeCell.cycleIndex >= diagram.config.numCycles)) setActiveCell(null);
  }, [diagram, activeCell]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (!(target instanceof window.Element) || target.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (gateway.native) return;
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      } else if (!event.metaKey && !event.ctrlKey && !event.altKey && (event.key === '0' || event.key === '1') && activeCell) {
        event.preventDefault();
        paintCellState(event.key);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [undo, redo, activeCell, diagram, gateway]);

  // Drawer / Modal states
  const [configOpen, setConfigOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [repeatFoldOpen, setRepeatFoldOpen] = useState(false);
  const [clipMessage, setClipMessage] = useState<string | null>(null);
  const [jsonPasteOpen, setJsonPasteOpen] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");
  const [jsonImportError, setJsonImportError] = useState<string | null>(null);
  const [busLabelEdit, setBusLabelEdit] = useState<{ signalId: string; cycleIndex: number; value: string } | null>(null);
  const [pendingImport, setPendingImport] = useState<TimingDiagramData | null>(null);

  const setDiagram = (update: TimingDiagramData | ((d: TimingDiagramData) => TimingDiagramData)) => {
    try { editDiagram(update); }
    catch (err) { showClipMessage(`Edit rejected: ${err instanceof Error ? err.message : String(err)}`); }
  };

  useEffect(() => { try { window.localStorage.setItem("timing-editor-theme", theme); } catch {} }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const updateConfig = (fields: Partial<DiagramConfig>) => {
    setDiagram((prev) => ({
      ...prev,
      config: { ...prev.config, ...fields },
    }));
  };

  const updateSignals = (newSignals: Signal[]) => {
    setDiagram((prev) => ({
      ...prev,
      signals: newSignals,
      config: { ...prev.config, numCycles: timelineLength(prev.config.numCycles, newSignals.map(s => s.waveStr.length)) },
    }));
  };

  const updateMarkers = (newMarkers: Marker[]) => {
    setDiagram((prev) => ({
      ...prev,
      markers: newMarkers,
    }));
  };

  const updateConstraints = (newConstraints: Constraint[]) => {
    setDiagram((prev) => ({
      ...prev,
      constraints: newConstraints,
    }));
  };

  const handleAddRepeatRange = (range: RepeatRange) => {
    setDiagram((prev) => ({
      ...prev,
      repeatRanges: [...(prev.repeatRanges || []), range],
    }));
    showClipMessage(`Added repeat marker: ${range.count} (${range.startCycle}..${range.endCycle})`);
  };

  const handleRemoveRepeatRange = (id: string) => {
    setDiagram((prev) => ({
      ...prev,
      repeatRanges: (prev.repeatRanges || []).filter((r) => r.id !== id),
    }));
    showClipMessage("Removed repeat marker");
  };

  const handleAddFold = (fold: TimeFold) => {
    setDiagram((prev) => ({
      ...prev,
      folds: [...(prev.folds || []), fold],
    }));
    showClipMessage(`Added fold: cycles ${fold.startCycle}..${fold.endCycle}`);
  };

  const handleRemoveFold = (id: string) => {
    setDiagram((prev) => ({
      ...prev,
      folds: (prev.folds || []).filter((f) => f.id !== id),
    }));
    showClipMessage("Expanded folded region");
  };

  const handleCanvasCellClick = (signalId: string, cycleIndex: number) => {
    setActiveCell({ signalId, cycleIndex });
  };

  const paintCells = (signalId: string, cycles: number[], state: WaveState) => {
    setDiagram(prev => paintWaveCells(prev, signalId, cycles, state));
  };
  const paintCellState = (state: WaveState) => {
    if (activeCell) paintCells(activeCell.signalId, [activeCell.cycleIndex], state);
  };
  const openBusLabel = (signalId: string, cycleIndex: number) => {
    const signal = diagram.signals.find(s => s.id === signalId);
    if (!signal || signal.type !== 'bus') return;
    setActiveCell({ signalId, cycleIndex });
    setBusLabelEdit({ signalId, cycleIndex, value: signal.busValues[cycleIndex] || '' });
  };
  const commitBusLabel = () => {
    if (!busLabelEdit) return;
    end();
    setDiagram(prev => ({ ...prev, signals: prev.signals.map(s => s.id === busLabelEdit.signalId ? {
      ...s, busValues: { ...s.busValues, [busLabelEdit.cycleIndex]: busLabelEdit.value },
    } : s) }));
    setBusLabelEdit(null);
  };

  const handleTimelineDoubleClick = (time: number) => {
    const defaultMarkerColor = "#ef4444";
    const label = `M_${time}`;
    const newMarker: Marker = {
      id: `m_${Date.now()}`,
      time,
      label,
      color: defaultMarkerColor,
      showLine: true,
    };
    updateMarkers([...diagram.markers, newMarker]);
  };

  const getSvg = () => {
    const svg = canvasRef.current?.querySelector<SVGSVGElement>('svg[data-waveform]');
    if (!svg) throw new Error("Waveform is unavailable");
    return serializeWaveformSvg(svg);
  };

  const triggerSvgDownload = () => { void files.run('export-svg'); };

  const triggerCopySvgToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getSvg());
      showClipMessage("SVG copied to clipboard");
    } catch {
      showClipMessage("SVG copy failed: clipboard unavailable");
    }
  };

  const exportJsonConfig = async () => {
    try {
      await navigator.clipboard.writeText(serializeDiagram(diagram));
      showClipMessage("JSON configuration copied");
    } catch (err) {
      showClipMessage(`JSON copy failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const applyImport = (obj: TimingDiagramData) => {
    load(obj);
    setDocumentEpoch(value => value + 1);
    setActiveCell(null);
    setBusLabelEdit(null);
    files.clearPath();
    setJsonPasteOpen(false);
    setJsonPasteText("");
    setJsonImportError(null);
    setPendingImport(null);
    showClipMessage("Diagram loaded successfully");
  };

  const handleJsonImportSubmit = () => {
    try {
      const obj = parseDiagram(jsonPasteText);
      if (dirty) { setPendingImport(obj); return; }
      applyImport(obj);
    } catch (err) {
      setJsonImportError(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const showClipMessage = (msg: string) => {
    setClipMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setClipMessage(null), 3000);
  };

  const files = useDocumentFiles({
    diagram, dirty, gateway, markSaved, finishEdit: end, getSvg, notify: showClipMessage, undo, redo, openDonate: () => setDonateOpen(true),
    load: data => { load(data); setTimelineEndRequest(0); setDocumentEpoch(value => value + 1); setActiveCell(null); setBusLabelEdit(null); setJsonPasteOpen(false); setPendingImport(null); },
  });
  const filesRef = useRef(files); filesRef.current=files;
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key=event.key.toLowerCase();
      const action=key==='s'?(event.shiftKey?'save-as':'save'):key==='o'?'open':key==='e'?'export-svg':key==='n'?'new':null;
      // Native menu accelerators must receive the key's default handling.
      if (action && !gateway.native) { event.preventDefault(); void filesRef.current.run(action); }
    };
    window.addEventListener('keydown',shortcut); return()=>window.removeEventListener('keydown',shortcut);
  },[gateway]);

  return (
    <div
      onFocusCapture={(e) => {
        if ((e.target as HTMLElement).matches('input:not([type="checkbox"]), textarea')) begin();
      }}
      onBlurCapture={end}
      className={`min-h-screen font-sans antialiased transition-colors duration-200 pb-16 ${
        isDark
          ? "bg-slate-950 text-slate-200 selection:bg-blue-600/40 selection:text-white"
          : "bg-slate-100 text-slate-800 selection:bg-blue-500/20 selection:text-slate-900"
      }`}
    >
      {/* Material 3 Top App Bar */}
      <header
        className={`sticky top-0 z-40 border-b transition-colors ${
          isDark
            ? "border-slate-800/80 bg-slate-900/90 backdrop-blur-md"
            : "border-slate-200 bg-white/90 backdrop-blur-md shadow-xs"
        }`}
      >
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className={`text-sm sm:text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
                Timing Diagram
              </h1>
              <p className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                {files.path?.split(/[\\/]/).pop() || "Untitled"} · {dirty ? "Unsaved changes" : "Unchanged"}
              </p>
            </div>
          </div>

          {/* App Bar Controls */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {['new','open','save','save-as'].map(action => <button key={action} type="button" disabled={files.busy} onClick={() => void files.run(action)} className="rounded border border-slate-500 px-2 py-1 text-xs disabled:opacity-40">{{new:'New',open:'Open',save:'Save','save-as':'Save As'}[action]}</button>)}
            <button type="button" onClick={undo} disabled={!canUndo} className="rounded px-2 py-1 text-xs disabled:opacity-30" title="Undo (Ctrl/Cmd+Z)">Undo</button>
            <button type="button" onClick={redo} disabled={!canRedo} className="rounded px-2 py-1 text-xs disabled:opacity-30" title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
            {/* Support the developer (Buy Me a Coffee) */}
            <button
              type="button"
              onClick={() => setDonateOpen(true)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                isDark
                  ? "border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
              title="Support the developer on Buy Me a Coffee"
            >
              <Coffee className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Support</span>
            </button>
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 rounded-full p-2 text-xs font-semibold transition cursor-pointer ${
                isDark
                  ? "bg-slate-800 text-amber-300 hover:bg-slate-700 hover:text-amber-200 border border-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200"
              }`}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Canvas Calibration / Settings toggle */}
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                configOpen
                  ? "bg-blue-600 text-white shadow-sm"
                  : isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Quick Export actions */}
            <button
              onClick={triggerCopySvgToClipboard}
              className={`hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                isDark
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              <Copy className="h-3.5 w-3.5" /> Copy SVG
            </button>

            <button
              onClick={triggerSvgDownload}
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 active:scale-98 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span> SVG
            </button>
          </div>
        </div>
      </header>

      <DonateModal isOpen={donateOpen} isDark={isDark} onClose={() => setDonateOpen(false)} openUrl={url => { void gateway.openExternal(url).catch(() => showClipMessage("Could not open the browser")); }} />
      {files.confirmOpen && <div role="dialog" aria-label="Unsaved changes" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="rounded-xl border border-slate-500 bg-slate-900 p-5 text-white">
          <p className="mb-4">Save changes before continuing?</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => files.answer('save')} className="rounded bg-blue-600 px-3 py-2">Save changes</button>
            <button type="button" onClick={() => files.answer('discard')} className="rounded border px-3 py-2">Discard changes</button>
            <button type="button" autoFocus onClick={() => files.answer('cancel')} className="rounded border px-3 py-2">Cancel action</button>
          </div>
        </div>
      </div>}
      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 space-y-4">
        {/* Toast Notification */}
        {clipMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2.5 text-xs shadow-xl border border-slate-700 animate-fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>{clipMessage}</span>
          </div>
        )}

        {/* Global Calibration Drawer */}
        {configOpen && (
          <div
            className={`rounded-2xl border p-4.5 shadow-sm transition space-y-3.5 ${
              isDark ? "border-slate-800 bg-slate-900/90 text-slate-200" : "border-slate-200 bg-white text-slate-800 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-2.5 border-inherit">
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <Sliders className="h-4 w-4 text-blue-500" /> Canvas & Grid Calibration
              </h3>
              <button
                onClick={() => setConfigOpen(false)}
                className={`text-xs font-semibold px-2 py-0.5 rounded cursor-pointer ${
                  isDark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-600"
                }`}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-6 text-xs">
              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Total Cycles (2–100,000)
                </label>
                <NumberField
                  integer
                  min={2}
                  max={MAX_TIMELINE_CYCLES}
                  aria-label="Total Cycles"
                  value={diagram.config.numCycles}
                  onCommit={(v) => updateConfig({ numCycles: v })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Cycle Width (24–200 px)
                </label>
                <NumberField
                  integer
                  min={24}
                  max={200}
                  value={diagram.config.cycleWidth}
                  onCommit={(v) => updateConfig({ cycleWidth: v })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Time Scale Step
                </label>
                <NumberField
                  min={0.1}
                  max={10000}
                  value={diagram.config.timeScale}
                  onCommit={(v) => updateConfig({ timeScale: v })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Time Unit
                </label>
                <input
                  type="text"
                  value={diagram.config.timeUnitLabel}
                  onChange={(e) => updateConfig({ timeUnitLabel: e.target.value })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Subdivisions
                </label>
                <select
                  value={diagram.config.gridSubdivisions}
                  onChange={(e) => updateConfig({ gridSubdivisions: parseInt(e.target.value) || 1 })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-medium text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  <option value="1">1 (Whole Cycle)</option>
                  <option value="2">2 (Half Cycle)</option>
                  <option value="4">4 (Quarter Cycle)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="toggle-grid"
                  checked={diagram.config.gridVisible}
                  onChange={(e) => updateConfig({ gridVisible: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="toggle-grid" className={`font-semibold cursor-pointer ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Grid Lines
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Interactive SVG Signal Board */}
        <div
          ref={canvasRef}
          className={`rounded-2xl border p-4.5 shadow-sm transition ${
            isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white shadow-xs"
          }`}
        >
          <div className={`mb-3.5 flex flex-wrap items-center justify-between gap-3 border-b pb-3 ${
            isDark ? "border-slate-800" : "border-slate-200"
          }`}>
            <div>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                <Layers className="h-4 w-4 text-blue-500" /> Interactive Waveform Canvas
              </h2>
              <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Click to change a cell, drag to paint, or double-click a bus segment to edit its label.
              </p>
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <button type="button" disabled={diagram.config.numCycles >= MAX_TIMELINE_CYCLES}
                className="rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40"
                onClick={() => { updateConfig({ numCycles: Math.min(MAX_TIMELINE_CYCLES, diagram.config.numCycles + 100) }); setTimelineEndRequest(n => n + 1); }}>
                +100 cycles
              </button>
              <button type="button" className="rounded-full border px-3 py-1 text-xs font-semibold" onClick={() => setTimelineEndRequest(n => n + 1)}>Go to end</button>
              <button
                onClick={() => setRepeatFoldOpen(!repeatFoldOpen)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  repeatFoldOpen
                    ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                    : isDark
                    ? "bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700"
                    : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                }`}
                title="Detect repeating waveform patterns or fold time ranges"
              >
                <Repeat className="h-3.5 w-3.5" />
                <span>Repeat & Folds</span>
                {((diagram.folds?.length || 0) + (diagram.repeatRanges?.length || 0) > 0) && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500 text-white font-mono">
                    {(diagram.folds?.length || 0) + (diagram.repeatRanges?.length || 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  void files.run('new');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  isDark
                    ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900"
                }`}
                title="Reset to default initial timing diagram"
              >
                <RotateCcw className="h-3.5 w-3.5 text-rose-500" /> Reset
              </button>
              <button
                onClick={exportJsonConfig}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  isDark
                    ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                <FileCode className="h-3.5 w-3.5 text-blue-500" /> Copy JSON
              </button>
              <button
                onClick={() => { setJsonPasteOpen(!jsonPasteOpen); setPendingImport(null); setJsonImportError(null); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                  isDark
                    ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                }`}
              >
                <Code className="h-3.5 w-3.5 text-emerald-500" /> Load JSON
              </button>
            </div>
          </div>

          {/* Repeat & Fold Drawer / Modal */}
          {repeatFoldOpen && (
            <div className="mb-4">
              <RepeatFoldManager
                theme={theme}
                config={diagram.config}
                signals={diagram.signals}
                repeatRanges={diagram.repeatRanges || []}
                folds={diagram.folds || []}
                onAddRepeatRange={handleAddRepeatRange}
                onRemoveRepeatRange={handleRemoveRepeatRange}
                onAddFold={handleAddFold}
                onRemoveFold={handleRemoveFold}
                onClose={() => setRepeatFoldOpen(false)}
              />
            </div>
          )}

          {/* JSON Paste Drawer */}
          {jsonPasteOpen && (
            <div className={`mb-4 p-4 rounded-xl border space-y-2.5 ${
              isDark ? "bg-slate-950 border-slate-800" : "bg-slate-50 border-slate-200"
            }`}>
              <span className={`block text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                Paste Diagram JSON:
              </span>
              <textarea
                value={jsonPasteText}
                onChange={(e) => { setJsonPasteText(e.target.value); setJsonImportError(null); setPendingImport(null); }}
                placeholder='{"config": {...}, "signals": [...]}'
                className={`w-full p-2.5 h-24 rounded-lg font-mono text-xs border focus:outline-none focus:border-blue-500 ${
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                }`}
              />
              {jsonImportError && <p role="alert" className="text-xs text-rose-500">{jsonImportError}</p>}
              {pendingImport && (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-amber-500">
                  <span>Discard unsaved changes and load this diagram?</span>
                  <button type="button" onClick={() => applyImport(pendingImport)} className="rounded border px-2 py-1">Discard and import</button>
                  <button type="button" onClick={() => setPendingImport(null)} className="rounded border px-2 py-1">Keep editing</button>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setJsonPasteOpen(false); setPendingImport(null); }}
                  className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                    isDark ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJsonImportSubmit}
                  className="px-3.5 py-1 text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-semibold rounded-lg cursor-pointer"
                >
                  Import
                </button>
              </div>
            </div>
          )}

          {/* Waveform Canvas */}
          <WaveformCanvas
            key={documentEpoch}
            theme={theme}
            config={diagram.config}
            timelineEndRequest={timelineEndRequest}
            signals={diagram.signals}
            markers={diagram.markers}
            constraints={diagram.constraints}
            repeatRanges={diagram.repeatRanges || []}
            folds={diagram.folds || []}
            onCanvasClick={handleCanvasCellClick}
            activeCell={activeCell}
            onPaintCells={paintCells}
            onPaintStart={begin}
            onPaintEnd={end}
            onBusLabelEdit={openBusLabel}
            onTimelineDoubleClick={handleTimelineDoubleClick}
            onUpdateSignals={updateSignals}
            onRemoveFold={handleRemoveFold}
            onRemoveRepeatRange={handleRemoveRepeatRange}
          />

          {busLabelEdit && (
            <div role="dialog" aria-label="Edit bus label" className="mt-3 rounded-xl border border-blue-500 bg-slate-900 p-4 text-white">
              <label className="text-sm">Bus label at cycle {busLabelEdit.cycleIndex}
                <input autoFocus aria-label="Bus label" className="ml-3 rounded border border-slate-500 bg-slate-950 px-2 py-1" value={busLabelEdit.value}
                  onChange={e => setBusLabelEdit({ ...busLabelEdit, value: e.target.value })}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); commitBusLabel(); } if (e.key === 'Escape') setBusLabelEdit(null); }} />
              </label>
              <button type="button" className="ml-3 px-2" onClick={commitBusLabel}>Apply label</button>
              <button type="button" className="ml-3 px-2" onClick={() => setBusLabelEdit(null)}>Cancel label</button>
            </div>
          )}
          {/* Cell Segment Painter Floating Deck */}
          {activeCell && (() => {
            const sig = diagram.signals.find((s) => s.id === activeCell.signalId);
            if (!sig) return null;

            const currentWave = sig.waveStr.padEnd(diagram.config.numCycles, ".");
            const activeStateChar = parseWaveform(currentWave, diagram.config.numCycles)[activeCell.cycleIndex];

            return (
              <div
                className={`mt-4 rounded-xl border p-3.5 space-y-3 transition ${
                  isDark
                    ? "border-blue-500/40 bg-slate-950/90 text-slate-200 shadow-md"
                    : "border-blue-300 bg-blue-50/50 text-slate-800 shadow-sm"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="font-bold">Segment Painter:</span>
                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs ${
                      isDark ? "bg-blue-950 text-blue-300 border border-blue-800/50" : "bg-blue-100 text-blue-700"
                    }`}>
                      {sig.name}
                    </span>
                    <span className={isDark ? "text-slate-500" : "text-slate-400"}>@</span>
                    <span className={`px-2 py-0.5 rounded font-mono text-xs ${
                      isDark ? "bg-slate-900 border border-slate-800 text-slate-300" : "bg-white border border-slate-200 text-slate-700"
                    }`}>
                      Cycle {activeCell.cycleIndex} ({formatTime(activeCell.cycleIndex, diagram.config)})
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    {[
                      { label: "Low (0)", char: "0", bg: "hover:bg-slate-200 dark:hover:bg-slate-800" },
                      { label: "High (1)", char: "1", bg: "hover:bg-blue-100 dark:hover:bg-blue-950/60" },
                      { label: "Hi-Z (Z)", char: "z", bg: "hover:bg-emerald-100 dark:hover:bg-emerald-950/60" },
                      { label: "Undefined (X)", char: "x", bg: "hover:bg-purple-100 dark:hover:bg-purple-950/60" },
                      { label: "Bus (=)", char: "=", bg: "hover:bg-amber-100 dark:hover:bg-amber-950/60" },
                    ].map((cellType) => {
                      const isClock = sig.type === "clock";
                      const isActive = activeStateChar === cellType.char;

                      return (
                        <button
                          key={`paint-${cellType.char}`}
                          disabled={isClock}
                          onClick={() => paintCellState(cellType.char as WaveState)}
                          className={`rounded-lg border px-3 py-1 text-xs font-semibold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            isActive
                              ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                              : isDark
                              ? "border-slate-750 bg-slate-900 text-slate-300 hover:text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:text-slate-900"
                          } ${cellType.bg}`}
                        >
                          {cellType.label}
                        </button>
                      );
                    })}

                    {sig.type === 'clock' && <button type="button" className="rounded border px-3 py-1" onClick={() => updateSignals(diagram.signals.map(s => s.id === sig.id ? clockToBinary(s, diagram.config.numCycles) : s))}>Convert clock to Binary</button>}
                    <button
                      onClick={() => setActiveCell(null)}
                      className={`px-2.5 py-1 text-xs font-medium cursor-pointer ${
                        isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                {/* Inline Bus values parameter editing deck */}
                {sig.type === "bus" && activeStateChar === "=" && (
                  <div className={`flex flex-col md:flex-row md:items-end gap-3 pt-3 border-t text-xs ${
                    isDark ? "border-slate-800" : "border-slate-200"
                  }`}>
                    <div className="flex-1 space-y-1">
                      <label className="block text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                        Bus Value at Cycle #{activeCell.cycleIndex}
                      </label>
                      <input
                        type="text"
                        value={sig.busValues[activeCell.cycleIndex] || ""}
                        placeholder="e.g. 0xA5, 255, 11001010, ACK"
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = diagram.signals.map((s) => {
                            if (s.id === sig.id) {
                              return {
                                ...s,
                                busValues: { ...s.busValues, [activeCell.cycleIndex]: val },
                              };
                            }
                            return s;
                          });
                          updateSignals(updated);
                        }}
                        className={`w-full rounded-lg border px-3 py-1.5 font-mono text-xs focus:outline-none focus:border-amber-500 ${
                          isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-900"
                        }`}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2.5 items-end">
                      <div className="space-y-1">
                        <label className={`block text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          Format
                        </label>
                        <select
                          value={sig.busFormat || "hex"}
                          onChange={(e) => {
                            const format = e.target.value as any;
                            const updated = diagram.signals.map((s) =>
                              s.id === sig.id ? { ...s, busFormat: format } : s
                            );
                            updateSignals(updated);
                          }}
                          className={`rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500 ${
                            isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-300 bg-white text-slate-800"
                          }`}
                        >
                          <option value="hex">16進数 (Hex)</option>
                          <option value="dec">10進数 (Dec)</option>
                          <option value="bin">2進数 (Bin)</option>
                          <option value="string">文字列 (String)</option>
                        </select>
                      </div>

                      {sig.busFormat !== "string" && <div className="space-y-1">
                        <label className={`block text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          Bit Width
                        </label>
                        <NumberField
                          integer
                          min={1}
                          max={32}
                          value={sig.busWidth || 8}
                          onCommit={(v) => updateSignals(diagram.signals.map((s) => s.id === sig.id ? { ...s, busWidth: v } : s))}
                          className={`w-16 rounded-lg border px-2 py-1.5 font-mono text-xs focus:outline-none focus:border-amber-500 ${
                            isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-900"
                          }`}
                        />
                      </div>}

                      {busHasBits(sig) && <button
                        onClick={() => {
                          const updated = diagram.signals.map((s) =>
                            s.id === sig.id ? { ...s, isExpanded: !s.isExpanded } : s
                          );
                          updateSignals(updated);
                        }}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                          sig.isExpanded
                            ? isDark
                              ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                              : "bg-amber-100 border border-amber-300 text-amber-800"
                            : isDark
                            ? "bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800"
                            : "bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {sig.isExpanded ? "Collapse Bits" : "Expand Bits"}
                      </button>}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* 3. Lower Control Panels Deck (Three Columns) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Deck 1: Signal Channels Editor */}
          <div
            className={`rounded-2xl border p-4.5 shadow-sm transition ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white shadow-xs"
            }`}
          >
            <SignalEditor
              theme={theme}
              signals={diagram.signals}
              config={diagram.config}
              onUpdateSignals={updateSignals}
            />
          </div>

          {/* Deck 2: Annotations & Constraints */}
          <div
            className={`rounded-2xl border p-4.5 shadow-sm transition ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white shadow-xs"
            }`}
          >
            <ConstraintTable
              theme={theme}
              constraints={diagram.constraints}
              signals={diagram.signals}
              config={diagram.config}
              onUpdateConstraints={updateConstraints}
            />
          </div>

          {/* Deck 3: Markers & Academic Reference */}
          <div
            className={`rounded-2xl border p-4.5 shadow-sm transition flex flex-col justify-between space-y-4 ${
              isDark ? "border-slate-800 bg-slate-900/80" : "border-slate-200 bg-white shadow-xs"
            }`}
          >
            <MarkerTable
              theme={theme}
              markers={diagram.markers}
              config={diagram.config}
              onUpdateMarkers={updateMarkers}
            />

            {/* Reference info card */}
            <div
              className={`rounded-xl border p-3.5 text-xs leading-relaxed space-y-2 ${
                isDark ? "border-slate-800 bg-slate-950/60 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <span className={`font-bold flex items-center gap-1.5 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                <Info className="h-4 w-4 text-blue-500" /> Timing Legend Reference
              </span>
              <ul className={`text-[11px] space-y-1 list-disc list-inside ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <li><strong className="text-blue-500 font-mono">t_su:</strong> Setup time requirement before edge.</li>
                <li><strong className="text-pink-500 font-mono">t_h:</strong> Hold time requirement after edge.</li>
                <li><strong className="text-emerald-500 font-mono">Hi-Z (Z):</strong> High-impedance tri-state line.</li>
                <li><strong className="text-purple-500 font-mono">Undefined (X):</strong> Unknown / invalid region.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
