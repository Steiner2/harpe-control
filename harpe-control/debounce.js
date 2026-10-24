/* SPDX-License-Identifier: GPL-3.0-or-later */
(function(root){'use strict';
const PRESETS=Object.freeze([12,16,20,24,28,32]);
function encode(ms){const index=PRESETS.indexOf(Number(ms));if(index<0)throw Error('Stock firmware accepts only 12, 16, 20, 24, 28 or 32 ms. Custom values need another firmware capability.');return index+2;}
function decode(bytes){if(bytes.length<15||bytes[0]!==0x12||bytes[1]!==4||bytes[2]!==0)throw Error('Invalid debounce reply.');const code=bytes[14];return {code,ms:code>=2&&code<=7?PRESETS[code-2]:null};}
function packet(ms){return [0x51,0x31,5,0,encode(ms)]}
function analyze(trials,button){
 if(![0,2].includes(button))throw Error('Choose the left or right button.');
 const valid=trials.filter(t=>t.button===button&&t.confirmed&&['single','double','hold'].includes(t.intent));let singles=0,doubles=0,holds=0,invalidTrials=0;const falseGaps=[],intendedGaps=[];
 for(const trial of valid){const events=trial.events;let previous=-Infinity,down=false,lastUp=null,presses=0,good=true,gaps=[];
  for(const e of events){if(!Number.isFinite(e.time)||e.time<previous||!['down','up'].includes(e.type)||(e.type==='down')===down){good=false;break}previous=e.time;if(e.type==='down'){if(lastUp!=null)gaps.push(e.time-lastUp);presses++;down=true}else{lastUp=e.time;down=false}}
  if(!good||down||!presses){invalidTrials++;continue;}
  if(trial.intent==='single'){singles++;if(presses>1)falseGaps.push(...gaps)}
  if(trial.intent==='hold'){holds++;if(presses>1)falseGaps.push(...gaps)}
  if(trial.intent==='double'){if(presses===2){doubles++;intendedGaps.push(...gaps)}else invalidTrials++;}
 }
 let proposedMs=null,reason=invalidTrials&&!singles&&!doubles&&!holds?'incomplete-trials':'no-fault-observed';
 if(falseGaps.length){if(singles+holds<20||falseGaps.length<3||doubles<5)reason='more-samples-needed';else{const proposal=Math.ceil(Math.max(...falseGaps))+2;const rapid=Math.min(...intendedGaps);if(proposal>50||proposal>=rapid/2)reason='overlap-or-outside-range';else{proposedMs=Math.max(1,proposal);reason='provisional-suggestion'}}}
 const nearestPreset=proposedMs==null?null:PRESETS.find(n=>n>=proposedMs)??null;
 return {button,singles,doubles,holds,invalidTrials,confirmedFalseTransitions:falseGaps.length,proposedMs,nearestPreset,reason,source:'browser-processed-events',rawSwitchMeasurement:false,hardwareFaultProven:false,applied:false};
}
// Offline reference model: stable-state filtering per button; no hardware I/O.
class StableFilter{
 constructor(ms){if(!Number.isInteger(ms)||ms<0||ms>50)throw Error('Custom draft range: 0–50 ms.');this.ms=ms;this.raw=false;this.output=false;this.changed=0;this.time=-Infinity;}
 tick(raw,time){if(!Number.isFinite(time)||time<this.time)throw Error('Monotonic timestamps required.');this.time=time;if(raw!==this.raw){this.raw=raw;this.changed=time}if(time-this.changed>=this.ms)this.output=this.raw;return this.output;}
}
const api={PRESETS,encode,decode,packet,analyze,StableFilter};if(typeof module!=='undefined')module.exports=api;else root.HarpeDebounce=api;
})(globalThis);
