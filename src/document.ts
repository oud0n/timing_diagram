import type { TimingDiagramData } from './types';
import { MAX_TIMELINE_CYCLES } from './timeline';

export const FORMAT_VERSION = 1;
type Obj = Record<string, any>;
function object(value: unknown, path: string): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path}: expected object`);
  return value as Obj;
}
function text(value: unknown, path: string, nonempty = false): string {
  if (typeof value !== 'string' || (nonempty && !value.trim())) throw new Error(`${path}: expected ${nonempty ? 'nonempty ' : ''}string`);
  return value;
}
function number(value: unknown, path: string, min: number, max = Number.MAX_SAFE_INTEGER, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${path}: invalid number`);
  return value;
}
function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${path}: expected boolean`);
  return value;
}
function choice(value: unknown, path: string, choices: string[]): string {
  if (!choices.includes(value as string)) throw new Error(`${path}: invalid value`);
  return value as string;
}
function color(value: unknown, path: string): string {
  const result = text(value, path);
  if (!/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(result)) throw new Error(`${path}: expected hex color`);
  return result;
}
function list(value: unknown, path: string, optional = false): Obj[] {
  if (optional && value === undefined) return [];
  if (!Array.isArray(value) || value.length > 1000) throw new Error(`${path}: expected array of at most 1000 items`);
  const ids = new Set<string>();
  return value.map((item, i) => {
    const row = object(item, `${path}[${i}]`);
    const id = text(row.id, `${path}[${i}].id`, true);
    if (ids.has(id)) throw new Error(`${path}: duplicate id ${id}`);
    ids.add(id);
    return row;
  });
}

/** Accepts only the current SVG editor schema, with or without its version tag. */
export function parseDiagram(input: string): TimingDiagramData {
  const root = object(JSON.parse(input), 'document');
  if (root.formatVersion !== undefined && root.formatVersion !== FORMAT_VERSION) throw new Error('Unsupported document formatVersion');
  const c = object(root.config, 'config');
  const numCycles = number(c.numCycles, 'config.numCycles', 2, MAX_TIMELINE_CYCLES, true);
  const time = (v: unknown, p: string) => number(v, p, 0, numCycles);
  const cycle = (v: unknown, p: string) => number(v, p, 0, numCycles, true);
  const config = {
    numCycles,
    cycleWidth: number(c.cycleWidth, 'config.cycleWidth', 24, 200),
    gridVisible: bool(c.gridVisible, 'config.gridVisible'),
    gridSubdivisions: number(c.gridSubdivisions, 'config.gridSubdivisions', 1, 16, true),
    gridColor: color(c.gridColor, 'config.gridColor'),
    backgroundColor: color(c.backgroundColor, 'config.backgroundColor'),
    markerColor: color(c.markerColor, 'config.markerColor'),
    timelineVisible: bool(c.timelineVisible, 'config.timelineVisible'),
    timeUnitLabel: text(c.timeUnitLabel, 'config.timeUnitLabel'),
    timeScale: number(c.timeScale, 'config.timeScale', 0.1, 10000),
  };
  const signals = list(root.signals, 'signals').map((s, i) => {
    const p = `signals[${i}]`;
    const waveStr = text(s.waveStr, `${p}.waveStr`);
    if (waveStr.length > MAX_TIMELINE_CYCLES || !/^[01zx=.~\-hl]*$/i.test(waveStr)) throw new Error(`${p}.waveStr: invalid notation`);
    const busValues: Record<number, string> = {};
    for (const [key, val] of Object.entries(object(s.busValues, `${p}.busValues`))) {
      if (!/^(0|[1-9]\d*)$/.test(key)) throw new Error(`${p}.busValues: invalid cycle`);
      number(Number(key), `${p}.busValues cycle`, 0, numCycles - 1, true);
      busValues[Number(key)] = text(val, `${p}.busValues[${key}]`);
    }
    const signal: Obj = {
      id: s.id, name: text(s.name, `${p}.name`),
      type: choice(s.type, `${p}.type`, ['clock', 'binary', 'bus', 'hiz', 'undefined']),
      color: color(s.color, `${p}.color`),
      strokeWidth: number(s.strokeWidth, `${p}.strokeWidth`, 0.1, 10),
      height: number(s.height, `${p}.height`, 24, 100), waveStr, busValues,
    };
    if (s.clockConfig !== undefined) {
      const k = object(s.clockConfig, `${p}.clockConfig`);
      signal.clockConfig = {
        period: number(k.period, `${p}.period`, 0.1, 1000),
        dutyCycle: number(k.dutyCycle, `${p}.dutyCycle`, 1, 99),
        phase: number(k.phase, `${p}.phase`, 0, 1000), inverted: bool(k.inverted, `${p}.inverted`),
      };
    }
    if (s.busFormat !== undefined) signal.busFormat = choice(s.busFormat, `${p}.busFormat`, ['hex', 'dec', 'bin', 'string']);
    if (s.busWidth !== undefined) signal.busWidth = number(s.busWidth, `${p}.busWidth`, 1, 32, true);
    if (s.isExpanded !== undefined) signal.isExpanded = bool(s.isExpanded, `${p}.isExpanded`);
    return signal;
  });
  const signalIds = new Set(signals.map(s => s.id));
  const markers = list(root.markers, 'markers').map(m => ({
    id: m.id, time: time(m.time, 'marker.time'), label: text(m.label, 'marker.label'),
    color: color(m.color, 'marker.color'), showLine: bool(m.showLine, 'marker.showLine'),
  }));
  const constraints = list(root.constraints, 'constraints').map(c => {
    if (!signalIds.has(c.fromSignalId) || !signalIds.has(c.toSignalId)) throw new Error('constraint: unknown signal reference');
    return {
      id: c.id, fromSignalId: c.fromSignalId, toSignalId: c.toSignalId,
      fromTime: time(c.fromTime, 'constraint.fromTime'), toTime: time(c.toTime, 'constraint.toTime'),
      label: text(c.label, 'constraint.label'), color: color(c.color, 'constraint.color'),
      style: choice(c.style, 'constraint.style', ['dashed', 'solid']),
      arrowType: choice(c.arrowType, 'constraint.arrowType', ['both', 'to', 'none']),
    };
  });
  const range = (r: Obj, p: string) => {
    const startCycle = cycle(r.startCycle, `${p}.startCycle`);
    const endCycle = cycle(r.endCycle, `${p}.endCycle`);
    if (endCycle <= startCycle) throw new Error(`${p}: end must follow start`);
    return { id: r.id, startCycle, endCycle, ...(r.label === undefined ? {} : { label: text(r.label, `${p}.label`) }) };
  };
  const folds = list(root.folds, 'folds', true).map(f => range(f, 'fold'));
  const repeatRanges = list(root.repeatRanges, 'repeatRanges', true).map(r => {
    if (!(typeof r.count === 'number' ? Number.isInteger(r.count) && r.count >= 1 && r.count <= MAX_TIMELINE_CYCLES : typeof r.count === 'string' && /^[1-9]\d*x?$/.test(r.count) && Number(r.count.replace(/x$/, '')) <= MAX_TIMELINE_CYCLES)) throw new Error('repeat.count: invalid count');
    return {
      ...range(r, 'repeat'), count: r.count,
      ...(r.period === undefined ? {} : { period: number(r.period, 'repeat.period', 1, r.endCycle - r.startCycle, true) }),
      ...(r.color === undefined ? {} : { color: color(r.color, 'repeat.color') }),
      ...(r.omitRepetitions === undefined ? {} : { omitRepetitions: bool(r.omitRepetitions, 'repeat.omitRepetitions') }),
    };
  });
  return { config, signals, markers, constraints, folds, repeatRanges } as TimingDiagramData;
}

export function serializeDiagram(diagram: TimingDiagramData): string {
  const validated = parseDiagram(JSON.stringify(diagram));
  return JSON.stringify({ formatVersion: FORMAT_VERSION, ...validated }, null, 2);
}

/** Remove dangling references and keep timeline-dependent values in bounds after edits. */
export function reconcileDiagram(diagram: TimingDiagramData): TimingDiagramData {
  const n = diagram.config.numCycles;
  const ids = new Set(diagram.signals.map(s => s.id));
  const clamp = (v: number) => Math.max(0, Math.min(n, v));
  const ranges = <T extends { startCycle: number; endCycle: number }>(items: T[]) => items
    .map(r => ({ ...r, startCycle: clamp(r.startCycle), endCycle: clamp(r.endCycle) }))
    .filter(r => r.endCycle > r.startCycle);
  return {
    ...diagram,
    signals: diagram.signals.map(s => ({ ...s, waveStr: s.waveStr.slice(0, n), busValues: Object.fromEntries(Object.entries(s.busValues).filter(([k]) => Number(k) < n)) })),
    markers: diagram.markers.map(m => ({ ...m, time: clamp(m.time) })),
    constraints: diagram.constraints.filter(c => ids.has(c.fromSignalId) && ids.has(c.toSignalId)).map(c => ({ ...c, fromTime: clamp(c.fromTime), toTime: clamp(c.toTime) })),
    folds: ranges(diagram.folds || []),
    repeatRanges: ranges(diagram.repeatRanges || []).map(r => ({ ...r, ...(r.period === undefined ? {} : { period: Math.min(r.period, r.endCycle - r.startCycle) }) })),
  };
}
