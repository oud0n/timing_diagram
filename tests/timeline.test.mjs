import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_TIMELINE_CYCLES, timelineLength, formatTime, layoutMarkerLabels } from '../src/timeline.ts';
import { parseDiagram, serializeDiagram } from '../src/document.ts';
import { INITIAL_DIAGRAM } from '../src/utils.ts';
import { WaveformCanvas } from '../src/components/WaveformCanvas.tsx';

test('long diagrams round-trip, preserve the last cell and enforce the layout resource limit',()=>{
  const d=structuredClone(INITIAL_DIAGRAM);
  d.config.numCycles=MAX_TIMELINE_CYCLES;
  d.signals[1].waveStr='0'.repeat(MAX_TIMELINE_CYCLES-1)+'1';
  d.repeatRanges=[]; d.folds=[];
  const loaded=parseDiagram(serializeDiagram(d));
  assert.equal(loaded.signals[1].waveStr.at(-1),'1');
  assert.equal(timelineLength(14,[1500,20]),1500);
  assert.equal(timelineLength(1500,[20]),1500);
  d.config.numCycles++; assert.throws(()=>serializeDiagram(d));
});

test('100k alternating cycles render the whole waveform with bounded SVG element count',()=>{
  const config={...INITIAL_DIAGRAM.config,numCycles:MAX_TIMELINE_CYCLES,gridSubdivisions:4};
  const signal={...INITIAL_DIAGRAM.signals[1],waveStr:'01'.repeat(MAX_TIMELINE_CYCLES/2)};
  const svg=renderToStaticMarkup(createElement(WaveformCanvas,{config,signals:[signal],markers:[],constraints:[]}));
  assert.ok(svg.includes(`L ${145+MAX_TIMELINE_CYCLES*config.cycleWidth} `),'last cell is included in export');
  assert.ok((svg.match(/<line\b/g)||[]).length<5000,'grid/ticks do not create a node per cycle');
  assert.ok((svg.match(/<path\b/g)||[]).length<20,'transitions are batched into SVG paths');
});

test('time labels use the configured unit and avoid float noise',()=>{
  assert.equal(formatTime(2,{timeScale:10,timeUnitLabel:'ns'}),'20 ns');
  assert.equal(formatTime(3,{timeScale:0.1,timeUnitLabel:'us'}),'0.3 us');
  assert.equal(formatTime(1.5,{timeScale:2.5,timeUnitLabel:'ns'}),'3.75 ns');
});

test('overlapping marker labels move to separate rows; distant ones share a row',()=>{
  const boxes=layoutMarkerLabels([{id:'a',x:275,text:'CE Assert (20 ns)'},{id:'b',x:340,text:'First Bit Active (30 ns)'},{id:'c',x:900,text:'End (100 ns)'}],147);
  assert.equal(boxes.get('a').row,0);
  assert.equal(boxes.get('b').row,1);
  assert.equal(boxes.get('c').row,0);
  const near=layoutMarkerLabels([{id:'x',x:150,text:'Start (0 ns)'}],147);
  assert.ok(near.get('x').left>=147,'label is not hidden under the signal name column');
});

test('default diagram renders marker labels with the configured unit, without overlap',()=>{
  const svg=renderToStaticMarkup(createElement(WaveformCanvas,{...INITIAL_DIAGRAM}));
  assert.ok(svg.includes('CE Assert (20 ns)'));
  assert.ok(!/\(\d+s\)/.test(svg),'no hard-coded seconds suffix');
});
