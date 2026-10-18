import type { TimingDiagramData, TimeFold, RepeatRange, DiagramConfig, Signal } from "./types";

/**
 * Parses a waveStr of characters ('0', '1', 'z', 'x', '=') into an array
 * of states of length numCycles, carrying over previous state on '.'
 */
export function parseWaveform(waveStr: string, numCycles: number): string[] {
  const result: string[] = [];
  let lastState = "0";

  for (let i = 0; i < numCycles; i++) {
    const char = i < waveStr.length ? waveStr[i] : ".";
    let state = lastState;

    if (char === "." || char === "~" || char === "-") {
      state = lastState;
    } else {
      const lower = char.toLowerCase();
      if (lower === "1" || lower === "h") state = "1";
      else if (lower === "0" || lower === "l") state = "0";
      else if (lower === "z") state = "z";
      else if (lower === "x") state = "x";
      else if (lower === "=") state = "=";
      else state = "0";
      lastState = state;
    }
    result.push(state);
  }
  return result;
}

export const FOLD_BREAK_WIDTH = 44; // width in pixels for a collapsed break section

export interface SanitizedFold extends TimeFold {
  start: number;
  end: number;
}

/**
 * Normalizes and sorts folds to ensure no overlaps and valid bounds
 */
export function sanitizeFolds(folds: TimeFold[] = [], maxCycles: number): SanitizedFold[] {
  const valid = folds
    .map((f) => ({
      ...f,
      start: Math.max(0, Math.min(maxCycles, Math.min(f.startCycle, f.endCycle))),
      end: Math.max(0, Math.min(maxCycles, Math.max(f.startCycle, f.endCycle))),
    }))
    .filter((f) => f.end - f.start >= 1)
    .sort((a, b) => a.start - b.start);

  const nonOverlapping: SanitizedFold[] = [];
  for (const f of valid) {
    if (nonOverlapping.length === 0) {
      nonOverlapping.push(f);
    } else {
      const prev = nonOverlapping[nonOverlapping.length - 1];
      if (f.start <= prev.end) {
        // Merge overlapping folds
        prev.end = Math.max(prev.end, f.end);
        prev.label = prev.label || f.label;
      } else {
        nonOverlapping.push(f);
      }
    }
  }
  return nonOverlapping;
}

/**
 * Coordinate mapping with horizontal folds & automatic repeat pattern omission
 */
export function createTimelineCoordinateMapper(
  config: DiagramConfig,
  folds: TimeFold[] = [],
  repeatRanges: RepeatRange[] = [],
  labelWidth: number = 145
) {
  // Combine explicit folds with repeat-omitted folds (omitting 2nd+ iterations)
  const combinedFolds: TimeFold[] = [...folds];

  for (const rep of repeatRanges) {
    if (rep.omitRepetitions === false) continue;
    const countNum = typeof rep.count === "number"
      ? rep.count
      : parseInt(String(rep.count).replace(/\D/g, ""), 10) || 1;

    if (countNum > 1) {
      const period = rep.period || Math.max(1, Math.round((rep.endCycle - rep.startCycle) / countNum));
      const foldStart = rep.startCycle + period;
      const foldEnd = rep.endCycle;
      if (foldEnd > foldStart) {
        combinedFolds.push({
          id: `rep_fold_${rep.id}`,
          startCycle: foldStart,
          endCycle: foldEnd,
          label: `repeat ${countNum}`,
        });
      }
    }
  }

  const sanitizedFolds = sanitizeFolds(combinedFolds, config.numCycles);

  // Function to convert time (cycles) to SVG X coordinate
  const timeToX = (time: number): number => {
    let currentX = labelWidth;
    let currentTime = 0;

    for (const fold of sanitizedFolds) {
      if (time <= fold.start) {
        return currentX + (time - currentTime) * config.cycleWidth;
      }

      // Add segment before this fold
      currentX += (fold.start - currentTime) * config.cycleWidth;
      currentTime = fold.start;

      if (time <= fold.end) {
        // Time lies inside the fold break: map linearly across break width
        const foldProgress = (time - fold.start) / (fold.end - fold.start);
        return currentX + foldProgress * FOLD_BREAK_WIDTH;
      }

      // Jump over the fold break
      currentX += FOLD_BREAK_WIDTH;
      currentTime = fold.end;
    }

    // Add remaining time
    currentX += (time - currentTime) * config.cycleWidth;
    return currentX;
  };

  // Inverse function: convert SVG X coordinate to time (cycles)
  const xToTime = (x: number): number => {
    if (x <= labelWidth) return 0;
    let currentX = labelWidth;
    let currentTime = 0;

    for (const fold of sanitizedFolds) {
      const segWidth = (fold.start - currentTime) * config.cycleWidth;
      if (x <= currentX + segWidth) {
        return currentTime + (x - currentX) / config.cycleWidth;
      }

      currentX += segWidth;
      currentTime = fold.start;

      if (x <= currentX + FOLD_BREAK_WIDTH) {
        // Inside fold break: snap to start of fold
        const foldProgress = (x - currentX) / FOLD_BREAK_WIDTH;
        return fold.start + foldProgress * (fold.end - fold.start);
      }

      currentX += FOLD_BREAK_WIDTH;
      currentTime = fold.end;
    }

    const remainingX = x - currentX;
    return Math.min(config.numCycles, currentTime + remainingX / config.cycleWidth);
  };

  const totalCalculatedWidth = timeToX(config.numCycles) + 40;

  return {
    timeToX,
    xToTime,
    sanitizedFolds,
    totalCalculatedWidth,
  };
}

