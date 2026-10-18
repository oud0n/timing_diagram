import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DIAGRAM, parseWaveform } from '../src/utils.ts';
import { nextWaveState, paintWaveCells, clockToBinary, visiblePaintRange } from '../src/waveformEditing.ts';
import { createHistory, beginTransaction, editHistory, endTransaction, undoHistory } from '../src/history.ts';
test('painting resolves continuation values without changing later cells', () => {
  const d = structuredClone(INITIAL_DIAGRAM); d.signals[1].waveStr='01...0';
  const before = parseWaveform(d.signals[1].waveStr, 14);
  const result = paintWaveCells(d,'spi_cs',[2],'0');
  const after = parseWaveform(result.signals[1].waveStr,14);
  assert.equal(after[2],'0'); assert.equal(after[3], before[3]); assert.equal(after[4],before[4]);
  assert.equal(nextWaveState(d.signals[1],3,14),'0');
  const bus = {...d.signals[2],waveStr:'01=zx'};
  assert.deepEqual([0,1,2,3,4].map(i=>nextWaveState(bus,i,14)),['1','=','z','x','0']);
});
test('one gesture paints only visible cells and undoes in one step', () => {
  const d=structuredClone(INITIAL_DIAGRAM);
  const cells=visiblePaintRange(1,12,14,[{start:3,end:11}]);
  assert.deepEqual(cells,[1,2,11,12]);
  let h=beginTransaction(createHistory(d));
  h=editHistory(h,p=>paintWaveCells(p,'spi_cs',[1],'0'));
  h=editHistory(h,p=>paintWaveCells(p,'spi_cs',cells,'0'));
  h=endTransaction(h); assert.equal(h.past.length,1);
  assert.deepEqual(undoHistory(h).present,d);
});
test('clock conversion samples configured duty, phase and inversion; clocks are not painted', () => {
  const d=structuredClone(INITIAL_DIAGRAM); const clock=d.signals[0];
  assert.equal(clockToBinary(clock,6).waveStr,'101010');
  assert.equal(clockToBinary({...clock,clockConfig:{...clock.clockConfig,inverted:true}},6).waveStr,'010101');
  assert.equal(clockToBinary({...clock,clockConfig:{...clock.clockConfig,phase:1}},6).waveStr,'010101');
  assert.equal(clockToBinary({...clock,clockConfig:{...clock.clockConfig,dutyCycle:25}},6).waveStr,'000000');
  assert.equal(clockToBinary(clock,6).clockConfig,undefined);
  assert.deepEqual(paintWaveCells(d,clock.id,[0],'0'),d);
});
