// SPDX-License-Identifier: GPL-3.0-or-later
const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('./protocol.js');
test('DPI payload excludes report ID; 800 DPI maps to 15, stage four to index three',()=>{
 assert.deepEqual(P.setDpi(4,800,'#12abff'),[0x51,0x31,3,0,15,0,0x12,0xab,0xff]);
 assert.deepEqual(P.setDpi(1,36000,'#000000'),[0x51,0x31,0,0,0xcf,2,0,0,0]);
});
test('invalid DPI never produces a write command',()=>{
 for(const dpi of [0,49,51,36050,NaN,Infinity,800.5])assert.throws(()=>P.setDpi(1,dpi,'#ff0000'));
 for(const stage of [0,5,1.5])assert.throws(()=>P.setDpi(stage,800,'#ff0000'));
 assert.throws(()=>P.setDpi(1,800,'red'));
});

test('single DPI plan validates every slot before returning writes and preserves per-slot colors',()=>{
 const settings={dpi:Array.from({length:4},()=>({x:800,y:800})),colors:['#ff0000','#00ff00','#0000ff','#123456']};
 const plan=P.singleDpiPlan(settings,1600);assert.equal(plan.length,4);plan.forEach((p,i)=>assert.deepEqual(p,P.setDpi(i+1,1600,settings.colors[i])));
 assert.throws(()=>P.singleDpiPlan({...settings,dpi:[{x:800,y:1600},...settings.dpi.slice(1)]},1600),/X\/Y/);
 assert.throws(()=>P.singleDpiPlan({...settings,colors:settings.colors.slice(1)},1600),/four/);
 assert.throws(()=>P.singleDpiPlan({...settings,colors:[...settings.colors.slice(0,3),'invalid']},1600));
 assert.throws(()=>P.singleDpiPlan(settings,1601));
});

test('wheel lighting uses read index zero and physical wheel zone one with strict bounds',()=>{
 assert.deepEqual(P.readLighting(),[18,3,0]);assert.deepEqual(P.setLighting({mode:0,brightness:75,color:'#12abff'}),[81,40,1,0,0,75,18,171,255,0,0,0]);
 assert.deepEqual(P.parseLighting(Uint8Array.from([18,3,0,0,0,75,18,171,255,0,0,0])),{mode:0,brightness:75,color:'#12abff',random:false});
 for(const mode of [3,5,7,255])assert.throws(()=>P.setLighting({mode,brightness:50,color:'#000000'}));
 for(const brightness of [-1,101,1.5,NaN])assert.throws(()=>P.setLighting({mode:0,brightness,color:'#000000'}));
 assert.throws(()=>P.parseLighting([18,3,0,0,3,50,0,0,0,0]));assert.throws(()=>P.setLighting({mode:0,brightness:50,color:'red'}));
});
test('readback preserves separate X/Y values and stage offsets',()=>{
 const data=new Uint8Array(64);data.set([0x12,4,2,0]);
 const values=[[800,1600],[50,50],[36000,36000],[3200,6400]];
 values.forEach((v,i)=>v.forEach((dpi,j)=>{const n=dpi/50-1,k=4+i*4+j*2;data[k]=n&255;data[k+1]=n>>8}));
 assert.deepEqual(P.parseDpi(data),values.map(([x,y])=>({x,y})));
 assert.throws(()=>P.parseDpi(data.slice(0,19)));
 data[2]=0;assert.throws(()=>P.parseDpi(data));
});
test('colors use payload offset four with exactly three bytes per stage',()=>{
 assert.deepEqual(P.parseColors(Uint8Array.from([0x12,4,3,0,255,0,0,0,255,0,0,0,255,18,52,86])),['#ff0000','#00ff00','#0000ff','#123456']);
 assert.throws(()=>P.parseColors(new Uint8Array(64)));
});
test('only supported polling rates are emitted and decoded',()=>{
 [125,250,500,1000].forEach((hz,i)=>{assert.deepEqual(P.setPolling(hz),[0x51,0x31,4,0,i]);const b=new Uint8Array(64);b.set([0x12,4,0]);b[12]=i;assert.equal(P.parsePolling(b),hz)});
 assert.throws(()=>P.setPolling(8000));const b=new Uint8Array(64);b.set([0x12,4,0]);b[12]=255;assert.throws(()=>P.parsePolling(b));
 assert.deepEqual(P.save(),[0x50,3]);
});
test('device info matches observed real 8.00.10 reply and retains raw bytes',()=>{const b=[0x12,0,0,0,0x10,0,8,0,5,7,0,2,255,255,0,0,0,0,0];assert.deepEqual(P.readInfo(),[0x12,0,0,0]);assert.equal(P.parseInfo(b).firmware,'8.00.10');assert.equal(P.parseInfo(b).profiles,5);assert.deepEqual(P.parseInfo(b).raw,b);assert.throws(()=>P.parseInfo([0xff,0xaa]))});