/**
 * Returns a state signature for all signals at a specific cycle index
 */
export function getCycleSnapshot(signals: Signal[], cycleIndex: number, numCycles: number): string {
  const parts: string[] = [];
  for (const sig of signals) {
    if (sig.type === "clock") {
      const cfg = sig.clockConfig || { period: 2, dutyCycle: 50, phase: 0, inverted: false };
      const period = Math.max(0.1, cfg.period);
      const highDur = period * Math.max(0.01, Math.min(0.99, (cfg.dutyCycle ?? 50) / 100));
      const phase = ((cfg.phase || 0) % period + period) % period;
      
      // Sample state at mid-cycle
      let t = cycleIndex + 0.5 - phase;
      if (t < 0) t = (t % period) + period;
      const prog = t % period;
      const isHigh = cfg.inverted ? !(prog < highDur) : prog < highDur;
      parts.push(`${sig.id}:clk=${isHigh ? '1' : '0'}`);
    } else {
      const waveStates = parseWaveform(sig.waveStr, numCycles);
      const state = waveStates[cycleIndex] || "0";
      if (state === "=") {
        const busVal = sig.busValues[cycleIndex] || "";
        parts.push(`${sig.id}:bus=${busVal}`);
      } else {
        parts.push(`${sig.id}:${state}`);
      }
    }
  }
  return parts.join("|");
}

export interface RepeatMatchResult {
  valid: boolean;
  error?: string;
  startCycle: number;
  period: number;
  repeatCount: number;
  totalCycles: number;
  mismatchCycle?: number;
  mismatchSignalName?: string;
}

/**
 * Verifies if the range starting at `startCycle` with period `period` is identical
 * across all `repeatCount` repetitions.
 */
