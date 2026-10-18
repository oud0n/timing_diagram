import React, { useState } from "react";
import { NumberField } from "./NumberField";
import { Constraint, Signal, DiagramConfig } from "../types";
import { Link, Plus, Trash } from "lucide-react";

interface ConstraintTableProps {
  constraints: Constraint[];
  signals: Signal[];
  config: DiagramConfig;
  theme?: "dark" | "light";
  onUpdateConstraints: (newConstraints: Constraint[]) => void;
}

export const ConstraintTable: React.FC<ConstraintTableProps> = ({
  constraints,
  signals,
  config,
  theme = "dark",
  onUpdateConstraints,
}) => {
  const isDark = theme === "dark";
  const [fromSig, setFromSig] = useState("");
  const [fromTimeVal, setFromTimeVal] = useState(2.0);
  const [toSig, setToSig] = useState("");
  const [toTimeVal, setToTimeVal] = useState(3.0);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#475569");
  const [arrowType, setArrowType] = useState<"both" | "to" | "none">("both");
  const [style, setStyle] = useState<"dashed" | "solid">("solid");

  const addConstraint = () => {
    const s1 = (signals.some(s => s.id === fromSig) ? fromSig : "") || (signals[0]?.id ?? "");
    const s2 = (signals.some(s => s.id === toSig) ? toSig : "") || (signals[0]?.id ?? "");

    if (!s1 || !s2) return;

    const item: Constraint = {
      id: `c_${Date.now()}`,
      fromSignalId: s1,
      fromTime: Math.max(0, Math.min(config.numCycles, fromTimeVal)),
      toSignalId: s2,
      toTime: Math.max(0, Math.min(config.numCycles, toTimeVal)),
      label: label.trim() || "t_prop",
      color,
      style,
      arrowType,
    };

    onUpdateConstraints([...constraints, item]);
    setLabel("");
  };

  const deleteConstraint = (id: string) => {
    onUpdateConstraints(constraints.filter((c) => c.id !== id));
  };

  const getSignalName = (id: string): string => {
    return signals.find((s) => s.id === id)?.name || "Unknown Trace";
  };

  return (
    <div className="w-full space-y-3.5">
      <div className="flex items-center gap-2">
        <Link className="h-4 w-4 text-blue-500" />
        <h3 className={`text-sm font-bold tracking-tight ${isDark ? "text-slate-100" : "text-slate-800"}`}>
          Timing Relationships / Constraints ({constraints.length})
        </h3>
      </div>

      {signals.length < 1 ? (
        <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Add signals first to define propagation delays and setup constraints.
        </p>
      ) : (
        <>
          {/* Quick Add Constraints Frame */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border text-xs ${
            isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
          }`}>
            {/* Source Origin */}
            <div className="space-y-1">
              <span className={`block text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                From (Origin)
              </span>
              <div className="flex gap-2">
                <select
                  value={fromSig || (signals[0]?.id ?? "")}
                  onChange={(e) => setFromSig(e.target.value)}
                  className={`w-1/2 rounded-lg border p-1.5 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  {signals.map((s) => (
                    <option key={`from-opt-${s.id}`} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <NumberField
                  step="0.5"
                  min={0}
                  max={config.numCycles}
                  value={fromTimeVal}
                  onCommit={(v) => setFromTimeVal(v)}
                  className={`w-1/2 rounded-lg border p-1.5 text-xs text-center font-mono focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                  placeholder="Cycle"
                />
              </div>
            </div>

            {/* Target Destination */}
            <div className="space-y-1">
              <span className={`block text-[11px] font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                To (Target)
              </span>
              <div className="flex gap-2">
                <select
                  value={toSig || (signals[0]?.id ?? "")}
                  onChange={(e) => setToSig(e.target.value)}
                  className={`w-1/2 rounded-lg border p-1.5 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  {signals.map((s) => (
                    <option key={`to-opt-${s.id}`} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <NumberField
                  step="0.5"
                  min={0}
                  max={config.numCycles}
                  value={toTimeVal}
                  onCommit={(v) => setToTimeVal(v)}
                  className={`w-1/2 rounded-lg border p-1.5 text-xs text-center font-mono focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                  placeholder="Cycle"
                />
              </div>
            </div>

            {/* Label parameters */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={`block text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Label
                </span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. t_setup"
                  className={`w-full rounded-lg border p-1.5 text-xs focus:outline-none focus:border-blue-500 ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                />
              </div>

              <div>
                <span className={`block text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Arrow Style
                </span>
                <select
                  value={arrowType}
                  onChange={(e) => setArrowType(e.target.value as any)}
                  className={`w-full rounded-lg border p-1.5 text-xs focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  <option value="both">Both Ends</option>
                  <option value="to">Single End</option>
                  <option value="none">No Arrow</option>
                </select>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <span className={`block text-[11px] font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Line Style
                </span>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as any)}
                  className={`w-full rounded-lg border p-1.5 text-xs focus:outline-none ${
                    isDark ? "border-slate-700 bg-slate-950 text-slate-100" : "border-slate-200 bg-slate-50 text-slate-900"
                  }`}
                >
                  <option value="solid">Solid Line</option>
                  <option value="dashed">Dashed Line</option>
                </select>
              </div>

              <button
                onClick={addConstraint}
                className="flex items-center justify-center gap-1.5 rounded-full bg-blue-600 hover:bg-blue-500 font-semibold text-white px-4 py-1.5 shadow-sm text-xs cursor-pointer h-[34px] transition-all"
              >
                <Plus className="h-3.5 w-3.5" /> Link
              </button>
            </div>
          </div>

          {/* List constraints */}
          {constraints.length === 0 ? (
            <p className={`text-center text-xs py-3 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              No timing annotations linked yet. Connect trigger points with timing guidelines above.
            </p>
          ) : (
            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {constraints.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center justify-between rounded-xl border p-2.5 text-xs transition-all ${
                    isDark
                      ? "border-slate-800 bg-slate-900/60 text-slate-200"
                      : "border-slate-200 bg-white text-slate-800 shadow-xs"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-bold font-mono px-2 py-0.5 rounded-md ${
                      isDark ? "bg-blue-950/80 text-blue-300 border border-blue-800/40" : "bg-blue-100 text-blue-700"
                    }`}>
                      {c.label}
                    </span>
                    <span className={isDark ? "text-slate-500" : "text-slate-400"}>linking</span>
                    <span className="font-semibold text-indigo-500 font-mono">
                      {getSignalName(c.fromSignalId)}@{c.fromTime}
                    </span>
                    <span className={isDark ? "text-slate-500" : "text-slate-400"}>➔</span>
                    <span className="font-semibold text-emerald-500 font-mono">
                      {getSignalName(c.toSignalId)}@{c.toTime}
                    </span>
                    <span className={`text-[11px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                      ({c.style}, {c.arrowType})
                    </span>
                  </div>

                  <button
                    onClick={() => deleteConstraint(c.id)}
                    className={`rounded-lg p-1.5 transition-all cursor-pointer ${
                      isDark ? "text-rose-400 hover:bg-rose-950/40" : "text-rose-500 hover:bg-rose-50"
                    }`}
                    title="Delete annotation link"
                  >
                    <Trash className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

