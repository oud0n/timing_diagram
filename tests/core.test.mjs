import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DIAGRAM, findRepeatingPatterns, verifyRepeatPattern } from '../src/utils.ts';
import { parseDiagram, serializeDiagram } from '../src/document.ts';
import { createHistory, editHistory, undoHistory, redoHistory, beginTransaction, endTransaction, isDirty, markSaved } from '../src/history.ts';
const copy = () => structuredClone(INITIAL_DIAGRAM);
const change = (h, label) => editHistory(h, d => ({ ...d, config: { ...d.config, timeUnitLabel: label } }));

test('versioned and unversioned current JSON round-trip, optional lists normalized', () => {
  const d = copy();
  assert.deepEqual(parseDiagram(serializeDiagram(d)), d);
  delete d.folds; delete d.repeatRanges;
  assert.deepEqual(parseDiagram(JSON.stringify(d)).folds, []);
  assert.equal(JSON.parse(serializeDiagram(d)).formatVersion, 1);
});

test('invalid/legacy JSON is rejected before changing the document', () => {
  const variants = [null, [], { data: [] }, { ...copy(), formatVersion: 2 }, { ...copy(), markers: undefined }];
  const alter = fn => { const d = copy(); fn(d); variants.push(d); };
  alter(d => d.config.cycleWidth = -1);
  alter(d => d.config.numCycles = 1.5);
  alter(d => d.signals.push({ ...d.signals[0] }));
  alter(d => d.constraints[0].fromSignalId = 'missing');
  alter(d => d.signals[0].clockConfig.period = 0);
  alter(d => d.signals[0].busValues = { '-1': 'bad' });
  alter(d => d.signals[0].waveStr = 'invalid');
  alter(d => d.markers[0].time = 999);
  alter(d => d.folds = [{ id: 'f', startCycle: 8, endCycle: 2 }]);
  alter(d => d.repeatRanges[0].count = 'oops');
  for (const v of variants) assert.throws(() => parseDiagram(JSON.stringify(v)));
  assert.throws(() => parseDiagram('{'));
  const h = createHistory(copy());
  assert.throws(() => parseDiagram('{"config":{}}'));
  assert.deepEqual(h.present, copy());
});

test('all document categories undo and redo; no-op and redo invalidation', () => {
  let h = createHistory(copy());
  const original = h.present;
  const edits = [
    d => ({ ...d, config: { ...d.config, timeScale: 20 } }),
    d => ({ ...d, signals: d.signals.map(s => ({ ...s, name: s.name + '!' })) }),
    d => ({ ...d, markers: [] }), d => ({ ...d, constraints: [] }),
    d => ({ ...d, repeatRanges: [] }), d => ({ ...d, folds: [{ id: 'f', startCycle: 1, endCycle: 3 }] }),
  ];
  for (const edit of edits) h = editHistory(h, edit);
  const last = h.present;
  for (const _ of edits) h = undoHistory(h);
  assert.deepEqual(h.present, original); assert.equal(isDirty(h), false);
  for (const _ of edits) h = redoHistory(h);
  assert.deepEqual(h.present, last); assert.equal(isDirty(h), true);
  assert.strictEqual(editHistory(h, d => d), h);
  h = undoHistory(h); h = change(h, 'us');
  assert.equal(h.future.length, 0);
});

test('transaction groups a whole label edit/drag; saved identity survives branching', () => {
  let h = beginTransaction(createHistory(copy()));
  h = change(h, 'a'); h = change(h, 'ab'); h = change(h, 'abc');
  assert.equal(h.past.length, 0);
  h = endTransaction(h); assert.equal(h.past.length, 1);
  h = markSaved(h); assert.equal(isDirty(h), false);
  h = undoHistory(h); assert.equal(isDirty(h), true);
  h = redoHistory(h); assert.equal(isDirty(h), false);
  h = undoHistory(h); h = change(h, 'abc'); assert.equal(isDirty(h), false);
  h = beginTransaction(h); h = change(h, 'def'); h = undoHistory(h);
  assert.equal(h.present.config.timeUnitLabel, 'abc');
});

test('signal deletion removes its constraints; cycle reduction clamps ranges and can undo', () => {
  let h = createHistory(copy());
  h = editHistory(h, d => ({ ...d, signals: d.signals.filter(s => s.id !== 'spi_cs') }));
  assert.equal(h.present.constraints.length, 0);
  h = undoHistory(h); assert.equal(h.present.constraints.length, 1);
  h = editHistory(h, d => ({ ...d, config: { ...d.config, numCycles: 4 } }));
  assert.equal(h.present.repeatRanges[0].endCycle, 4);
  assert.equal(h.present.markers[1].time, 3);
  assert.ok(h.present.signals.every(s => s.waveStr.length <= 4));
  assert.doesNotThrow(() => serializeDiagram(h.present));
  h = undoHistory(h); assert.deepEqual(h.present, copy());
});

test('repeat detection starts at two comparisons but requires three complete repetitions', () => {
  const signal = { ...copy().signals[1], waveStr: '101010', busValues: {} };
  assert.ok(findRepeatingPatterns([signal], 6).some(r => r.period === 2 && r.repeatCount === 3));
  assert.deepEqual(findRepeatingPatterns([{ ...signal, waveStr: '101011' }], 6), []);
  assert.deepEqual(findRepeatingPatterns([{ ...signal, waveStr: '10' }], 2), []);
  assert.deepEqual(findRepeatingPatterns([], 6), []);
  assert.deepEqual(findRepeatingPatterns([signal], 6, [{ id: 'f', startCycle: 2, endCycle: 4 }]), []);
  assert.deepEqual(findRepeatingPatterns([signal], 6, [], [{ id: 'r', startCycle: 0, endCycle: 6, count: 3 }]), []);
  assert.equal(verifyRepeatPattern([signal], 0, 2, 2, 6).valid, false);
});

test('repeat verification includes bus labels and clock phase', () => {
  const bus = { ...copy().signals[2], waveStr: '======', busValues: { 0:'A',1:'B',2:'A',3:'B',4:'A',5:'C' } };
  assert.equal(verifyRepeatPattern([bus], 0, 2, 3, 6).valid, false);
  const clock = copy().signals[0];
  assert.equal(verifyRepeatPattern([clock], 0, 1, 3, 6).valid, false);
  assert.equal(verifyRepeatPattern([clock], 0, 2, 3, 6).valid, true);
  assert.equal(verifyRepeatPattern([clock], -1, 2, 3, 6).valid, false);
});

test('saving an earlier snapshot does not mark later edits as saved', () => {
  let h = createHistory(copy());
  h = change(h, 'us');
  const written = h.present;
  h = change(h, 'ms');
  h = markSaved(h, written);
  assert.equal(isDirty(h), true);
  h = undoHistory(h);
  assert.equal(isDirty(h), false);
});
