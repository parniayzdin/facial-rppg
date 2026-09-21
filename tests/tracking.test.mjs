import test from 'node:test';
import assert from 'node:assert/strict';
import {lockFacePatch,displayEstimate} from '../wwwroot/pulse-tracking.mjs';
const face={originX:100,originY:100,width:200,height:240};
test('detector jitter does not change sampled face pixels',()=>{
    let box=face;
    for(const dx of [1,-2,3,-1,2]){const result=lockFacePatch(box,{...face,originX:100+dx});assert.equal(result.box,face);assert.equal(result.restarted,false);box=result.box;}
});
test('slow cumulative movement restarts rather than moving the patch onto the background',()=>{
    let box=face,result;
    for(let dx=1;dx<=10;dx++){result=lockFacePatch(box,{...face,originX:100+dx});box=result.box;}
    assert.equal(result.restarted,true);assert.equal(box.originX,110);
});
test('completion without a clear pulse shows the reason, not a frozen countdown',()=>{
    const display=displayEstimate({bpm:null,status:'No clear pulse yet',seconds:25,detail:'Colour changes too small.'});
    assert.equal(display.bpm,'—');assert.equal(display.status,'No clear pulse yet');assert.equal(display.detail,'Colour changes too small.');
});
test('a valid estimate is displayed and collecting remains a countdown',()=>{
    assert.equal(displayEstimate({bpm:72,status:'Experimental estimate',seconds:22}).bpm,'72');
    assert.equal(displayEstimate({bpm:null,status:'Collecting',seconds:19.8}).status,'Collecting · 19/20 seconds');
});
