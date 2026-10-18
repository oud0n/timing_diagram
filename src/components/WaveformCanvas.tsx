import React, { useRef, useState, useMemo, useEffect } from "react";
import { Signal, Marker, Constraint, DiagramConfig, RepeatRange, TimeFold } from "../types";
import { parseWaveform, createTimelineCoordinateMapper, FOLD_BREAK_WIDTH } from "../utils";

import { nextWaveState, visiblePaintRange, WaveState } from "../waveformEditing";

interface WaveformCanvasProps {
  config: DiagramConfig;
  timelineEndRequest?: number;
  signals: Signal[];
  markers: Marker[];
  constraints: Constraint[];
  repeatRanges?: RepeatRange[];
  folds?: TimeFold[];
  theme?: "dark" | "light";
  activeCell?: { signalId: string; cycleIndex: number } | null;
  onPaintCells?: (signalId: string, cycles: number[], state: WaveState) => void;
  onPaintStart?: () => void;
  onPaintEnd?: () => void;
  onBusLabelEdit?: (signalId: string, cycleIndex: number) => void;
  onCanvasClick?: (signalId: string, cycleIndex: number, clientX: number, clientY: number) => void;
  onTimelineDoubleClick?: (time: number) => void;
  onMarkerMove?: (markerId: string, newTime: number) => void;
  onUpdateSignals?: (newSignals: Signal[]) => void;
  onRemoveFold?: (foldId: string) => void;
  onRemoveRepeatRange?: (repeatId: string) => void;
}

interface RenderRow {
  type: "signal" | "bit";
  signal: Signal;
  bitIndex?: number;
  isLastBit?: boolean;
}

