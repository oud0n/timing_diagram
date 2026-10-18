import type { Signal, TimingDiagramData } from './types';
import { busSegmentStarts, parseWaveform } from './utils';
export type WaveState = '0' | '1' | '=' | 'z' | 'x';
export function nextWaveState(signal: Signal, cycle: number, numCycles: number): WaveState {
  const state = parseWaveform(signal.waveStr, numCycles)[cycle];
  if (signal.type === 'binary') return state === '1' ? '0' : '1';
  const order: WaveState[] = ['0', '1', '=', 'z', 'x'];
  return order[(order.indexOf(state as WaveState) + 1) % order.length];
}
/**
 * Expand continuations before painting, so unchanged cells retain their displayed value.
 * Bus segments keep their boundaries and labels: a contiguous run of painted '=' cells
 * becomes one new segment, and a segment cut by a painted cell continues as its own segment.
 */
export function paintWaveCells(diagram: TimingDiagramData, signalId: string, cycles: number[], state: WaveState): TimingDiagramData {
  return { ...diagram, signals: diagram.signals.map(signal => {
    if (signal.id !== signalId || signal.type === 'clock') return signal;
    const n = diagram.config.numCycles;
    const states = parseWaveform(signal.waveStr, n);
    const starts = busSegmentStarts(signal.waveStr, n);
    const painted = new Set(cycles.filter(c => Number.isInteger(c) && c >= 0 && c < n));
    const out: string[] = [];
    const busValues: Record<number, string> = {};
    let prevSegment: string | null = null;
    for (let c = 0; c < n; c++) {
      const isPainted = painted.has(c);
      const st = isPainted ? state : states[c];
      let segment: string | null = null;
      if (st === '=') segment = isPainted ? (painted.has(c - 1) && prevSegment?.startsWith('new:') ? prevSegment : `new:${c}`) : `old:${starts[c]}`;
      if (st !== '=') out.push(st);
      else if (segment === prevSegment) out.push('.');
      else {
        out.push('=');
        const label = isPainted ? signal.busValues[c] ?? 'DATA' : signal.busValues[starts[c]];
        if (label !== undefined) busValues[c] = label;
      }
      prevSegment = segment;
    }
    return { ...signal, waveStr: out.join(''), busValues };
  }) };
}
/** A cell samples the generated clock at its centre when converted to editable Binary. */
export function clockToBinary(signal: Signal, numCycles: number): Signal {
  if (signal.type !== 'clock') return signal;
  const cfg = signal.clockConfig || { period: 2, dutyCycle: 50, phase: 0, inverted: false };
  const waveStr = Array.from({ length: numCycles }, (_, cycle) => {
    const progress = ((cycle + 0.5 - cfg.phase) % cfg.period + cfg.period) % cfg.period;
    const high = progress < cfg.period * cfg.dutyCycle / 100;
    return high !== cfg.inverted ? '1' : '0';
  }).join('');
  const { clockConfig, ...rest } = signal;
  return { ...rest, type: 'binary', waveStr, busValues: {} };
}
export function visiblePaintRange(from: number, to: number, numCycles: number, folds: { start: number; end: number }[]): number[] {
  const result: number[] = [];
  for (let i = Math.max(0, Math.min(from, to)); i <= Math.min(numCycles - 1, Math.max(from, to)); i++) {
    if (!folds.some(f => i >= f.start && i < f.end)) result.push(i);
  }
  return result;
}
