import type { Signal, TimingDiagramData } from './types';
import { parseWaveform } from './utils';
export type WaveState = '0' | '1' | '=' | 'z' | 'x';
export function nextWaveState(signal: Signal, cycle: number, numCycles: number): WaveState {
  const state = parseWaveform(signal.waveStr, numCycles)[cycle];
  if (signal.type === 'binary') return state === '1' ? '0' : '1';
  const order: WaveState[] = ['0', '1', '=', 'z', 'x'];
  return order[(order.indexOf(state as WaveState) + 1) % order.length];
}
/** Expand continuations before painting, so unchanged cells retain their displayed value. */
export function paintWaveCells(diagram: TimingDiagramData, signalId: string, cycles: number[], state: WaveState): TimingDiagramData {
  return { ...diagram, signals: diagram.signals.map(signal => {
    if (signal.id !== signalId || signal.type === 'clock') return signal;
    const states = parseWaveform(signal.waveStr, diagram.config.numCycles);
    const busValues = { ...signal.busValues };
    for (const cycle of cycles) {
      if (!Number.isInteger(cycle) || cycle < 0 || cycle >= states.length) continue;
      states[cycle] = state;
      if (state === '=') busValues[cycle] ??= 'DATA';
      else delete busValues[cycle];
    }
    return { ...signal, waveStr: states.join(''), busValues };
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
