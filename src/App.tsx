import { useState } from "react";
import { Signal, Marker, Constraint, DiagramConfig, TimingDiagramData, RepeatRange, TimeFold } from "./types";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { SignalEditor } from "./components/SignalEditor";
import { MarkerTable } from "./components/MarkerTable";
import { ConstraintTable } from "./components/ConstraintTable";
import { RepeatFoldManager } from "./components/RepeatFoldManager";
import { INITIAL_DIAGRAM } from "./utils";
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
} from "lucide-react";

export default function App() {
  // Theme state: default to dark, supports instant toggling
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

  // Core diagram state
  const [diagram, setDiagram] = useState<TimingDiagramData>(INITIAL_DIAGRAM);
  const [activeCell, setActiveCell] = useState<{ signalId: string; cycleIndex: number } | null>(null);

  // Drawer / Modal states
  const [configOpen, setConfigOpen] = useState(false);
  const [repeatFoldOpen, setRepeatFoldOpen] = useState(false);
  const [clipMessage, setClipMessage] = useState<string | null>(null);
  const [jsonPasteOpen, setJsonPasteOpen] = useState(false);
  const [jsonPasteText, setJsonPasteText] = useState("");

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

  const paintCellState = (stateChar: string) => {
    if (!activeCell) return;
    const { signalId, cycleIndex } = activeCell;

    const sig = diagram.signals.find((s) => s.id === signalId);
    if (!sig) return;

    let currentWave = sig.waveStr.padEnd(diagram.config.numCycles, ".");
    const charArray = currentWave.split("");
    charArray[cycleIndex] = stateChar;
    const updatedWave = charArray.join("");

    const updatedSignals = diagram.signals.map((s) => {
      if (s.id === signalId) {
        const updatedBusValues = { ...s.busValues };
        if (stateChar !== "=") {
          delete updatedBusValues[cycleIndex];
        } else {
          updatedBusValues[cycleIndex] = updatedBusValues[cycleIndex] || "DATA";
        }
        return {
          ...s,
          waveStr: updatedWave,
          busValues: updatedBusValues,
        };
      }
      return s;
    });

    updateSignals(updatedSignals);
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

  const triggerSvgDownload = () => {
    try {
      const svgEl = document.querySelector("svg");
      if (!svgEl) return;

      const clone = svgEl.cloneNode(true) as SVGElement;
      const elementsToHide = clone.querySelectorAll(".cursor-pointer, rect[fill='transparent']");
      elementsToHide.forEach((el) => el.remove());

      const svgString = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([`<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${svgString}`], {
        type: "image/svg+xml;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `timing_diagram_${Date.now()}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  const triggerCopySvgToClipboard = () => {
    try {
      const svgEl = document.querySelector("svg");
      if (!svgEl) return;

      const clone = svgEl.cloneNode(true) as SVGElement;
      const elementsToHide = clone.querySelectorAll(".cursor-pointer, rect[fill='transparent']");
      elementsToHide.forEach((el) => el.remove());

      const svgString = new XMLSerializer().serializeToString(clone);
      navigator.clipboard.writeText(svgString);
      showClipMessage("SVG copied to clipboard");
    } catch (err) {
      showClipMessage("Clipboard access restricted");
    }
  };

  const exportJsonConfig = () => {
    const str = JSON.stringify(diagram, null, 2);
    navigator.clipboard.writeText(str);
    showClipMessage("JSON configuration copied");
  };

  const handleJsonImportSubmit = () => {
    try {
      const obj = JSON.parse(jsonPasteText);
      if (obj.config && obj.signals) {
        setDiagram(obj);
        setJsonPasteOpen(false);
        setJsonPasteText("");
        showClipMessage("Diagram loaded successfully");
      }
    } catch (err: any) {
      alert(`Invalid JSON format: ${err.message}`);
    }
  };

  const showClipMessage = (msg: string) => {
    setClipMessage(msg);
    setTimeout(() => {
      setClipMessage(null);
    }, 3000);
  };

  return (
    <div
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
                Timing Diagram Editor
              </h1>
              <p className={`text-[11px] font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                Digital Hardware & Waveform Specification
              </p>
            </div>
          </div>

          {/* App Bar Controls */}
          <div className="flex items-center gap-2">
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
                  Total Cycles (1-1000)
                </label>
                <input
                  type="number"
                  min="2"
                  max="1000"
                  value={diagram.config.numCycles}
                  onChange={(e) => updateConfig({ numCycles: Math.min(1000, Math.max(2, parseInt(e.target.value) || 10)) })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Cycle Width (px)
                </label>
                <input
                  type="number"
                  min="24"
                  max="200"
                  value={diagram.config.cycleWidth}
                  onChange={(e) => updateConfig({ cycleWidth: parseInt(e.target.value) || 65 })}
                  className={`w-full rounded-lg border px-2.5 py-1.5 font-mono text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-750 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <label className={`block font-medium mb-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  Time Scale Step
                </label>
                <input
                  type="number"
                  min="0.1"
                  max="10000"
                  value={diagram.config.timeScale}
                  onChange={(e) => updateConfig({ timeScale: parseFloat(e.target.value) || 10 })}
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
                Vector timing rendering. Click any cell on the grid to change its state.
              </p>
            </div>

            <div className="flex gap-2 items-center flex-wrap">
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
                  if (confirm("Reset canvas to default initial signals?")) {
                    setDiagram(INITIAL_DIAGRAM);
                    showClipMessage("Canvas reset to default");
                  }
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
                onClick={() => setJsonPasteOpen(!jsonPasteOpen)}
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
                onChange={(e) => setJsonPasteText(e.target.value)}
                placeholder='{"config": {...}, "signals": [...]}'
                className={`w-full p-2.5 h-24 rounded-lg font-mono text-xs border focus:outline-none focus:border-blue-500 ${
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"
                }`}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setJsonPasteOpen(false)}
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
            theme={theme}
            config={diagram.config}
            signals={diagram.signals}
            markers={diagram.markers}
            constraints={diagram.constraints}
            repeatRanges={diagram.repeatRanges || []}
            folds={diagram.folds || []}
            onCanvasClick={handleCanvasCellClick}
            onTimelineDoubleClick={handleTimelineDoubleClick}
            onUpdateSignals={updateSignals}
            onRemoveFold={handleRemoveFold}
            onRemoveRepeatRange={handleRemoveRepeatRange}
          />

          {/* Cell Segment Painter Floating Deck */}
          {activeCell && (() => {
            const sig = diagram.signals.find((s) => s.id === activeCell.signalId);
            if (!sig) return null;

            const currentWave = sig.waveStr.padEnd(diagram.config.numCycles, ".");
            const activeStateChar = currentWave[activeCell.cycleIndex] || ".";

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
                      Cycle {activeCell.cycleIndex} ({activeCell.cycleIndex * diagram.config.timeScale} {diagram.config.timeUnitLabel})
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
                          onClick={() => paintCellState(cellType.char)}
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

                      <div className="space-y-1">
                        <label className={`block text-[11px] font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          Bit Width
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="32"
                          value={sig.busWidth || 8}
                          onChange={(e) => {
                            const width = parseInt(e.target.value) || 8;
                            const updated = diagram.signals.map((s) =>
                              s.id === sig.id ? { ...s, busWidth: width } : s
                            );
                            updateSignals(updated);
                          }}
                          className={`w-16 rounded-lg border px-2 py-1.5 font-mono text-xs focus:outline-none focus:border-amber-500 ${
                            isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-300 bg-white text-slate-900"
                          }`}
                        />
                      </div>

                      <button
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
                      </button>
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
