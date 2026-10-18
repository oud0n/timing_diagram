import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DIAGRAM, busSegmentStarts, verifyRepeatPattern } from '../src/utils.ts';
import { paintWaveCells } from '../src/waveformEditing.ts';
import { WaveformCanvas } from '../src/components/WaveformCanvas.tsx';

const busDiagram = (waveStr, busValues, extra = {}) => {
  const d = structuredClone(INITIAL_DIAGRAM);
  d.config.numCycles = waveStr.length; d.repeatRanges = []; d.folds = []; d.markers = []; d.constraints = [];
  d.signals = [{ id: 'b', name: 'B', type: 'bus', color: '#000', strokeWidth: 2, height: 40, waveStr, busValues, busFormat: 'hex', busWidth: 8, ...extra }];
  return d;
};

test('every explicit = starts a new bus segment; . continues it', () => {
  assert.deepEqual(busSegmentStarts('z=.=.0=..', 9), [-1, 1, 1, 3, 3, -1, 6, 6, 6]);
});

test('adjacent bus segments render a boundary and labels span the whole segment', () => {
  const d = busDiagram('=.=.', { 0: 'AA', 2: 'BB' });
  const svg = renderToStaticMarkup(createElement(WaveformCanvas, d));
  const x = (c) => 145 + c * d.config.cycleWidth;
  assert.ok(svg.includes(`M ${x(2)} `) && svg.includes(`L ${x(2)} `), 'boundary line at cycle 2');
  assert.ok(svg.includes(`x="${(x(0) + x(2)) / 2}"`), 'label AA centred on cycles 0-2');
  assert.ok(svg.includes('>AA<') && svg.includes('>BB<'));
});

test('expanded bits keep the segment value across continuation cycles', () => {
  const d = busDiagram('=...', { 0: 'FF' }, { isExpanded: true, busWidth: 2 });
  const svg = renderToStaticMarkup(createElement(WaveformCanvas, d));
  // 0xFF held for 4 cycles: bus top+bottom lines and both bit rows run unbroken from cycle 0 to 4
  const end = 145 + 4 * d.config.cycleWidth;
  assert.equal((svg.match(new RegExp(`M 145 (\\d+(?:\\.\\d+)?) L ${end} \\1`, 'g')) || []).length, 4);
});

test('painting keeps bus segment boundaries and labels', () => {
  const d = busDiagram('=.=.=.', { 0: 'A', 2: 'B', 4: 'C' });
  const r1 = paintWaveCells(d, 'b', [5], 'z').signals[0];
  assert.equal(r1.waveStr, '=.=.=z');
  assert.deepEqual(r1.busValues, { 0: 'A', 2: 'B', 4: 'C' });
  const r2 = paintWaveCells(d, 'b', [1], 'x').signals[0];
  assert.equal(r2.waveStr, '=x=.=.');
  const r3 = paintWaveCells(busDiagram('zzzzzz', {}), 'b', [1, 2, 3], '=').signals[0];
  assert.equal(r3.waveStr, 'z=..zz', 'one drag makes one segment');
  assert.deepEqual(r3.busValues, { 1: 'DATA' });
  const r4 = paintWaveCells(busDiagram('=.....', { 0: 'A' }), 'b', [2], 'z').signals[0];
  assert.equal(r4.waveStr, '=.z=..', 'segment cut by a painted cell continues with its label');
  assert.deepEqual(r4.busValues, { 0: 'A', 3: 'A' });
});

test('repeat verification compares bus segment values, not raw per-cycle labels', () => {
  const same = busDiagram('=.=.=.', { 0: 'A', 2: 'A', 4: 'A' });
  assert.equal(verifyRepeatPattern(same.signals, 0, 2, 3, 6).valid, true);
  const diff = busDiagram('=.=.=.', { 0: 'A', 2: 'B', 4: 'A' });
  assert.equal(verifyRepeatPattern(diff.signals, 0, 2, 3, 6).valid, false);
  const merged = busDiagram('=.....', { 0: 'A' });
  assert.equal(verifyRepeatPattern(merged.signals, 0, 2, 3, 6).valid, false, 'one long segment is not three repeats');
});
