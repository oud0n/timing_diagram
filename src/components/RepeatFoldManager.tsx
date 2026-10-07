import React, { useState, useEffect } from "react";
import { Signal, RepeatRange, TimeFold, DiagramConfig } from "../types";
import {
  verifyRepeatPattern,
  findRepeatingPatterns,
  DetectedRepeatPattern,
  RepeatMatchResult,
} from "../utils";
import {
  Repeat,
  FoldHorizontal,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  X,
  Eye,
  Sliders,
} from "lucide-react";

interface RepeatFoldManagerProps {
  config: DiagramConfig;
  signals: Signal[];
  repeatRanges: RepeatRange[];
  folds: TimeFold[];
  theme?: "dark" | "light";
  onAddRepeatRange: (range: RepeatRange) => void;
  onRemoveRepeatRange: (id: string) => void;
  onAddFold: (fold: TimeFold) => void;
  onRemoveFold: (id: string) => void;
  onClose?: () => void;
}

export const RepeatFoldManager: React.FC<RepeatFoldManagerProps> = ({
  config,
  signals,
  repeatRanges,
  folds,
  theme = "dark",
  onAddRepeatRange,
  onRemoveRepeatRange,
  onAddFold,
  onRemoveFold,
  onClose,
}) => {
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<"detect" | "manual" | "folds" | "repeats">("detect");

  // Manual repeat check form state
  const [manualStart, setManualStart] = useState<number>(0);
  const [manualPeriod, setManualPeriod] = useState<number>(2);
  const [manualCount, setManualCount] = useState<number>(3);
  const [manualLabel, setManualLabel] = useState<string>("Burst");
  const [manualColor, setManualColor] = useState<string>("#0284c7");
  const [manualCheckResult, setManualCheckResult] = useState<RepeatMatchResult | null>(null);

  // Manual fold form state
  const [foldStart, setFoldStart] = useState<number>(4);
  const [foldEnd, setFoldEnd] = useState<number>(10);
  const [foldLabel, setFoldLabel] = useState<string>("Wait");

  // Auto scan results - automatically excludes folded or repeat-omitted ranges
  const [detectedList, setDetectedList] = useState<DetectedRepeatPattern[]>(() =>
    findRepeatingPatterns(signals, config.numCycles, folds, repeatRanges)
  );

  // Keep detected list in sync when signals, folds, or repeatRanges change
  useEffect(() => {
    setDetectedList(findRepeatingPatterns(signals, config.numCycles, folds, repeatRanges));
  }, [signals, config.numCycles, folds, repeatRanges]);

  const handleScan = () => {
    const list = findRepeatingPatterns(signals, config.numCycles, folds, repeatRanges);
    setDetectedList(list);
  };

  const handleVerifyManual = () => {
    const res = verifyRepeatPattern(
      signals,
      manualStart,
      manualPeriod,
      manualCount,
      config.numCycles
    );
    setManualCheckResult(res);
  };

  const applyRepeatFromCandidate = (cand: DetectedRepeatPattern) => {
    const newRepeat: RepeatRange = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      startCycle: cand.startCycle,
      endCycle: cand.endCycle,
      period: cand.period,
      count: cand.repeatCount,
      label: cand.period === 2 ? "" : `${cand.period}cyc`,
      color: "#0284c7",
      omitRepetitions: true, // Omits 2nd+ iterations, drawing 1 instance (e.g. 10) with "repeat N"
    };
    // Immediately remove from candidate list for smooth UX
    setDetectedList((prev) =>
      prev.filter(
        (c) =>
          !(
            c.startCycle === cand.startCycle &&
            c.endCycle === cand.endCycle &&
            c.period === cand.period
          )
      )
    );
    onAddRepeatRange(newRepeat);
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-lg transition-all ${
        isDark
          ? "border-slate-800 bg-slate-900/95 text-slate-200"
          : "border-slate-200 bg-white text-slate-800"
      }`}
    >
      {/* Modal / Panel Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-700/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Repeat className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight flex items-center gap-2">
              Waveform Repeat & Horizontal Folding
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-blue-500/15 text-blue-500">
                Verdi CAD Style
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Detect matching signal periods, render repeat brackets above Time, or collapse idle cycles with break lines.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mt-4 p-1 rounded-xl bg-slate-800/60 border border-slate-700/50">
        <button
          onClick={() => setActiveTab("detect")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "detect"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Auto Repeat Detection ({detectedList.length})
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "manual"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
          }`}
        >
          <Sliders className="h-3.5 w-3.5" /> Manual Pattern Verifier
        </button>
        <button
          onClick={() => setActiveTab("folds")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "folds"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
          }`}
        >
          <FoldHorizontal className="h-3.5 w-3.5" /> Active Folds ({folds.length})
        </button>
        <button
          onClick={() => setActiveTab("repeats")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeTab === "repeats"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/40"
          }`}
        >
          <Repeat className="h-3.5 w-3.5" /> Repeat Markers ({repeatRanges.length})
        </button>
      </div>

      {/* Tab 1: Auto Repeat Detection */}
      {activeTab === "detect" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Scans all {signals.length} signals across {config.numCycles} cycles for identical repeating states.
            </span>
            <button
              onClick={handleScan}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-amber-400" /> Re-scan Waveform
            </button>
          </div>

          {detectedList.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
              No periodic repeating patterns detected across all signals.
              <p className="mt-1 text-slate-500">
                Tip: You can use the "Manual Pattern Verifier" tab to test a specific time range.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {detectedList.map((cand, idx) => (
                <div
                  key={`cand-${idx}`}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isDark ? "bg-slate-800/40 border-slate-700/60" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-400 font-mono">
                        {cand.repeatCount}x Repeats
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Period: {cand.period} cycles
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        Cycles {cand.startCycle}..{cand.endCycle} ({cand.endCycle - cand.startCycle} total)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      All {signals.length} signals match perfectly across all {cand.repeatCount} iterations.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => applyRepeatFromCandidate(cand)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                      title="Draws 1 base waveform (e.g. 10) with 'repeat N' on top and omits remaining repetitive graphs"
                    >
                      <Repeat className="h-3.5 w-3.5" /> Convert to Repeat {cand.repeatCount}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Pattern Verifier */}
      {activeTab === "manual" && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-mono font-medium">Start Cycle</label>
              <input
                type="number"
                min={0}
                max={config.numCycles - 1}
                value={manualStart}
                onChange={(e) => setManualStart(parseInt(e.target.value, 10) || 0)}
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-mono font-medium">Period (Cycles)</label>
              <input
                type="number"
                min={1}
                max={config.numCycles}
                value={manualPeriod}
                onChange={(e) => setManualPeriod(parseInt(e.target.value, 10) || 1)}
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-mono font-medium">Repeat Count (Min 3)</label>
              <input
                type="number"
                min={3}
                max={50}
                value={manualCount}
                onChange={(e) => setManualCount(parseInt(e.target.value, 10) || 3)}
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-mono font-medium">Label</label>
              <input
                type="text"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder="e.g. Burst"
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleVerifyManual}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Verify Consistency
            </button>
            <span className="text-xs text-slate-400">
              Total range: Cycles {manualStart}..{manualStart + manualPeriod * manualCount} (
              {manualPeriod * manualCount} cycles)
            </span>
          </div>

          {/* Verification Result Feedback */}
          {manualCheckResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                manualCheckResult.valid
                  ? isDark
                    ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-300"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : isDark
                  ? "bg-rose-950/40 border-rose-800/60 text-rose-300"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {manualCheckResult.valid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-bold">
                  {manualCheckResult.valid
                    ? `✓ Verification Passed: All ${signals.length} signals match across all ${manualCount} iterations!`
                    : `⚠️ Verification Failed: Waveform mismatch`}
                </div>
                <div className="text-[11px] mt-0.5 opacity-90">
                  {manualCheckResult.valid
                    ? `Pattern length = ${manualPeriod} cycles, repeats ${manualCount} times (total ${manualCheckResult.totalCycles} cycles).`
                    : manualCheckResult.error}
                </div>

                {manualCheckResult.valid && (
                  <div className="flex items-center gap-2 mt-2.5">
                    <button
                      onClick={() => {
                        onAddRepeatRange({
                          id: `rep_${Date.now()}`,
                          startCycle: manualStart,
                          endCycle: manualStart + manualPeriod * manualCount,
                          period: manualPeriod,
                          count: manualCount,
                          label: manualLabel,
                          color: manualColor,
                          omitRepetitions: true,
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                      title="Draws 1 instance (e.g. 10) with 'repeat N' on top and omits subsequent graphs"
                    >
                      <Repeat className="h-3.5 w-3.5" /> Convert to Repeat {manualCount}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Active Folds */}
      {activeTab === "folds" && (
        <div className="mt-4 space-y-4">
          <div className="flex items-end gap-3 text-xs">
            <div className="flex-1">
              <label className="block text-slate-400 mb-1 font-mono">Start Cycle</label>
              <input
                type="number"
                min={0}
                max={config.numCycles}
                value={foldStart}
                onChange={(e) => setFoldStart(parseInt(e.target.value, 10) || 0)}
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-slate-400 mb-1 font-mono">End Cycle</label>
              <input
                type="number"
                min={0}
                max={config.numCycles}
                value={foldEnd}
                onChange={(e) => setFoldEnd(parseInt(e.target.value, 10) || 0)}
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <div className="flex-1">
              <label className="block text-slate-400 mb-1 font-mono">Label (Optional)</label>
              <input
                type="text"
                value={foldLabel}
                onChange={(e) => setFoldLabel(e.target.value)}
                placeholder="Wait 20 cycles"
                className={`w-full px-2.5 py-1.5 rounded-lg border font-mono ${
                  isDark
                    ? "bg-slate-800 border-slate-700 text-white"
                    : "bg-slate-50 border-slate-300 text-slate-900"
                }`}
              />
            </div>
            <button
              onClick={() => {
                if (foldEnd > foldStart) {
                  onAddFold({
                    id: `fold_${Date.now()}`,
                    startCycle: foldStart,
                    endCycle: foldEnd,
                    label: foldLabel,
                  });
                }
              }}
              disabled={foldEnd <= foldStart}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition h-[34px]"
            >
              <Plus className="h-3.5 w-3.5" /> Add Fold
            </button>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Folded Break Regions ({folds.length})
            </h4>
            {folds.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
                No active horizontal folds. Folds collapse large idle ranges into a compact break (≈).
              </div>
            ) : (
              folds.map((f) => (
                <div
                  key={f.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-amber-400">
                      ≈ Cycles {f.startCycle}..{f.endCycle}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      (+{Math.abs(f.endCycle - f.startCycle)} omitted)
                    </span>
                    {f.label && (
                      <span className="px-2 py-0.5 rounded bg-slate-700/60 font-mono text-[10px] text-slate-300">
                        {f.label}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemoveFold(f.id)}
                    className="p-1 rounded hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                    title="Unfold / remove break"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Repeat Markers */}
      {activeTab === "repeats" && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Active Repeat Range Brackets displayed above the Time Ruler.
            </span>
          </div>

          {repeatRanges.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-700 text-center text-xs text-slate-400">
              No repeat range markers yet. You can add them from the "Auto Repeat Detection" or "Manual Pattern Verifier" tabs.
            </div>
          ) : (
            <div className="space-y-1.5">
              {repeatRanges.map((rep) => (
                <div
                  key={rep.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isDark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: rep.color || "#0284c7" }}
                    />
                    <span className="font-mono font-bold text-blue-400">
                      Repeat {rep.count}
                    </span>
                    <span className="font-mono text-slate-400">
                      Cycles {rep.startCycle}..{rep.endCycle}
                    </span>
                    {rep.label && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-mono text-[10px]">
                        {rep.label}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => onRemoveRepeatRange(rep.id)}
                    className="p-1 rounded hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                    title="Remove repeat marker"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
