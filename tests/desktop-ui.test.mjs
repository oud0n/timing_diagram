import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { INITIAL_DIAGRAM } from '../src/utils.ts';

test('native file actions preserve changes on errors/cancel and save the written snapshot', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  for(const key of ['window','document','HTMLElement','SVGElement','XMLSerializer','Event','KeyboardEvent']) globalThis[key]=dom.window[key];
  globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window); globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
  const {createRoot}=await import('react-dom/client'); const {default:App}=await import('../src/App.tsx');
  let action, closeRequest, closeCount=0, saveResult='/tmp/chart.json', openResult=null, deferredSave=null;
  const writes=[];
  const gateway={native:true,open:async()=>openResult,save:async(content,path,kind)=>{
    writes.push({content,path,kind}); if(deferredSave)return new Promise(resolve=>{deferredSave=resolve;});
    if(saveResult instanceof Error)throw saveResult;return saveResult;
  },close:async()=>{closeCount++;},quit:async()=>{closeCount++;},title:async()=>{},subscribe:async(a,c)=>{action=a;closeRequest=c;return()=>{};}};
  const root=createRoot(document.getElementById('root'));
  const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
  const click=async name=>{assert.ok(button(name),name);await act(async()=>button(name).click());};
  const fill=async(input,value)=>{await act(async()=>{input.focus();Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
  const label=()=>document.querySelector('input[placeholder="Signal Label"]');
  const dirty=()=>document.querySelector('header').textContent.includes('Unsaved changes');
  try {
    await act(async()=>root.render(createElement(App,{gateway})));
    const nativeSaveKey = new dom.window.KeyboardEvent('keydown', {key:'s',metaKey:true,bubbles:true,cancelable:true});
    await act(async()=>document.body.dispatchEvent(nativeSaveKey));
    assert.equal(nativeSaveKey.defaultPrevented,false,'native Save accelerator must not be swallowed');
    assert.equal(writes.length,0,'native menu owns the Save action');
    await fill(label(),'DIRTY');await act(async()=>label().blur());
    await click('New');assert.ok(document.querySelector('[aria-label="Unsaved changes"]'));
    await click('Cancel action');assert.equal(label().value,'DIRTY');
    saveResult=null;await click('New');await click('Save changes');assert.equal(label().value,'DIRTY');assert.equal(dirty(),true);
    saveResult=new Error('disk full');await click('Save');assert.ok(document.body.textContent.includes('disk full'));assert.equal(dirty(),true);
    saveResult='/tmp/chart.json';await click('Save');assert.equal(dirty(),false);assert.equal(writes.at(-1).path,null);
    await fill(label(),'NEXT');await act(async()=>label().blur());await click('Save');assert.equal(writes.at(-1).path,'/tmp/chart.json');assert.equal(dirty(),false);
    await fill(label(),'SNAPSHOT');await act(async()=>label().blur());deferredSave=true;
    await click('Save');await fill(label(),'LATER');await act(async()=>label().blur());
    await act(async()=>{deferredSave('/tmp/chart.json');});deferredSave=null;
    assert.equal(label().value,'LATER');assert.equal(dirty(),true);assert.equal(JSON.parse(writes.at(-1).content).signals[0].name,'SNAPSHOT');
    await act(async()=>closeRequest());await click('Cancel action');assert.equal(closeCount,0);
    await act(async()=>closeRequest());await click('Discard changes');assert.equal(closeCount,1);
    await click('Save');assert.equal(dirty(),false);
    openResult={path:'/tmp/bad.json',content:'{"config":{}}'};await click('Open');assert.equal(label().value,'LATER');assert.ok(document.querySelector('header').textContent.includes('chart.json'));
    openResult=null;await click('Open');assert.equal(label().value,'LATER');
    openResult={path:'/tmp/loaded.json',content:JSON.stringify(INITIAL_DIAGRAM)};await click('Open');assert.equal(label().value,'CLK');assert.equal(button('Undo').disabled,true);
    await fill(label(),'EXPORT');await act(async()=>label().blur());await click('Export SVG');assert.equal(writes.at(-1).kind,'svg');assert.equal(dirty(),true);
    await act(async()=>action('new'));await click('Discard changes');assert.equal(label().value,'CLK');assert.ok(document.querySelector('header').textContent.includes('Untitled'));
    await fill(label(),'UNDO');await act(async()=>label().blur());await act(async()=>action('undo'));assert.equal(label().value,'CLK');
  } finally {await act(async()=>root.unmount());dom.window.close();}
});

test('pointer gestures, bus double-click and selected cell keys use one editing history', async () => {
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/'});
  for(const key of ['window','document','HTMLElement','SVGElement','XMLSerializer','Event','KeyboardEvent']) globalThis[key]=dom.window[key];
  globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
  const {createRoot}=await import('react-dom/client');const {default:App}=await import('../src/App.tsx');
  const fixture=structuredClone(INITIAL_DIAGRAM);fixture.repeatRanges=[];fixture.signals[2].waveStr='='.repeat(14);fixture.signals[2].busValues={1:'OLD'};
  const gateway={native:false,open:async()=>({path:'fixture.json',content:JSON.stringify(fixture)}),save:async()=>null,title:async()=>{},subscribe:async()=>()=>{},close:async()=>{},quit:async()=>{}};
  const root=createRoot(document.getElementById('root'));
  const button=name=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===name);
  const click=async name=>{await act(async()=>button(name).click());};
  const pointer=async(type,id,cycle,y)=>{await act(async()=>{
    const svg=document.querySelector('svg[data-waveform]');svg.getBoundingClientRect=()=>({left:0,top:0,width:Number(svg.getAttribute('width')),height:Number(svg.getAttribute('height'))});
    const event=new dom.window.MouseEvent(type,{bubbles:true,button:0,clientX:145+65*cycle+32,clientY:y});Object.defineProperty(event,'pointerId',{value:1});
    document.querySelector(`[data-signal-hit="${id}"]`).dispatchEvent(event);
  });};
  const waves=()=>[...document.querySelectorAll('input[placeholder^="Waveform notation"]')];
  try {
    await act(async()=>root.render(createElement(App,{gateway})));await click('Open');
    const before=waves()[0].value;
    await pointer('pointerdown','spi_cs',1,130);await pointer('pointermove','spi_cs',4,130);await pointer('pointermove','spi_cs',2,130);await pointer('pointerup','spi_cs',2,130);
    assert.equal(waves()[0].value.slice(1,5),'0000');assert.equal(waves()[0].value[0],'1');
    await click('Undo');assert.equal(waves()[0].value,before);await click('Redo');assert.equal(waves()[0].value.slice(1,5),'0000');
    await act(async()=>document.body.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'1',bubbles:true})));assert.equal(waves()[0].value[1],'1');
    await pointer('pointerdown','spi_mosi',1,195);await pointer('pointerup','spi_mosi',1,195);
    await pointer('pointerdown','spi_mosi',1,195);await pointer('pointerup','spi_mosi',1,195);
    await act(async()=>document.querySelector('[data-signal-hit="spi_mosi"]').dispatchEvent(new dom.window.MouseEvent('dblclick',{bubbles:true,clientX:242,clientY:195})));
    const input=document.querySelector('input[aria-label="Bus label"]');assert.ok(input);assert.equal(input.value,'OLD');
    await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,'NEW');input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));input.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});
    assert.equal(document.querySelector('input[aria-label="Bus label"]'),null);
    assert.equal(waves()[1].value[1],'=');await click('Undo');
    await pointer('pointerdown','sys_clk',1,65);await pointer('pointerup','sys_clk',1,65);await click('Convert clock to Binary');assert.equal(waves()[0].value,'10101010101010');
    await click('+100 cycles');
    assert.ok(document.body.textContent.includes('114 cycles'));
    await click('Undo');assert.ok(document.body.textContent.includes('14 cycles'));
    const longWave='01'.repeat(750);
    await act(async()=>{
      const input=waves()[1]; input.focus();
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,longWave);
      input.dispatchEvent(new dom.window.Event('input',{bubbles:true})); input.blur();
    });
    assert.equal(waves()[1].value,longWave);
    assert.ok(document.body.textContent.includes('1500 cycles'));
    await click('Undo');assert.ok(document.body.textContent.includes('14 cycles'));
    await click('Redo');assert.equal(waves()[1].value,longWave);
  } finally {await act(async()=>root.unmount());dom.window.close();}
});
