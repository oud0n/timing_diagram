import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { serializeWaveformSvg } from '../src/svgExport.ts';

test('standalone SVG keeps labelled interactive groups, inlines styles and removes only controls', () => {
  const dom = new JSDOM(`<!doctype html><style>.label { fill: #ffffff; font-size: 11px; font-family: monospace; font-weight: 700; }</style>
    <svg width="800" height="365" class="chart">
      <defs><marker id="arrow"><path d="M0 0L3 3" /></marker></defs>
      <rect fill="#0f172a" width="800" height="365"/>
      <g class="cursor-pointer"><text class="label">repeat 4 • Byte Stream</text><g data-export-exclude="true"><text>✕</text></g></g>
      <g data-sticky-labels="true" transform="translate(100, 0)"><text class="label">CLK</text><text class="label">MOSI[7:0]</text></g>
      <rect data-export-exclude="true" fill="transparent"/>
      <path stroke="#2563eb" d="M145 100L200 100L200 120" style='fill:url("http://localhost/chart#arrow")'/>
    </svg>`);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.XMLSerializer = dom.window.XMLSerializer;
  const output = serializeWaveformSvg(dom.window.document.querySelector('svg'));
  const document = new dom.window.DOMParser().parseFromString(output, 'image/svg+xml');
  assert.equal(document.querySelector('parsererror'), null);
  assert.equal(document.documentElement.getAttribute('viewBox'), '0 0 800 365');
  assert.match(document.documentElement.textContent, /repeat 4 • Byte Stream/);
  assert.match(document.documentElement.textContent, /CLK/);
  assert.match(document.documentElement.textContent, /MOSI\[7:0\]/);
  assert.ok(!output.includes('✕'));
  assert.equal(document.querySelector('[class]'), null);
  assert.equal(document.querySelector('[data-export-exclude]'), null);
  assert.ok(output.includes('translate(0, 0)'));
  assert.equal(document.querySelector('text').style.fontSize, '11px');
  assert.equal(document.querySelector('text').style.fontWeight, '700');
  assert.match(document.querySelector('path[stroke]').style.fill, /url\(["']?#arrow["']?\)/);
  assert.ok(!output.includes('http://localhost/chart'));
  dom.window.close();
});