const parseBusValueToNumber = (val: string, format: 'hex' | 'dec' | 'bin' | 'string'): number | null => {
  const clean = val.trim();
  if (!clean) return 0;
  
  try {
    if (format === 'hex') {
      const hexPart = clean.replace(/^(0x|0X|h|H|#)/, '');
      const num = parseInt(hexPart, 16);
      return isNaN(num) ? null : num;
    }
    if (format === 'dec') {
      const num = parseInt(clean, 10);
      return isNaN(num) ? null : num;
    }
    if (format === 'bin') {
      const binPart = clean.replace(/^(0b|0B)/, '');
      const num = parseInt(binPart, 2);
      return isNaN(num) ? null : num;
    }
    if (format === 'string') {
      if (/^\d/.test(clean)) {
        const num = parseInt(clean);
        if (!isNaN(num)) return num;
      }
      let code = 0;
      for (let i = 0; i < clean.length; i++) {
        code = (code << 8) + clean.charCodeAt(i);
        if (code > 0xffffffff) break;
      }
      return code;
    }
  } catch (e) {
    return null;
  }
  return null;
};

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  config,
  timelineEndRequest = 0,
  signals,
  markers,
  constraints,
  repeatRanges = [],
  folds = [],
  theme = "dark",
  onCanvasClick, activeCell, onPaintCells, onPaintStart, onPaintEnd, onBusLabelEdit,
  onTimelineDoubleClick,
  onMarkerMove,
  onUpdateSignals,
  onRemoveFold,
  onRemoveRepeatRange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCycle, setHoveredCycle] = useState<{ signalId: string; cycle: number } | null>(null);
  const [hoveredTimeline, setHoveredTimeline] = useState<number | null>(null);
  const drag = useRef<{ pointer: number; signalId: string; first: number; last: number; state: WaveState; moved: boolean; deferred: boolean; visited: Set<number> } | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const finish = () => { if (drag.current) { drag.current = null; onPaintEnd?.(); } };
    window.addEventListener('blur', finish);
    return () => { window.removeEventListener('blur', finish); if (clickTimer.current) clearTimeout(clickTimer.current); finish(); };
  }, [onPaintEnd]);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Layout geometry constants
  const labelWidth = 145; // width of label sidebar inside SVG
  const hasRepeats = repeatRanges && repeatRanges.length > 0;
  const repeatDeckHeight = hasRepeats ? 30 : 0;
  const topMargin = 45 + repeatDeckHeight; // space for repeat deck + timeline ruler
  const rowHeight = 65;   // vertical height of each signal track
  const bottomMargin = 30; // buffer area at the bottom

  // Coordinate Mapper for non-linear horizontal folds & repeat omissions
  const { timeToX, xToTime, sanitizedFolds, totalCalculatedWidth } = useMemo(() => {
    return createTimelineCoordinateMapper(config, folds, repeatRanges, labelWidth);
  }, [config, folds, repeatRanges, labelWidth]);

  // Construct renderRows dynamically based on bus signal isExpanded state
  const renderRows: RenderRow[] = [];
  signals.forEach((sig) => {
    renderRows.push({ type: "signal", signal: sig });
    if (sig.type === "bus" && sig.isExpanded) {
      const width = sig.busWidth || 8;
      for (let b = width - 1; b >= 0; b--) {
        renderRows.push({ type: "bit", signal: sig, bitIndex: b, isLastBit: b === 0 });
      }
    }
  });

  // Resolve each parent once, rather than reparsing it for every bit/cycle.
  const parsedSignals = useMemo(() => new Map(signals.map(sig => [sig.id, parseWaveform(sig.waveStr, config.numCycles)])), [signals, config.numCycles]);
  const getBitState = (sig: Signal, cycleI: number, bitIndex: number): '0' | '1' | 'z' | 'x' => {
    const waveStates = parsedSignals.get(sig.id)!;
    const cycleState = waveStates[cycleI] || "0";
    if (cycleState === "1") return "1";
    if (cycleState === "0") return "0";
    if (cycleState === "z") return "z";
    if (cycleState === "x") return "x";
    if (cycleState === "=") {
      const rawValue = sig.busValues[cycleI] || "0";
      const num = parseBusValueToNumber(rawValue, sig.busFormat || "hex");
      if (num === null) return "x";
      return ((num >> bitIndex) & 1) === 1 ? "1" : "0";
    }
    return "0";
  };

  const totalWidth = Math.max(800, totalCalculatedWidth);
  const totalHeight = topMargin + renderRows.length * rowHeight + bottomMargin;
  useEffect(() => {
    if (timelineEndRequest && containerRef.current) containerRef.current.scrollLeft = totalWidth;
  }, [timelineEndRequest]);

  const getXForTime = (time: number): number => {
    return timeToX(time);
  };

  const getYForSignalIndex = (rowIdx: number): number => {
    return topMargin + rowIdx * rowHeight;
  };

  const getSignalIndexById = (id: string): number => {
    return signals.findIndex((s) => s.id === id);
  };

  // Convert client cursor coordinate to time cycle units using non-linear inverse mapper
  const handleTimelineInteraction = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = (e.clientX - rect.left) * totalWidth / rect.width;
    if (clientX >= labelWidth) {
      const rawTime = xToTime(clientX);
      const snapped = Math.round(rawTime * 4) / 4;
      const boundedTime = Math.max(0, Math.min(config.numCycles, snapped));
      setHoveredTimeline(boundedTime);
    } else {
      setHoveredTimeline(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onTimelineDoubleClick) return;
    if ((e.clientY - e.currentTarget.getBoundingClientRect().top) * totalHeight / e.currentTarget.getBoundingClientRect().height >= topMargin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = (e.clientX - rect.left) * totalWidth / rect.width;
    if (clientX >= labelWidth) {
      const rawTime = xToTime(clientX);
      const snapped = Math.round(rawTime * 2) / 2;
      const boundedTime = Math.max(0, Math.min(config.numCycles, snapped));
      onTimelineDoubleClick(boundedTime);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  // Adaptive stepping calculation for large cycle counts (e.g. 100~1000+ cycles)
  const minTickPixelSpacing = 50;
  const rawCyclesPerTick = Math.max(1, Math.ceil(Math.max(minTickPixelSpacing / config.cycleWidth, config.numCycles / 2000)));
  const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const tickStep = niceSteps.find((s) => s >= rawCyclesPerTick) || Math.pow(10, Math.ceil(Math.log10(rawCyclesPerTick)));

  // Determine which cycles get major ticks / numbers (filter out cycles covered inside folds)
  const isInsideFold = (cycle: number) => {
    return sanitizedFolds.some((f) => cycle > f.start && cycle < f.end);
  };

  const tickIndices: number[] = [];
  for (let c = 0; c <= config.numCycles; c += tickStep) {
    if (!isInsideFold(c)) {
      tickIndices.push(c);
    }
  }
  // Ensure boundary ticks are present
  for (const fold of sanitizedFolds) {
    if (!tickIndices.includes(fold.start)) tickIndices.push(fold.start);
    if (!tickIndices.includes(fold.end)) tickIndices.push(fold.end);
  }
  if (!tickIndices.includes(config.numCycles) && !isInsideFold(config.numCycles)) {
    tickIndices.push(config.numCycles);
  }
  tickIndices.sort((a, b) => a - b);

  // Determine grid line intervals
  const gridStep = tickStep;
  const canDrawSubdivisions = config.numCycles <= 2000 && config.gridVisible && config.gridSubdivisions > 1 && (config.cycleWidth / config.gridSubdivisions) >= 12;

  const isDark = theme === "dark";
  const dynamicBgColor = isDark ? "#0F172A" : "#FFFFFF";
  const dynamicGridColor = isDark ? "#1E293B" : "#E2E8F0";

  // Render SVG pattern defs
  const renderDefs = () => (
    <defs>
      <pattern
        id="hatch-gray"
        width="8"
        height="8"
        patternTransform="rotate(45 0 0)"
        patternUnits="userSpaceOnUse"
      >
        <line x1="0" y1="0" x2="0" y2="8" stroke={isDark ? "#334155" : "#cbd5e1"} strokeWidth="2" />
      </pattern>
      <pattern
        id="hatch-fold"
        width="10"
        height="10"
        patternTransform="rotate(45 0 0)"
        patternUnits="userSpaceOnUse"
      >
        <line x1="0" y1="0" x2="0" y2="10" stroke={isDark ? "#334155" : "#e2e8f0"} strokeWidth="1.5" />
      </pattern>

      <marker
        id="arrow-to"
        viewBox="0 0 10 10"
        refX="6"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="currentColor" />
      </marker>
      
      <marker
        id="arrow-both"
        viewBox="0 0 10 10"
        refX="5"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="currentColor" />
      </marker>
    </defs>
  );

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`w-full overflow-x-auto rounded-2xl border transition-colors shadow-sm ${
        isDark
          ? "border-slate-800 bg-[#0F172A] text-slate-300"
          : "border-slate-200 bg-white text-slate-700"
      } p-4`}
    >
      <div className="min-w-max">
        {/* Help Tip */}
        <div className="mb-2 flex items-center justify-between px-2 text-xs font-mono">
          <span className={`flex items-center gap-1.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Double-click ruler to place marker. Click waveform to edit state. Total: {config.numCycles} cycles
            {sanitizedFolds.length > 0 && ` (${sanitizedFolds.length} folded regions)`}.
          </span>
          {hoveredTimeline !== null && (
            <span className={`px-2 py-0.5 rounded-md font-medium border ${
              isDark
                ? "text-blue-400 bg-blue-950/60 border-blue-900/40"
                : "text-blue-600 bg-blue-50 border-blue-200"
            }`}>
              Offset: {hoveredTimeline} {config.timeUnitLabel} ({Math.round(hoveredTimeline * config.timeScale)} ns)
            </span>
          )}
        </div>

        <svg
          data-waveform="true"
          tabIndex={0}
          aria-label="Timing waveform"
          width={totalWidth}
          height={totalHeight}
          className="select-none font-sans"
          onMouseMove={handleTimelineInteraction}
          onMouseLeave={() => {
            setHoveredTimeline(null);
            setHoveredCycle(null);
          }}
          onDoubleClick={handleDoubleClick}
        >
          {renderDefs()}

          {/* Outer Border Background */}
          <rect
            width={totalWidth}
            height={totalHeight}
            fill={dynamicBgColor}
            rx={8}
          />

          {/* 1. DRAW TIMELINE RULER & GRID LINES */}
          {/* Major Grid Lines */}
          {config.gridVisible &&
            Array.from({ length: Math.floor(config.numCycles / gridStep) + 1 }).map((_, idx) => {
              const i = idx * gridStep;
              if (i === 0 || i >= config.numCycles || isInsideFold(i)) return null;
              const x = getXForTime(i);
              return (
                <line
                  key={`grid-line-${i}`}
                  x1={x}
                  y1={topMargin - 15}
                  x2={x}
                  y2={totalHeight - bottomMargin}
                  stroke={dynamicGridColor}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              );
            })}

          {/* Subdivisions */}
          {canDrawSubdivisions &&
            Array.from({ length: config.numCycles }).map((_, i) => {
              if (isInsideFold(i)) return null;
              const x = getXForTime(i);
              return (
                <g key={`grid-subs-${i}`}>
                  {Array.from({ length: config.gridSubdivisions - 1 }).map((_, subI) => {
                    const subX = x + ((subI + 1) * config.cycleWidth) / config.gridSubdivisions;
                    return (
                      <line
                        key={`grid-sub-${i}-${subI}`}
                        x1={subX}
                        y1={topMargin}
                        x2={subX}
                        y2={totalHeight - bottomMargin}
                        stroke={isDark ? "#121b2c" : "#f1f5f9"}
                        strokeWidth={0.8}
                        strokeDasharray="2 3"
                      />
                    );
                  })}
                </g>
              );
            })}

          {/* Vertical tick markers at the timeline ruler */}
          {config.timelineVisible &&
            tickIndices.map((i) => {
              const x = getXForTime(i);
              return (
                <g key={`timeline-tick-${i}`}>
                  <line
                    x1={x}
                    y1={topMargin - 8}
                    x2={x}
                    y2={topMargin}
                    stroke={isDark ? "#475569" : "#94a3b8"}
                    strokeWidth={1.5}
                  />
                  <text
                    x={x}
                    y={topMargin - 12}
                    textAnchor="middle"
                    className={`${isDark ? "fill-white font-semibold" : "fill-slate-500"} font-mono text-[11px] font-medium`}
                  >
                    {Math.round(i * config.timeScale)}
                  </text>
                </g>
              );
            })}

          {/* Basic axis line */}
          <line
            x1={labelWidth}
            y1={topMargin}
            x2={getXForTime(config.numCycles)}
            y2={topMargin}
            stroke={isDark ? "#334155" : "#cbd5e1"}
            strokeWidth={1.5}
          />

          {/* 2. REPEAT RANGE BANNERS (ABOVE TIME RULER) */}
          {repeatRanges.map((rep) => {
            const countNum = typeof rep.count === "number"
              ? rep.count
              : parseInt(String(rep.count).replace(/\D/g, ""), 10) || 1;
            const period = rep.period || Math.max(1, Math.round((rep.endCycle - rep.startCycle) / countNum));
            const isOmitted = rep.omitRepetitions !== false && countNum > 1;

            // When repetitions are omitted, span directly over the 1 displayed base instance (e.g. "10")
            const displayStart = rep.startCycle;
            const displayEnd = isOmitted ? rep.startCycle + period : rep.endCycle;

            const x1 = getXForTime(displayStart);
            const x2 = getXForTime(displayEnd);
            const repY = 18;
            const repColor = rep.color || "#0284c7";
            const textContent = `repeat ${countNum}${rep.label ? ` • ${rep.label}` : ""}`;

            return (
              <g key={`repeat-${rep.id}`} className="group cursor-pointer">
                {/* Horizontal span bracket line */}
                <line
                  x1={x1}
                  y1={repY}
                  x2={x2}
                  y2={repY}
                  stroke={repColor}
                  strokeWidth={2}
                />
                {/* Left bracket cap */}
                <line
                  x1={x1}
                  y1={repY - 6}
                  x2={x1}
                  y2={repY + 6}
                  stroke={repColor}
                  strokeWidth={2.5}
                />
                {/* Right bracket cap */}
                <line
                  x1={x2}
                  y1={repY - 6}
                  x2={x2}
                  y2={repY + 6}
                  stroke={repColor}
                  strokeWidth={2.5}
                />

                {/* Center Badge */}
                <rect
                  x={(x1 + x2) / 2 - (textContent.length * 3.3 + 14)}
                  y={repY - 11}
                  width={textContent.length * 6.6 + 28}
                  height={22}
                  rx={11}
                  fill={isDark ? "#0f172a" : "#ffffff"}
                  stroke={repColor}
                  strokeWidth={1.5}
                />
                <circle
                  cx={(x1 + x2) / 2 - (textContent.length * 3.3 + 4)}
                  cy={repY}
                  r={4}
                  fill={repColor}
                />
                <text
                  x={(x1 + x2) / 2 + 4}
                  y={repY + 3.5}
                  textAnchor="middle"
                  className={`font-mono text-[11px] font-bold ${isDark ? "fill-white" : "fill-slate-800"}`}
                >
                  {textContent}
                </text>

                {/* Delete button on hover / click */}
                {onRemoveRepeatRange && (
                  <g data-export-exclude="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRepeatRange(rep.id);
                    }}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <circle
                      cx={(x1 + x2) / 2 + (textContent.length * 3.3 + 6)}
                      cy={repY}
                      r={7}
                      fill={isDark ? "#334155" : "#e2e8f0"}
                    />
                    <text
                      x={(x1 + x2) / 2 + (textContent.length * 3.3 + 6)}
                      y={repY + 3}
                      textAnchor="middle"
                      className="fill-rose-500 font-bold text-[9px] cursor-pointer"
                    >
                      ✕
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 3. RENDERING WAVEFORMS ROW BY ROW */}
          {renderRows.map((row, rIdx) => {
            const rowY = getYForSignalIndex(rIdx);
            const sig = row.signal;
            const highY = rowY + 12;
            const lowY = rowY + sig.height - 4;
            const midY = (highY + lowY) / 2;

            let waveStates: string[];
            if (row.type === "bit") {
              const bitIndex = row.bitIndex ?? 0;
              waveStates = [];
              for (let c = 0; c < config.numCycles; c++) {
                waveStates.push(getBitState(sig, c, bitIndex));
              }
            } else {
              waveStates = parsedSignals.get(sig.id)!;
            }

            interface WaveSegment {
              state: string;
              startCycle: number;
              endCycle: number;
            }
            const segments: WaveSegment[] = [];
            let currentSeg: WaveSegment | null = null;
            for (let c = 0; c < config.numCycles; c++) {
              const s = waveStates[c] || "0";
              if (!currentSeg) {
                currentSeg = { state: s, startCycle: c, endCycle: c + 1 };
              } else if (currentSeg.state === s) {
                currentSeg.endCycle = c + 1;
              } else {
                segments.push(currentSeg);
                currentSeg = { state: s, startCycle: c, endCycle: c + 1 };
              }
            }
            if (currentSeg) segments.push(currentSeg);

            const getLevelY = (state: string) => {
              if (state === "1") return highY;
              if (state === "0") return lowY;
              if (state === "z") return midY;
              return midY;
            };

            return (
              <g key={`row-${row.type}-${sig.id}-${row.bitIndex ?? "p"}`}>
                {/* Horizontal divider */}
                <line
                  x1={10}
                  y1={rowY + sig.height + 10}
                  x2={totalWidth - 20}
                  y2={rowY + sig.height + 10}
                  stroke={isDark ? "#1e293b" : "#f1f5f9"}
                  strokeWidth={1}
                />

                {/* Row Hover Background */}
                <rect data-export-exclude="true"
                  x={labelWidth}
                  y={rowY}
                  width={totalWidth - labelWidth}
                  height={sig.height}
                  fill={
                    hoveredCycle?.signalId === sig.id
                      ? isDark
                        ? "rgba(255, 255, 255, 0.03)"
                        : "rgba(241, 245, 249, 0.4)"
                      : "transparent"
                  }
                  className="transition-colors duration-150"
                />

                {/* Right Side: RENDER THE WAVEFORM DATA */}
                {row.type === "signal" && sig.type === "clock" ? (
                  // Clock rendering with coordinate mapping
                  (() => {
                    const clkConfig = sig.clockConfig || {
                      period: 2,
                      dutyCycle: 50,
                      phase: 0,
                      inverted: false,
                    };
                    const period = Math.max(0.1, clkConfig.period || 2);
                    const dutyFraction = Math.max(0.01, Math.min(0.99, (clkConfig.dutyCycle ?? 50) / 100));
                    const highDuration = period * dutyFraction;
                    const phaseOffset = ((clkConfig.phase || 0) % period + period) % period;

                    const pathPts: string[] = [];
                    const duration = config.numCycles;

                    const isHighAt = (time: number) => {
                      let adjT = time - phaseOffset;
                      if (adjT < 0) adjT = (adjT % period) + period;
                      const prog = adjT % period;
                      const rawHigh = prog < highDuration;
                      return clkConfig.inverted ? !rawHigh : rawHigh;
                    };

                    let currentIsHigh = isHighAt(0);
                    let currentY = currentIsHigh ? highY : lowY;
                    pathPts.push(`M ${getXForTime(0)} ${currentY}`);

                    const transitions: number[] = [];
                    const startK = Math.floor(-phaseOffset / period) - 1;
                    const endK = Math.ceil((duration + period) / period) + 1;
                    for (let k = startK; k <= endK; k++) {
                      const tRise = k * period + phaseOffset;
                      const tFall = tRise + highDuration;
                      if (tRise > 0.0001 && tRise < duration) transitions.push(tRise);
                      if (tFall > 0.0001 && tFall < duration) transitions.push(tFall);
                    }
                    transitions.sort((a, b) => a - b);

                    for (const transT of transitions) {
                      const transX = getXForTime(transT);
                      pathPts.push(`L ${transX} ${currentY}`);
                      currentIsHigh = !currentIsHigh;
                      currentY = currentIsHigh ? highY : lowY;
                      pathPts.push(`L ${transX} ${currentY}`);
                    }
                    pathPts.push(`L ${getXForTime(duration)} ${currentY}`);

                    return (
                      <path
                        d={pathPts.join(" ")}
                        fill="none"
                        stroke={sig.color}
                        strokeWidth={sig.strokeWidth}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    );
                  })()
                ) : (
                  // Discrete states: '0', '1', 'z', 'x', '='
                  <g>
                    {/* Undefined (X) runs */}
                    <path fill="url(#hatch-gray)" d={segments.filter(seg => seg.state === 'x').map(seg => {
                      const x = getXForTime(seg.startCycle) + 1.5;
                      const width = Math.max(0, getXForTime(seg.endCycle) - x - 1.5);
                      return `M ${x} ${highY} h ${width} v ${lowY - highY} h ${-width} Z`;
                    }).join(' ')} />

                    {/* Horizontal lines */}
                    {(() => {
                      const solid: string[] = [], dashed: string[] = [];
                      const line = (out: string[], x1: number, y1: number, x2: number, y2: number) => out.push(`M ${x1} ${y1} L ${x2} ${y2}`);
                      segments.forEach((seg, i) => {
                        const startX = getXForTime(seg.startCycle), endX = getXForTime(seg.endCycle);
                        if (seg.state === '0' || seg.state === '1') line(solid, startX, getLevelY(seg.state), endX, getLevelY(seg.state));
                        else if (seg.state === 'z') line(dashed, startX, midY, endX, midY);
                        else { line(solid, startX, highY, endX, highY); line(solid, startX, lowY, endX, lowY); }
                        const next = segments[i + 1];
                        if (next) {
                          const single = ['0','1','z'].includes(seg.state) && ['0','1','z'].includes(next.state);
                          line(solid, endX, single ? getLevelY(seg.state) : highY, endX, single ? getLevelY(next.state) : lowY);
                        }
                      });
                      return <>
                        <path d={solid.join(' ')} fill="none" stroke={sig.color} strokeWidth={sig.strokeWidth} strokeLinecap="round" />
                        <path d={dashed.join(' ')} fill="none" stroke={sig.color} strokeWidth={sig.strokeWidth} strokeLinecap="round" strokeDasharray="4 4" />
                      </>;
                    })()}

                    {/* Bus value text labels */}
                    {row.type === "signal" &&
                      Object.keys(sig.busValues).map((key) => {
                        const cycleI = parseInt(key, 10);
                        if (cycleI < 0 || cycleI >= config.numCycles) return null;
                        if (waveStates[cycleI] !== "=") return null;
                        if (isInsideFold(cycleI)) return null;

                        const startX = getXForTime(cycleI);
                        const endX = getXForTime(cycleI + 1);
                        const label = sig.busValues[cycleI] || "";
                        const maxChars = Math.max(2, Math.floor((endX - startX) / 8));
                        const displayLabel = label.length > maxChars ? `${label.substring(0, maxChars - 1)}…` : label;

                        return (
                          <g key={`bus-lbl-${sig.id}-${cycleI}`}>
                            <rect
                              x={startX + 2}
                              y={highY + 1}
                              width={Math.max(0, endX - startX - 4)}
                              height={lowY - highY - 2}
                              fill={dynamicBgColor}
                            />
                            {endX - startX >= 24 && (
                              <text
                                x={(startX + endX) / 2}
                                y={midY + 4}
                                textAnchor="middle"
                                className={`${isDark ? "fill-white" : "fill-slate-700"} font-mono text-[10.5px] font-semibold select-all`}
                              >
                                {displayLabel || "DATA"}
                              </text>
                            )}
                          </g>
                        );
                      })}
                  </g>
                )}

                {activeCell?.signalId === sig.id && row.type === 'signal' && !sanitizedFolds.some(f => activeCell.cycleIndex >= f.start && activeCell.cycleIndex < f.end) && (
                  <rect data-export-exclude="true" x={timeToX(activeCell.cycleIndex)} y={rowY} width={timeToX(activeCell.cycleIndex + 1) - timeToX(activeCell.cycleIndex)} height={sig.height} fill="none" stroke="#3b82f6" strokeWidth={2} pointerEvents="none" />
                )}
                {/* Pointer capture keeps the entire gesture on the initial signal. */}
                {row.type === 'signal' && <rect data-export-exclude="true" data-signal-hit={sig.id}
                  x={labelWidth} y={rowY} width={totalWidth - labelWidth} height={sig.height}
                  fill="transparent" className="cursor-pointer" style={{ touchAction: 'none' }}
                  onPointerDown={e => {
                    if (e.button !== 0) return;
                    e.preventDefault(); e.stopPropagation();
                    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                    const svg = e.currentTarget.ownerSVGElement!;
                    (document.activeElement as HTMLElement)?.blur?.();
                    svg.focus();
                    const bounds = svg.getBoundingClientRect();
                    const x = (e.clientX - bounds.left) * totalWidth / bounds.width;
                    const time = xToTime(x);
                    const cycle = Math.floor(time);
                    if (x < labelWidth + scrollLeft || time >= config.numCycles || sanitizedFolds.some(f => time >= f.start && time < f.end)) return;
                    onCanvasClick?.(sig.id, cycle, e.clientX, e.clientY);
                    if (sig.type === 'clock') return;
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    const deferred = sig.type === 'bus';
                    drag.current = { pointer: e.pointerId, signalId: sig.id, first: cycle, last: cycle, state: nextWaveState(sig, cycle, config.numCycles), moved: false, deferred, visited: new Set() };
                    onPaintStart?.();
                    if (!deferred) { drag.current.visited.add(cycle); onPaintCells?.(sig.id, [cycle], drag.current.state); }
                  }}
                  onPointerMove={e => {
                    const svg = e.currentTarget.ownerSVGElement!;
                    const bounds = svg.getBoundingClientRect();
                    const x = (e.clientX - bounds.left) * totalWidth / bounds.width;
                    const y = (e.clientY - bounds.top) * totalHeight / bounds.height;
                    const time = xToTime(x);
                    const cycle = Math.floor(time);
                    if (x >= labelWidth + scrollLeft && time < config.numCycles && !sanitizedFolds.some(f => time >= f.start && time < f.end)) setHoveredCycle({ signalId: sig.id, cycle });
                    const gesture = drag.current;
                    if (!gesture || gesture.pointer !== e.pointerId || y < rowY || y > rowY + sig.height || x < labelWidth + scrollLeft || time >= config.numCycles) return;
                    if (cycle !== gesture.first) gesture.moved = true;
                    if (!gesture.moved) return;
                    const cells = visiblePaintRange(gesture.last, cycle, config.numCycles, sanitizedFolds).filter(c => !gesture.visited.has(c));
                    cells.forEach(c => gesture.visited.add(c));
                    gesture.last = cycle;
                    if (cells.length) onPaintCells?.(gesture.signalId, cells, gesture.state);
                  }}
                  onPointerUp={e => {
                    const gesture = drag.current;
                    if (!gesture || gesture.pointer !== e.pointerId) return;
                    drag.current = null;
                    onPaintEnd?.();
                    if (gesture.deferred && !gesture.moved) {
                      clickTimer.current = setTimeout(() => {
                        clickTimer.current = null; onPaintStart?.();
                        onPaintCells?.(gesture.signalId, [gesture.first], gesture.state); onPaintEnd?.();
                      }, 300);
                    }
                    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                  }}
                  onPointerCancel={() => { drag.current = null; onPaintEnd?.(); }}
                  onLostPointerCapture={() => { if (drag.current) { drag.current = null; onPaintEnd?.(); } }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
                    const bounds = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
                    const x = (e.clientX - bounds.left) * totalWidth / bounds.width;
                    const time = xToTime(x);
                    const cycle = Math.floor(time);
                    if (sig.type === 'bus' && x >= labelWidth + scrollLeft && time < config.numCycles && !sanitizedFolds.some(f => time >= f.start && time < f.end) && parseWaveform(sig.waveStr, config.numCycles)[cycle] === '=') onBusLabelEdit?.(sig.id, cycle);
                  }}
                />}
              </g>
            );
          })}

          {/* 4. DRAW HORIZONTAL FOLD / TIME BREAK ZIGZAGS (≈) ACROSS ALL TRACKS */}
          {sanitizedFolds.map((fold) => {
            const startX = getXForTime(fold.start);
            const endX = startX + FOLD_BREAK_WIDTH;
            const midX = (startX + endX) / 2;
            const omittedCount = fold.end - fold.start;
            const foldLabel = fold.label || `+${omittedCount} cyc`;

            return (
              <g key={`fold-col-${fold.id}`} className="group">
                {/* Break region shaded overlay */}
                <rect
                  x={startX}
                  y={topMargin - 15}
                  width={FOLD_BREAK_WIDTH}
                  height={totalHeight - bottomMargin - topMargin + 15}
                  fill="url(#hatch-fold)"
                  opacity={isDark ? 0.4 : 0.6}
                />

                {/* Left Zigzag break line */}
                <path
                  d={`M ${startX + 8} ${topMargin - 15}
                      L ${startX + 14} ${topMargin + 10}
                      L ${startX + 8} ${topMargin + 35}
                      L ${startX + 14} ${topMargin + 60}
                      L ${startX + 8} ${topMargin + 85}
                      L ${startX + 14} ${topMargin + 110}
                      L ${startX + 8} ${totalHeight - bottomMargin}`}
                  fill="none"
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                {/* Right Zigzag break line */}
                <path
                  d={`M ${endX - 8} ${topMargin - 15}
                      L ${endX - 2} ${topMargin + 10}
                      L ${endX - 8} ${topMargin + 35}
                      L ${endX - 2} ${topMargin + 60}
                      L ${endX - 8} ${topMargin + 85}
                      L ${endX - 2} ${topMargin + 110}
                      L ${endX - 8} ${totalHeight - bottomMargin}`}
                  fill="none"
                  stroke={isDark ? "#64748b" : "#94a3b8"}
                  strokeWidth={2}
                  strokeLinecap="round"
                />

                {/* Top Break Badge with Unfold/Expand button */}
                <g className="cursor-pointer" onClick={() => onRemoveFold && onRemoveFold(fold.id)}>
                  <rect
                    x={midX - 24}
                    y={topMargin - 26}
                    width={48}
                    height={18}
                    rx={4}
                    fill={isDark ? "#1e293b" : "#ffffff"}
                    stroke={isDark ? "#64748b" : "#cbd5e1"}
                    strokeWidth={1}
                  />
                  <text
                    x={midX - 3}
                    y={topMargin - 13.5}
                    textAnchor="middle"
                    className={`font-mono text-[9px] font-bold ${isDark ? "fill-amber-400" : "fill-amber-600"}`}
                  >
                    ≈ {omittedCount}
                  </text>
                  {onRemoveFold && (
                    <text data-export-exclude="true"
                      x={midX + 16}
                      y={topMargin - 13.5}
                      textAnchor="middle"
                      className="fill-rose-500 text-[9px] font-bold"
                    >
                      <title>Click to expand folded region</title>
                      ✕
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          {/* 5. DRAW RELATIONSHIPS / TIMING CONSTRAINTS (ARROWS) */}
          {constraints.map((c) => {
            const fromIndex = getSignalIndexById(c.fromSignalId);
            const toIndex = getSignalIndexById(c.toSignalId);

            if (fromIndex === -1 || toIndex === -1) return null;

            const xStart = getXForTime(c.fromTime);
            const xEnd = getXForTime(c.toTime);

            const yStart = getYForSignalIndex(fromIndex) + signals[fromIndex].height / 2;
            const yEnd = getYForSignalIndex(toIndex) + signals[toIndex].height / 2;

            let arrowPath = "";
            let textX = (xStart + xEnd) / 2;
            let textY = (yStart + yEnd) / 2 - 6;

            if (xStart === xEnd || Math.abs(yStart - yEnd) < 10) {
              arrowPath = `M ${xStart} ${yStart} L ${xEnd} ${yEnd}`;
            } else {
              const midX = (xStart + xEnd) / 2;
              arrowPath = `M ${xStart} ${yStart} Q ${midX} ${(yStart + yEnd) / 2} ${xEnd} ${yEnd}`;
            }

            return (
              <g key={`constraint-${c.id}`} style={{ color: c.color }}>
                <path
                  d={arrowPath}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={1.5}
                  strokeDasharray={c.style === "dashed" ? "3 3" : undefined}
                  markerEnd={c.arrowType === "to" || c.arrowType === "both" ? "url(#arrow-to)" : undefined}
                  markerStart={c.arrowType === "both" ? "url(#arrow-both)" : undefined}
                />
                <g>
                  <rect
                    x={textX - (c.label.length * 4.2 + 6)}
                    y={textY - 9}
                    width={c.label.length * 8.4 + 12}
                    height={16}
                    fill={dynamicBgColor}
                    rx={4}
                    stroke={isDark ? "#334155" : "#e2e8f0"}
                    strokeWidth={0.5}
                  />
                  <text
                    x={textX}
                    y={textY + 3}
                    textAnchor="middle"
                    className={`font-mono text-[9.5px] font-bold ${isDark ? "fill-white" : "fill-slate-700"}`}
                  >
                    {c.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* 6. DRAW CUSTOM TIMELINE MARKERS */}
          {markers.map((m) => {
            const x = getXForTime(m.time);

            return (
              <g key={`marker-elm-${m.id}`} className="group cursor-col-resize">
                {m.showLine && (
                  <line
                    x1={x}
                    y1={topMargin - 5}
                    x2={x}
                    y2={totalHeight - bottomMargin}
                    stroke={m.color}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                <g>
                  <polygon
                    points={`${x},${topMargin - 5} ${x - 5},${topMargin - 15} ${x + 5},${topMargin - 15}`}
                    fill={m.color}
                  />
                  <rect
                    x={x - (m.label.length * 3.5 + 8)}
                    y={topMargin - 32}
                    width={m.label.length * 7 + 16}
                    height={16}
                    fill={m.color}
                    rx={3}
                  />
                  <text
                    x={x}
                    y={topMargin - 20}
                    textAnchor="middle"
                    className="fill-white font-mono text-[9px] font-semibold"
                  >
                    {m.label} ({Math.round(m.time * config.timeScale)}s)
                  </text>
                </g>
              </g>
            );
          })}

          {/* 7. STICKY SIGNAL LABEL SIDEBAR PINNED ON SCROLL */}
          <g data-sticky-labels="true" transform={`translate(${scrollLeft}, 0)`}>
            {/* Sidebar background and divider line */}
            <rect
              x={0}
              y={0}
              width={labelWidth}
              height={totalHeight}
              fill={dynamicBgColor}
            />
            <line
              x1={labelWidth}
              y1={0}
              x2={labelWidth}
              y2={totalHeight}
              stroke={isDark ? "#334155" : "#cbd5e1"}
              strokeWidth={1.5}
            />

            {/* Timeline header unit label */}
            {config.timelineVisible && (
              <text
                x={labelWidth - 12}
                y={topMargin - 12}
                textAnchor="end"
                className={`${isDark ? "fill-slate-300 font-bold" : "fill-slate-400"} font-mono text-[10.5px] tracking-wide font-semibold uppercase`}
              >
                Time ({config.timeUnitLabel})
              </text>
            )}

            {/* Signal track labels */}
            {renderRows.map((row, rIdx) => {
              const rowY = getYForSignalIndex(rIdx);
              const sig = row.signal;
              const highY = rowY + 12;
              const lowY = rowY + sig.height - 4;
              const midY = (highY + lowY) / 2;

              return (
                <g key={`sticky-label-${row.type}-${sig.id}-${row.bitIndex ?? "p"}`}>
                  {row.type === "signal" ? (
                    <g className="cursor-pointer">
                      {/* Color ribbon */}
                      <rect
                        x={12}
                        y={rowY + 8}
                        width={4}
                        height={sig.height - 16}
                        fill={sig.color}
                        rx={2}
                      />

                      {/* Signal Name */}
                      <text
                        x={sig.type === "bus" ? 44 : 24}
                        y={midY + 4}
                        className={`${isDark ? "fill-white font-bold" : "fill-slate-800"} font-mono text-xs font-semibold`}
                        textAnchor="start"
                      >
                        {sig.name}
                        {sig.type === "bus" && `[${(sig.busWidth || 8) - 1}:0]`}
                      </text>

                      {/* Expand/Collapse Button */}
                      {sig.type === "bus" && onUpdateSignals && (
                        <g data-export-exclude="true"
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = signals.map((s) =>
                              s.id === sig.id ? { ...s, isExpanded: !s.isExpanded } : s
                            );
                            onUpdateSignals(updated);
                          }}
                        >
                          <rect
                            x={24}
                            y={midY - 7}
                            width={14}
                            height={14}
                            rx={3}
                            fill={isDark ? "#1e293b" : "#f1f5f9"}
                            stroke={isDark ? "#475569" : "#cbd5e1"}
                            strokeWidth={1}
                          />
                          <text
                            x={31}
                            y={midY + 3}
                            textAnchor="middle"
                            className={`${isDark ? "fill-slate-300 font-bold" : "fill-slate-600 font-bold"} font-mono text-[10px]`}
                          >
                            {sig.isExpanded ? "−" : "+"}
                          </text>
                        </g>
                      )}
                    </g>
                  ) : (
                    // Child Bitwise Sub-signal elements
                    <g
                      className="cursor-pointer"
                      onClick={() => {
                        if (onUpdateSignals) {
                          const updated = signals.map((s) =>
                            s.id === sig.id ? { ...s, isExpanded: false } : s
                          );
                          onUpdateSignals(updated);
                        }
                      }}
                    >
                      <title>Click to collapse bus parent</title>
                      <line
                        x1={20}
                        y1={rowY - 14}
                        x2={20}
                        y2={midY}
                        stroke={isDark ? "#475569" : "#cbd5e1"}
                        strokeWidth={1}
                      />
                      <line
                        x1={20}
                        y1={midY}
                        x2={28}
                        y2={midY}
                        stroke={isDark ? "#475569" : "#cbd5e1"}
                        strokeWidth={1}
                      />
                      <text
                        x={34}
                        y={midY + 4}
                        className={`${isDark ? "fill-slate-300 font-bold" : "fill-slate-600 font-medium"} font-mono text-[11px]`}
                        textAnchor="start"
                      >
                        {sig.name}[{row.bitIndex}]
                      </text>
                      <text
                        x={labelWidth - 10}
                        y={midY + 4}
                        className="fill-slate-500 font-mono text-[9px] font-bold text-right"
                        textAnchor="end"
                      >
                        bit {row.bitIndex}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

