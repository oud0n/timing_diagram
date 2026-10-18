// Keep the largest SVG below browser layout-width limits (100k × 200px).
export const MAX_TIMELINE_CYCLES = 100_000;
export function timelineLength(current: number, waveLengths: number[]): number {
  return Math.min(MAX_TIMELINE_CYCLES, Math.max(current, ...waveLengths));
}

/** Converts a cycle position to the configured time unit, without float noise (0.1 × 3 → 0.3). */
export function formatTimeValue(cycles: number, timeScale: number): string {
  return String(Number((cycles * timeScale).toFixed(3)));
}

export function formatTime(cycles: number, config: { timeScale: number; timeUnitLabel: string }): string {
  return `${formatTimeValue(cycles, config.timeScale)} ${config.timeUnitLabel}`.trim();
}

export const MARKER_LABEL_ROW_HEIGHT = 18;
const MARKER_CHAR_WIDTH = 5.6; // 9px monospace
const MARKER_LABEL_PADDING = 12;
const MARKER_LABEL_GAP = 4;

export interface MarkerLabelBox { row: number; left: number; width: number }

/** Places marker labels centred on their x, moving a label to the next row when it would overlap. */
export function layoutMarkerLabels(items: { id: string; x: number; text: string }[], minX: number): Map<string, MarkerLabelBox> {
  const rowEnds: number[] = [];
  const boxes = new Map<string, MarkerLabelBox>();
  for (const item of [...items].sort((a, b) => a.x - b.x)) {
    const width = item.text.length * MARKER_CHAR_WIDTH + MARKER_LABEL_PADDING;
    const left = Math.max(minX, item.x - width / 2);
    let row = rowEnds.findIndex(end => end + MARKER_LABEL_GAP <= left);
    if (row < 0) row = rowEnds.push(0) - 1;
    rowEnds[row] = left + width;
    boxes.set(item.id, { row, left, width });
  }
  return boxes;
}