export function verifyRepeatPattern(
  signals: Signal[],
  startCycle: number,
  period: number,
  repeatCount: number,
  numCycles: number
): RepeatMatchResult {
  if (![startCycle, period, repeatCount, numCycles].every(Number.isInteger) || startCycle < 0) {
    return { valid: false, error: "Invalid repeat range", startCycle, period, repeatCount, totalCycles: period * repeatCount };
  }
  if (repeatCount < 3) {
    return { valid: false, error: "Repeat count must be at least 3 (3回以上)", startCycle, period, repeatCount, totalCycles: period * repeatCount };
  }
  if (period < 1) {
    return { valid: false, error: "Period must be at least 1 cycle", startCycle, period, repeatCount, totalCycles: period };
  }
  const totalCycles = period * repeatCount;
  if (totalCycles < 3) {
    return { valid: false, error: "Total repeated duration must be at least 3 cycles (3サイクル以上)", startCycle, period, repeatCount, totalCycles };
  }
  if (startCycle + totalCycles > numCycles) {
    return {
      valid: false,
      error: `Range (${startCycle}..${startCycle + totalCycles}) exceeds total cycles (${numCycles})`,
      startCycle,
      period,
      repeatCount,
      totalCycles,
    };
  }

  const parsedStates = new Map(signals.map(sig => [sig.id, parseWaveform(sig.waveStr, numCycles)]));

  // Compare every iteration against the base iteration (iteration 0)
  for (let iter = 1; iter < repeatCount; iter++) {
    for (let offset = 0; offset < period; offset++) {
      const baseCycle = startCycle + offset;
      const targetCycle = startCycle + iter * period + offset;

      for (const sig of signals) {
        if (sig.type === "clock") {
          const cfg = sig.clockConfig || { period: 2, dutyCycle: 50, phase: 0, inverted: false };
          // Every repeated offset must reproduce the full clock waveform, not just a sample.
          const periods = ((targetCycle - baseCycle) / cfg.period);
          if (Math.abs(periods - Math.round(periods)) > 1e-8) {
            return { valid: false, error: `Clock "${sig.name}" phase mismatch`, startCycle, period, repeatCount, totalCycles, mismatchCycle: targetCycle, mismatchSignalName: sig.name };
          }
          continue;
        }

        const waveStates = parsedStates.get(sig.id)!;
        const baseState = waveStates[baseCycle] || "0";
        const targetState = waveStates[targetCycle] || "0";

        if (baseState !== targetState) {
          return {
            valid: false,
            error: `Signal "${sig.name}" mismatch at cycle ${targetCycle} (expected state '${baseState}', got '${targetState}')`,
            startCycle,
            period,
            repeatCount,
            totalCycles,
            mismatchCycle: targetCycle,
            mismatchSignalName: sig.name,
          };
        }

        if (baseState === "=") {
          const baseVal = (sig.busValues[baseCycle] || "").trim();
          const targetVal = (sig.busValues[targetCycle] || "").trim();
          if (baseVal !== targetVal) {
            return {
              valid: false,
              error: `Signal "${sig.name}" bus value mismatch at cycle ${targetCycle} (expected "${baseVal}", got "${targetVal}")`,
              startCycle,
              period,
              repeatCount,
              totalCycles,
              mismatchCycle: targetCycle,
              mismatchSignalName: sig.name,
            };
          }
        }
      }
    }
  }

  return {
    valid: true,
    startCycle,
    period,
    repeatCount,
    totalCycles,
  };
}

export interface DetectedRepeatPattern {
  startCycle: number;
  period: number;
  repeatCount: number;
  endCycle: number;
  label: string;
}

/**
 * Automatically scans waveforms across all signals to detect repeated sequences.
 * Excludes cycles that are already covered by existing folds or repeat ranges.
 */
