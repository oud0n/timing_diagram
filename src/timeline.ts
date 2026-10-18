// Keep the largest SVG below browser layout-width limits (100k × 200px).
export const MAX_TIMELINE_CYCLES = 100_000;
export function timelineLength(current: number, waveLengths: number[]): number {
  return Math.min(MAX_TIMELINE_CYCLES, Math.max(current, ...waveLengths));
}
