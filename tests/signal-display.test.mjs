import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_DIAGRAM } from '../src/utils.ts';
import { WaveformCanvas } from '../src/components/WaveformCanvas.tsx';

const base = () => { const d = structuredClone(INITIAL_DIAGRAM); d.repeatRanges = []; d.folds = []; d.markers = []; d.constraints = []; return d; };
const bus = (id, extra) => ({ id, name: id.toUpperCase(), type: 'bus', color: '#000', strokeWidth: 2, height: 40, waveStr: '=.......', busValues: { 0: 'S' }, busWidth: 8, isExpanded: true, ...extra });

test('only multi-bit numeric buses get a [n:0] suffix and bit rows', () => {
  const d = base();
  d.signals = [bus('text', { busFormat: 'string' }), bus('one', { busWidth: 1 }), bus('wide', { busFormat: 'hex', busWidth: 4 })];
  const svg = renderToStaticMarkup(createElement(WaveformCanvas, { ...d, onUpdateSignals: () => {} }));
  assert.ok(!svg.includes('TEXT[') && !svg.includes('ONE['), 'no suffix for string or 1-bit bus');
  assert.ok(svg.includes('WIDE<!-- -->[3:0]') || svg.includes('WIDE[3:0]'));
  assert.equal((svg.match(/bit \d/g) || []).length, 4, 'only the 4-bit hex bus expands');
});

test('constraints follow their signal rows below an expanded bus, with the label between rows', () => {
  const d = base();
  d.signals = [bus('b', { busWidth: 2, busFormat: 'hex' }), { ...structuredClone(INITIAL_DIAGRAM.signals[1]), id: 'cs' }, { ...structuredClone(INITIAL_DIAGRAM.signals[1]), id: 'cs2' }];
  d.constraints = [{ id: 'c', fromSignalId: 'cs', fromTime: 1, toSignalId: 'cs2', toTime: 2, label: 'tX', color: '#f00', style: 'solid', arrowType: 'to' }];
  const svg = renderToStaticMarkup(createElement(WaveformCanvas, d));
  const topMargin = 45, rowHeight = 65;
  // bus row + 2 bit rows, so "cs" is row 3 and "cs2" is row 4
  const yFrom = topMargin + 3 * rowHeight + 20, yTo = topMargin + 4 * rowHeight + 20;
  assert.ok(svg.includes(`M ${145 + 65} ${yFrom} Q`), 'arrow starts on the cs row');
  assert.ok(svg.includes(` ${145 + 130} ${yTo}"`), 'arrow ends on the cs2 row');
  const labelY = topMargin + 3 * rowHeight + 40 + 12.5; // centre of the gap below cs
  assert.ok(svg.includes(`y="${labelY - 8}" width="${2 * 5.8 + 12}"`), 'label box sits in the gap and fits the text');
});

test('switching a signal to Clock stores the clock settings it is drawn with', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
  for (const key of ['window', 'document', 'HTMLElement', 'Event']) globalThis[key] = dom.window[key];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import('react-dom/client');
  const { SignalEditor } = await import('../src/components/SignalEditor.tsx');
  let updated = null;
  const signal = { ...structuredClone(INITIAL_DIAGRAM.signals[1]), clockConfig: undefined };
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(createElement(SignalEditor, { signals: [signal], config: INITIAL_DIAGRAM.config, onUpdateSignals: s => { updated = s; } })));
  const select = document.querySelector('select');
  await act(async () => { select.value = 'clock'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
  assert.equal(updated[0].type, 'clock');
  assert.deepEqual(updated[0].clockConfig, { period: 2, dutyCycle: 50, phase: 0, inverted: false });
  await act(async () => root.unmount());
});