export function findRepeatingPatterns(
  signals: Signal[],
  numCycles: number,
  folds: TimeFold[] = [],
  repeatRanges: RepeatRange[] = [],
  maxPeriod: number = 8
): DetectedRepeatPattern[] {
  const results: DetectedRepeatPattern[] = [];
  if (!signals.length) return results;
  const minRepeatCount = 3;
  // Parse each signal once; compare only the new iteration when extending a candidate.
  const nonClocks = signals.filter(sig => sig.type !== 'clock');
  const states = nonClocks.map(sig => parseWaveform(sig.waveStr, numCycles));
  const snapshots = Array.from({ length: numCycles }, (_, cycle) => JSON.stringify(nonClocks
    .map((sig, index) => {
      const state = states[index][cycle];
      return [state, state === '=' ? (sig.busValues[cycle] || '').trim() : ''];
    })));
  const clocksMatch = (period: number) => signals.every(sig => {
    if (sig.type !== 'clock') return true;
    const ratio = period / (sig.clockConfig?.period || 2);
    return Math.abs(ratio - Math.round(ratio)) < 1e-8;
  });

  // Build a set or array of cycles that are already folded/repeated
  const isCycleFoldedOrRepeated = (cycle: number): boolean => {
    for (const f of folds) {
      if (cycle >= f.startCycle && cycle < f.endCycle) return true;
    }
    for (const r of repeatRanges) {
      if (cycle >= r.startCycle && cycle < r.endCycle) return true;
    }
    return false;
  };

  const isRangeOverlappingFoldOrRepeat = (startCycle: number, endCycle: number): boolean => {
    for (let c = startCycle; c < endCycle; c++) {
      if (isCycleFoldedOrRepeated(c)) return true;
    }
    return false;
  };

  for (let period = 1; period <= maxPeriod; period++) {
    if (!clocksMatch(period)) continue;
    let start = 0;
    while (start + period * minRepeatCount <= numCycles) {
      // If start cycle is already folded or repeated, skip ahead
      if (isCycleFoldedOrRepeated(start)) {
        start++;
        continue;
      }

      let count = 1;
      while (start + (count + 1) * period <= numCycles) {
        // If the candidate extension overlaps existing folds/repeats, stop extending
        if (isRangeOverlappingFoldOrRepeat(start + count * period, start + (count + 1) * period)) {
          break;
        }
        let matches = true;
        for (let offset = 0; offset < period; offset++) {
          if (snapshots[start + offset] !== snapshots[start + count * period + offset]) {
            matches = false;
            break;
          }
        }
        if (!matches) break;
        count++;
      }

      if (count >= minRepeatCount) {
        // Ensure entire candidate range does not overlap existing folds/repeats
        if (!isRangeOverlappingFoldOrRepeat(start, start + period * count)) {
          results.push({
            startCycle: start,
            period,
            repeatCount: count,
            endCycle: start + period * count,
            label: `${period} cycle pattern x ${count} (${start}..${start + period * count})`,
          });
          start += period * count;
          continue;
        }
      }
      start++;
    }
  }

  // Sort and deduplicate overlapping detections by longest total coverage
  const selected: DetectedRepeatPattern[] = [];
  for (const candidate of results.sort((a, b) => (b.endCycle - b.startCycle) - (a.endCycle - a.startCycle))) {
    if (!selected.some(r => candidate.startCycle < r.endCycle && candidate.endCycle > r.startCycle)) selected.push(candidate);
  }
  return selected;
}

/**
 * Initial timing diagram configuration & signals
 */
export const INITIAL_DIAGRAM: TimingDiagramData = {
  config: {
    numCycles: 14,
    cycleWidth: 65,
    gridVisible: true,
    gridSubdivisions: 2,
    gridColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    markerColor: "#ef4444",
    timelineVisible: true,
    timeUnitLabel: "ns",
    timeScale: 10,
  },
  signals: [
    {
      id: "sys_clk",
      name: "CLK",
      type: "clock",
      color: "#2563EB",
      strokeWidth: 2.5,
      height: 40,
      waveStr: "01010101010101",
      busValues: {},
      clockConfig: {
        period: 2,
        dutyCycle: 50,
        phase: 0,
        inverted: false,
      },
    },
    {
      id: "spi_cs",
      name: "CE(Chip Select)",
      type: "binary",
      color: "#dc2626",
      strokeWidth: 2.5,
      height: 40,
      waveStr: "110..........1",
      busValues: {},
    },
    {
      id: "spi_mosi",
      name: "MOSI",
      type: "bus",
      color: "#059669",
      strokeWidth: 2.5,
      height: 40,
      waveStr: "zz0.1.0.1.0.zz",
      busValues: {
        3: "0xAB",
        5: "0x32",
        7: "0xFF",
        9: "0x00",
      },
    },
    {
      id: "spi_miso",
      name: "MISO",
      type: "bus",
      color: "#7c3aed",
      strokeWidth: 2.5,
      height: 40,
      waveStr: "zzzz0.1.0.1.zz",
      busValues: {
        5: "0x00",
        7: "0xE1",
        9: "0xA5",
      },
    },
  ],
  markers: [
    {
      id: "m_start",
      time: 2.0,
      label: "CE Assert",
      color: "#ef4444",
      showLine: true,
    },
    {
      id: "m_first_bit",
      time: 3.0,
      label: "First Bit Active",
      color: "#f59e0b",
      showLine: true,
    },
  ],
  constraints: [
    {
      id: "c_setup",
      fromSignalId: "spi_cs",
      fromTime: 2.0,
      toSignalId: "sys_clk",
      toTime: 3.0,
      label: "t_lead = 10ns",
      color: "#475569",
      style: "dashed",
      arrowType: "both",
    },
  ],
  repeatRanges: [
    {
      id: "rep_burst",
      startCycle: 3,
      endCycle: 11,
      count: "4x",
      label: "Byte Stream",
      color: "#0284c7",
    },
  ],
  folds: [],
};

