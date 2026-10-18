import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { INITIAL_DIAGRAM } from '../src/utils.ts';

test('editor groups input history, retains invalid imports, confirms replacement and handles clipboard failures', async () => {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url:'http://localhost/' });
  for (const key of ['window','document','HTMLElement','SVGElement','XMLSerializer','Event','KeyboardEvent']) globalThis[key] = dom.window[key];
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let clipboard = '';
  let rejectClipboard = false;
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: dom.window.navigator.userAgent, clipboard: { writeText: async text => {
    if (rejectClipboard) throw new Error('denied');
    clipboard = text;
  } } }, configurable:true });
  const { createRoot } = await import('react-dom/client');
  const { default: App } = await import('../src/App.tsx');
  const root = createRoot(document.getElementById('root'));
  const button = label => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label);
  const click = async label => { const b = button(label); assert.ok(b, label); await act(async () => { b.click(); }); };
  const fill = async (input, value) => {
    await act(async () => {
      input.focus();
      const prototype = input.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
      input.dispatchEvent(new dom.window.Event('input', { bubbles:true }));
    });
  };
  try {
    await act(async () => root.render(createElement(App)));
    const label = document.querySelectorAll('input[placeholder="Signal Label"]')[1];
    await fill(label, 'TEST'); await fill(label, 'TEST_LABEL');
    await act(async () => label.blur());
    assert.ok(document.querySelector('header').textContent.includes('Unsaved changes'));
    await click('Undo'); assert.equal(label.value, 'CE(Chip Select)');
    assert.ok(document.querySelector('header').textContent.includes('Unchanged'));
    await click('Redo'); assert.equal(label.value, 'TEST_LABEL');
    await click('Undo');
    await click('Copy JSON'); assert.equal(JSON.parse(clipboard).formatVersion, 1);
    await click('Load JSON');
    await fill(document.querySelector('textarea'), '{"config":{},"signals":[]}');
    await click('Import');
    assert.ok(document.querySelector('[role="alert"]').textContent.includes('Invalid JSON'));
    assert.equal(label.value, 'CE(Chip Select)');
    await fill(document.querySelector('textarea'), JSON.stringify(INITIAL_DIAGRAM));
    await click('Import');
    assert.equal(document.querySelector('textarea'), null);
    assert.equal(button('Undo').disabled, true);
    await fill(document.querySelectorAll('input[placeholder="Signal Label"]')[1], 'UNSAVED');
    await act(async () => document.querySelectorAll('input[placeholder="Signal Label"]')[1].blur());
    await click('Load JSON');
    await fill(document.querySelector('textarea'), JSON.stringify(INITIAL_DIAGRAM));
    await click('Import');
    assert.ok(button('Discard and import'));
    await click('Keep editing');
    assert.equal(document.querySelectorAll('input[placeholder="Signal Label"]')[1].value, 'UNSAVED');
    await click('Import'); await click('Discard and import');
    assert.equal(document.querySelectorAll('input[placeholder="Signal Label"]')[1].value, 'CE(Chip Select)');
    assert.equal(button('Undo').disabled, true);
    await click('Copy SVG');
    assert.ok(clipboard.startsWith('<?xml'));
    assert.ok(clipboard.includes('repeat 4'));
    assert.ok(clipboard.includes('CE(Chip Select)'));
    rejectClipboard = true;
    await click('Copy SVG');
    assert.ok(document.body.textContent.includes('SVG copy failed'));
    await click('Copy JSON');
    assert.ok(document.body.textContent.includes('JSON copy failed'));
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
