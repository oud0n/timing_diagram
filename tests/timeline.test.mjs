import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_TIMELINE_CYCLES, timelineLength } from '../src/timeline.ts';
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
