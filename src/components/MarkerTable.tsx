import React, { useState } from "react";
import { Marker, DiagramConfig } from "../types";
import { Plus, Trash, EyeOff, Tag } from "lucide-react";

interface MarkerTableProps {
  markers: Marker[];
  config: DiagramConfig;
  theme?: "dark" | "light";
  onUpdateMarkers: (newMarkers: Marker[]) => void;
}

export const MarkerTable: React.FC<MarkerTableProps> = ({
  markers,
  config,
  theme = "dark",
  onUpdateMarkers,
}) => {
  const isDark = theme === "dark";
  const [newLabel, setNewLabel] = useState("");
  const [newTime, setNewTime] = useState(2.0);
  const [newColor, setNewColor] = useState("#ef4444");

  const addMarker = () => {
    const boundedTime = Math.max(0, Math.min(config.numCycles, newTime));

    const item: Marker = {
      id: `m_${Date.now()}`,
      time: boundedTime,
      label: newLabel.trim() || `Marker ${markers.length + 1}`,
      color: newColor,
      showLine: true,
    };

    onUpdateMarkers([...markers, item]);
    setNewLabel("");
  };

  const deleteMarker = (id: string) => {
    onUpdateMarkers(markers.filter((m) => m.id !== id));
  };

  const toggleLineVisibility = (id: string) => {
    const updated = markers.map((m) => (m.id === id ? { ...m, showLine: !m.showLine } : m));
    onUpdateMarkers(updated);
  };

  return (
    <div className="w-full space-y-3.5">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-blue-500" />
        <h3 className={`text-sm font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          Timeline Markers ({markers.length})
        </h3>
      </div>

      {/* Quick Marker Add Form */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border text-xs ${
        isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      }`}>
        <div>
          <label className={`block text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            Label
          </label>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g. Setup start"
            className={`w-full rounded-lg border p-1.5 text-xs focus:outline-none focus:border-blue-500 ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
          />
        </div>

        <div>
          <label className={`block text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            Time Position ({config.timeUnitLabel})
          </label>
          <input
            type="number"
            min="0"
            max={config.numCycles}
            step="0.5"
            value={newTime}
            onChange={(e) => setNewTime(parseFloat(e.target.value))}
            className={`w-full rounded-lg border p-1.5 text-xs font-mono focus:outline-none focus:border-blue-500 ${
              isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
            }`}
          />
        </div>

        <div>
          <label className={`block text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
            Marker Color
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-7 w-9 rounded-md border-none outline-none cursor-pointer bg-transparent"
            />
            <span className={`font-mono text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{newColor}</span>
          </div>
        </div>

        <div className="flex items-end">
          <button
            onClick={addMarker}
            className="w-full flex justify-center items-center gap-1.5 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 cursor-pointer h-[34px] transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Add Marker
          </button>
        </div>
      </div>

      {/* List of markers */}
      {markers.length === 0 ? (
        <p className={`text-center text-xs py-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          Double-click the timeline ruler or use the form above to add vertical time markers.
        </p>
      ) : (
        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
          {markers.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition-all ${
                isDark
                  ? "border-slate-800 bg-slate-900/60 text-slate-200"
                  : "border-slate-200 bg-white text-slate-800 shadow-xs"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full shadow-xs" style={{ backgroundColor: m.color }} />
                <span className="font-semibold">{m.label}</span>
                <span className={`font-mono text-[11px] px-2 py-0.5 rounded-md ${
                  isDark ? "bg-slate-800 text-slate-300 border border-slate-700" : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  {m.time} {config.timeUnitLabel} ({Math.round(m.time * config.timeScale)}s)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleLineVisibility(m.id)}
                  className={`rounded-lg p-1.5 cursor-pointer transition-all ${
                    !m.showLine
                      ? "text-amber-500"
                      : isDark ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  }`}
                  title={m.showLine ? "Hide vertical line" : "Show vertical line"}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteMarker(m.id)}
                  className={`rounded-lg p-1.5 cursor-pointer transition-all ${
                    isDark ? "text-rose-400 hover:bg-rose-950/40" : "text-rose-500 hover:bg-rose-50"
                  }`}
                  title="Delete Marker"
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

