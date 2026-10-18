import React, { useState } from "react";
import { NumberField } from "./NumberField";
import { MAX_TIMELINE_CYCLES } from "../timeline";
import { Signal, SignalType, DiagramConfig } from "../types";
import { busHasBits } from "../utils";
import { Plus, Trash, ArrowUp, ArrowDown, Settings, HelpCircle, ChevronDown, ChevronRight } from "lucide-react";

interface SignalEditorProps {
  signals: Signal[];
  config: DiagramConfig;
  theme?: "dark" | "light";
  onUpdateSignals: (newSignals: Signal[]) => void;
}

const DEFAULT_CLOCK = { period: 2, dutyCycle: 50, phase: 0, inverted: false };

const PRESET_COLORS = [
  "#2563EB", // Blue
  "#7C3AED", // Violet
  "#059669", // Emerald
  "#EA580C", // Orange
  "#DB2777", // Pink
  "#0284C7", // Sky
  "#DC2626", // Red
  "#475569", // Slate
];

export const SignalEditor: React.FC<SignalEditorProps> = ({
  signals,
  config,
  theme = "dark",
  onUpdateSignals,
}) => {
  const isDark = theme === "dark";
  const [activeSignalSettings, setActiveSignalSettings] = useState<string | null>(null);

  const addSignal = () => {
    const id = `sig_${Date.now()}`;
    const newSig: Signal = {
      id,
      name: `CLK_${signals.length + 1}`,
      type: "binary",
      color: PRESET_COLORS[signals.length % PRESET_COLORS.length],
      strokeWidth: 2.5,
      height: 40,
      waveStr: "0.1.0.1.".padEnd(config.numCycles, "."),
      busValues: {},
    };
    onUpdateSignals([...signals, newSig]);
    setActiveSignalSettings(id);
  };

  const updateSignal = (id: string, updatedFields: Partial<Signal>) => {
    const updated = signals.map((s) => (s.id === id ? { ...s, ...updatedFields } : s));
    onUpdateSignals(updated);
  };

  const updateClockConfig = (id: string, updatedFields: any) => {
    const sig = signals.find((s) => s.id === id);
    if (!sig) return;
    const currentClock = sig.clockConfig || { period: 2, dutyCycle: 50, phase: 0, inverted: false };
    updateSignal(id, {
      clockConfig: { ...currentClock, ...updatedFields },
    });
  };

  const deleteSignal = (id: string) => {
    onUpdateSignals(signals.filter((s) => s.id !== id));
    if (activeSignalSettings === id) setActiveSignalSettings(null);
  };

  const moveSignal = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === signals.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const result = [...signals];
    const [removed] = result.splice(index, 1);
    result.splice(targetIndex, 0, removed);
    onUpdateSignals(result);
  };

  // Extract all cycle indices that are '=' in waveStr
  const getBusIndices = (sig: Signal): number[] => {
    const indices: number[] = [];
    for (let i = 0; i < config.numCycles; i++) {
      const char = i < sig.waveStr.length ? sig.waveStr[i] : ".";
      if (char === "=") {
        indices.push(i);
      }
    }
    return indices;
  };

  return (
    <div className="w-full space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-800"}`}>
            Signal Tracks
          </h3>
          <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {signals.length} active channels
          </p>
        </div>
        <button
          onClick={addSignal}
          className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 active:scale-98 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Add Track
        </button>
      </div>

      {signals.length === 0 ? (
        <div className={`rounded-xl border border-dashed p-6 text-center text-xs ${
          isDark ? "border-slate-800 bg-slate-900/40 text-slate-400" : "border-slate-200 bg-slate-50/60 text-slate-500"
        }`}>
          No signals added yet. Click &quot;Add Track&quot; or select a preset to begin.
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {signals.map((sig, index) => {
            const isSettingsOpen = activeSignalSettings === sig.id;
            const busIndices = getBusIndices(sig);

            return (
              <div
                key={sig.id}
                className={`rounded-xl border p-3 transition-all ${
                  isDark
                    ? isSettingsOpen
                      ? "border-blue-500/80 bg-slate-800/90 shadow-md ring-1 ring-blue-500/30"
                      : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                    : isSettingsOpen
                    ? "border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-200"
                    : "border-slate-200 bg-white hover:border-slate-300 shadow-xs"
                }`}
              >
                {/* Main Track Row */}
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {/* Left Metadata */}
                  <div className="flex items-center gap-2">
                    {/* Drag Buttons/Move arrows */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveSignal(index, "up")}
                        disabled={index === 0}
                        className={`hover:opacity-100 disabled:opacity-20 cursor-pointer ${
                          isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"
                        }`}
                        title="Move Up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveSignal(index, "down")}
                        disabled={index === signals.length - 1}
                        className={`hover:opacity-100 disabled:opacity-20 cursor-pointer ${
                          isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"
                        }`}
                        title="Move Down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Color Dot Indicator */}
                    <div
                      className="h-4 w-4 rounded-full shadow-xs shrink-0"
                      style={{ backgroundColor: sig.color }}
                    />

                    {/* Channel name field */}
                    <input
                      type="text"
                      value={sig.name}
                      onChange={(e) => updateSignal(sig.id, { name: e.target.value })}
                      className={`w-28 font-bold text-xs font-mono px-2 py-1 rounded-lg border transition-all ${
                        isDark
                          ? "border-slate-750 bg-slate-950/60 text-slate-100 focus:border-blue-500 focus:bg-slate-950"
                          : "border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white"
                      } focus:outline-none`}
                      placeholder="Signal Label"
                    />
                  </div>

                  {/* Middle Controls (Wave shorthand entry & State selector) */}
                  <div className="flex flex-1 items-center gap-2 min-w-[170px]">
                    {sig.type === "clock" ? (
                      <span className={`text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        Clock: Period={sig.clockConfig?.period || 2} cycles
                      </span>
                    ) : (
                      <div className="relative w-full">
                        <input
                          type="text"
                          value={sig.waveStr}
                          maxLength={MAX_TIMELINE_CYCLES}
                          onChange={(e) => updateSignal(sig.id, { waveStr: e.target.value.replace(/[^01zx=.~\-hl]/gi, "") })}
                          className={`w-full font-mono text-xs rounded-lg border px-2.5 py-1 transition-all ${
                            isDark
                              ? "bg-slate-950/60 border-slate-750 text-slate-100 placeholder-slate-500 focus:border-blue-500"
                              : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white"
                          } focus:outline-none`}
                          placeholder={`Waveform notation (len ${config.numCycles})`}
                          title="Shorthand notation. E.g., '01.z.x.='"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1.5">
                    {/* Signal type selector */}
                    <select
                      value={sig.type}
                      onChange={(e) => {
                        const type = e.target.value as SignalType;
                        // Store the clock settings that the canvas draws, so saved files are explicit.
                        updateSignal(sig.id, type === "clock" ? { type, clockConfig: sig.clockConfig ?? { ...DEFAULT_CLOCK } } : { type });
                      }}
                      className={`rounded-lg border text-xs px-2.5 py-1 font-medium cursor-pointer transition-all ${
                        isDark
                          ? "border-slate-700 bg-slate-800 text-slate-200 focus:border-blue-500"
                          : "border-slate-200 bg-slate-100 text-slate-800 focus:border-blue-500"
                      } focus:outline-none`}
                    >
                      <option value="binary">Binary (1/0)</option>
                      <option value="clock">Clock Source</option>
                      <option value="bus">Parallel Bus (=)</option>
                      <option value="hiz">High-Z (Z)</option>
                      <option value="undefined">Undefined (X)</option>
                    </select>

                    <button
                      onClick={() => setActiveSignalSettings(isSettingsOpen ? null : sig.id)}
                      className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                        isSettingsOpen
                          ? isDark ? "bg-blue-600 text-white" : "bg-blue-600 text-white"
                          : isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                      title="Toggle Configuration Panel"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => deleteSignal(sig.id)}
                      className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                        isDark ? "text-rose-400 hover:bg-rose-950/40 hover:text-rose-300" : "text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                      }`}
                      title="Delete Track"
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Settings panel dropdown */}
                {isSettingsOpen && (
                  <div className={`mt-3 border-t pt-3 space-y-3 text-xs ${
                    isDark ? "border-slate-750 text-slate-300" : "border-slate-200 text-slate-600"
                  }`}>
                    {/* 1. Track Colors and Styling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2.5">
                      <div>
                        <span className={`block font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                          Track Color
                        </span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {PRESET_COLORS.map((col) => (
                            <button
                              key={col}
                              onClick={() => updateSignal(sig.id, { color: col })}
                              className={`h-5 w-5 rounded-full border border-black/10 hover:scale-110 shadow-xs cursor-pointer transition-all ${
                                sig.color === col ? "ring-2 ring-blue-500 ring-offset-1 scale-110" : ""
                              }`}
                              style={{ backgroundColor: col }}
                            />
                          ))}
                          <input
                            type="color"
                            value={sig.color}
                            onChange={(e) => updateSignal(sig.id, { color: e.target.value })}
                            className="h-6 w-6 rounded border-none outline-none cursor-pointer bg-transparent"
                          />
                        </div>
                      </div>

                      <div>
                        <span className={`block font-semibold mb-1.5 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                          Stroke Width: {sig.strokeWidth}px
                        </span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          step="0.5"
                          value={sig.strokeWidth}
                          onChange={(e) => updateSignal(sig.id, { strokeWidth: parseFloat(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* 2. Shorthand Notation Help Overlay */}
                    {sig.type !== "clock" && (
                      <div className={`p-2.5 rounded-lg text-[11px] font-mono leading-relaxed border ${
                        isDark ? "bg-slate-950/60 border-slate-800 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}>
                        <span className={`font-bold flex items-center gap-1 mb-1 ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                          <HelpCircle className="h-3 w-3 text-blue-500" /> Shorthand Notation:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          <span><strong>1</strong>: High</span>
                          <span><strong>0</strong>: Low</span>
                          <span><strong>z</strong>: Hi-Z</span>
                          <span><strong>x</strong>: Undefined</span>
                          <span><strong>=</strong>: Bus Node</span>
                        </div>
                        <div className={`mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                          <strong>.</strong> or <strong>-</strong> keeps previous state.
                        </div>
                      </div>
                    )}

                    {/* 3. Clock Parameter Configuration Box */}
                    {sig.type === "clock" && (
                      <div className={`p-3 rounded-xl border space-y-2.5 ${
                        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <span className="font-bold text-blue-500 font-mono text-[11px] block">
                          CLOCK CONFIGURATION
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div>
                            <span className={`block mb-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              Period (Cycles)
                            </span>
                            <NumberField
                              min={0.5}
                              max={20}
                              step="0.5"
                              value={sig.clockConfig?.period || 2}
                              onCommit={(v) => updateClockConfig(sig.id, { period: v })}
                              className={`w-full rounded-lg border text-xs px-2 py-1 font-mono focus:outline-none focus:border-blue-500 ${
                                isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-800"
                              }`}
                            />
                          </div>

                          <div>
                            <span className={`block mb-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              Duty Cycle (%)
                            </span>
                            <NumberField
                              integer
                              min={10}
                              max={90}
                              step="5"
                              value={sig.clockConfig?.dutyCycle || 50}
                              onCommit={(v) => updateClockConfig(sig.id, { dutyCycle: v })}
                              className={`w-full rounded-lg border text-xs px-2 py-1 font-mono focus:outline-none focus:border-blue-500 ${
                                isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-800"
                              }`}
                            />
                          </div>

                          <div>
                            <span className={`block mb-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              Phase (0-1)
                            </span>
                            <NumberField
                              min={0}
                              max={1}
                              step="0.125"
                              value={sig.clockConfig?.phase || 0}
                              onCommit={(v) => updateClockConfig(sig.id, { phase: v })}
                              className={`w-full rounded-lg border text-xs px-2 py-1 font-mono focus:outline-none focus:border-blue-500 ${
                                isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-800"
                              }`}
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              id={`inverted-${sig.id}`}
                              checked={sig.clockConfig?.inverted || false}
                              onChange={(e) => updateClockConfig(sig.id, { inverted: e.target.checked })}
                              className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor={`inverted-${sig.id}`} className={`font-medium cursor-pointer ${
                              isDark ? "text-slate-300" : "text-slate-700"
                            }`}>
                              Invert Phase
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bus configuration settings */}
                    {sig.type === "bus" && (
                      <div className={`grid grid-cols-2 gap-3 p-3 border rounded-xl ${
                        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div>
                          <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                            Bus Format
                          </label>
                          <select
                            value={sig.busFormat || "hex"}
                            onChange={(e) => updateSignal(sig.id, { busFormat: e.target.value as any })}
                            className={`w-full rounded-lg border px-2.5 py-1 text-xs focus:outline-none focus:border-blue-500 ${
                              isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-800"
                            }`}
                          >
                            <option value="hex">16進数 (Hexadecimal)</option>
                            <option value="dec">10進数 (Decimal)</option>
                            <option value="bin">2進数 (Binary)</option>
                            <option value="string">文字列 (String)</option>
                          </select>
                        </div>
                        {sig.busFormat !== "string" && <div>
                          <label className={`block mb-1 font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                            Bit Width
                          </label>
                          <NumberField
                            integer
                            min={1}
                            max={32}
                            value={sig.busWidth || 8}
                            onCommit={(v) => updateSignal(sig.id, { busWidth: v })}
                            className={`w-full rounded-lg border px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-500 ${
                              isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-800"
                            }`}
                          />
                        </div>}
                        {busHasBits(sig) && <div className="col-span-2 flex items-center justify-between pt-1">
                          <span className={`font-medium ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                            Bit Expansion View:
                          </span>
                          <button
                            type="button"
                            onClick={() => updateSignal(sig.id, { isExpanded: !sig.isExpanded })}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                              sig.isExpanded
                                ? isDark ? "bg-amber-500/20 border border-amber-500/50 text-amber-300" : "bg-amber-100 border border-amber-300 text-amber-800"
                                : isDark ? "bg-slate-800 border border-slate-700 text-slate-300" : "bg-slate-200 border border-slate-300 text-slate-700"
                            }`}
                          >
                            {sig.isExpanded ? "Collapse Bits" : "Expand Bits"}
                          </button>
                        </div>}
                      </div>
                    )}

                    {/* 4. Edit bus values list */}
                    {sig.type === "bus" && busIndices.length > 0 && (
                      <div className={`p-3 border rounded-xl space-y-2.5 ${
                        isDark ? "bg-slate-950/70 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <span className="font-bold text-amber-500 font-mono text-[11px] block">
                          BUS SEGMENT LABELS
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {busIndices.map((cycleIdx) => (
                            <div key={`bus-val-edit-${sig.id}-${cycleIdx}`} className="flex items-center gap-1.5">
                              <span className={`font-mono text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                                #{cycleIdx}:
                              </span>
                              <input
                                type="text"
                                value={sig.busValues[cycleIdx] || ""}
                                placeholder="Value"
                                onChange={(e) => {
                                  const updatedBuses = { ...sig.busValues };
                                  updatedBuses[cycleIdx] = e.target.value;
                                  updateSignal(sig.id, { busValues: updatedBuses });
                                }}
                                className={`w-full rounded-lg border px-2 py-0.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${
                                  isDark ? "border-slate-700 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-800"
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

