export type SignalType = 'clock' | 'binary' | 'bus' | 'hiz' | 'undefined';

export interface Signal {
  id: string;
  name: string;
  type: SignalType;
  color: string;
  strokeWidth: number;
  height: number;
  
  // Waveform notation: each character in the string represents state of a cycle.
  // Characters: '0' (low), '1' (high), 'z' (Hi-Z), 'x' (undefined/don't care), '=' (bus segment)
  // '.' maintains previous state.
  waveStr: string;
  
  // Custom bus segment text labels, keyed by cycle index (0-based) where 'waveStr' specifies '='
  busValues: Record<number, string>;
  
  // Optional configuration if type === 'clock'
  clockConfig?: {
    period: number;      // period in units (usually 2 for full high-low cycle, 1 unit low, 1 unit high)
    dutyCycle: number;   // duty cycle percentage (usually 50)
    phase: number;       // phase shift offset (0.0 to 1.0)
    inverted: boolean;   // begins low instead of high
  };

  // Bus formatting properties
  busFormat?: 'hex' | 'dec' | 'bin' | 'string';
  busWidth?: number;      // bit width, e.g. 8, 16, 32
  isExpanded?: boolean;   // if true, render child bitwise signals
}

export interface Marker {
  id: string;
  time: number;          // unit time (can be decimal, e.g. 2.5)
  label: string;
  color: string;
  showLine: boolean;
}

export interface Constraint {
  id: string;
  fromSignalId: string;
  fromTime: number;      // timeline unit coordinate of start transition
  toSignalId: string;
  toTime: number;        // timeline unit coordinate of end transition
  label: string;         // e.g., "t_su", "15 ns"
  color: string;
  style: 'dashed' | 'solid';
  arrowType: 'both' | 'to' | 'none';
}

export interface RepeatRange {
  id: string;
  startCycle: number;
  endCycle: number;
  period?: number;       // base pattern period in cycles (e.g. 2 for "10")
  count: string | number; // e.g. "3" or 3
  label?: string;      // e.g. "Burst"
  color?: string;      // e.g. "#2563eb"
  omitRepetitions?: boolean; // whether to omit 2nd+ iterations from chart drawing (default true)
}

export interface TimeFold {
  id: string;
  startCycle: number;  // start of omitted region
  endCycle: number;    // end of omitted region
  label?: string;      // e.g. "Wait 20 cycles"
}

export interface DiagramConfig {
  numCycles: number;     // total timeline size in cycles
  cycleWidth: number;    // screen width in pixels of 1 cycle
  gridVisible: boolean;
  gridSubdivisions: number; // e.g. 2 or 4 grid points per cycle
  gridColor: string;
  backgroundColor: string;
  markerColor: string;
  timelineVisible: boolean;
  timeUnitLabel: string; // "ns", "us", "cycles", "clks"
  timeScale: number;     // e.g. 10 (so 1 cycle represents 10ns)
}

export interface TimingDiagramData {
  config: DiagramConfig;
  signals: Signal[];
  markers: Marker[];
  constraints: Constraint[];
  repeatRanges?: RepeatRange[];
  folds?: TimeFold[];
}
