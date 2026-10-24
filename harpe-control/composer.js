/* SPDX-License-Identifier: GPL-3.0-or-later */
(function(root){
'use strict';
const M=typeof module!=='undefined'?require('./macros.js'):root.HarpeMacros;
const integer=(value,min,max,label)=>{const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw Error(label+' muss zwischen '+min+' und '+max+' liegen.');return n};
const modifiers=new Set(['ControlLeft','ShiftLeft','AltLeft','MetaLeft','ControlRight','ShiftRight','AltRight']);
function press(key,hold=80,withKeys=[]){
 if(!M.keys[key]||key.startsWith('Mouse'))throw Error('Bitte eine unterstützte Tastaturtaste wählen.');
 const ms=integer(hold,10,60000,'Haltedauer');
 if(!Array.isArray(withKeys)||withKeys.some(k=>!modifiers.has(k))||new Set([...withKeys,key]).size!==withKeys.length+1)throw Error('Eine Taste darf nicht gleichzeitig doppelt gedrückt werden.');
 const codes=[...withKeys,key];return [...codes.map(value=>({type:'keydown',value})),{type:'delay',value:ms},...codes.slice().reverse().map(value=>({type:'keyup',value}))];
}
function pause(ms){return [{type:'delay',value:integer(ms,0,60000,'Pause')}]}
function text(value){
 const chars=Array.from(String(value));if(!chars.length)throw Error('Bitte zuerst Text eingeben.');
 if(chars.length>64)throw Error('Maximal 64 Zeichen; der gesamte Ablauf darf 128 Tastenereignisse enthalten.');
 return chars.flatMap((c,i)=>{let key,shift=false;
  if(/[a-z]/i.test(c)){const letter=c.toUpperCase();key='Key'+(letter==='Y'?'Z':letter==='Z'?'Y':letter);shift=c===letter;}
  else if(/[0-9]/.test(c))key='Digit'+c;
  else if(c===' ')key='Space';else if(c==='\n')key='Enter';
  else throw Error('Das Zeichen „'+c+'“ wird im Textbaustein noch nicht unterstützt. Nutze dafür die Tastaturaufnahme.');
  return [...press(key,40,shift?['ShiftLeft']:[]),...(i<chars.length-1?pause(20):[])];
 });
}
function append(raw,events){
 const macro=M.normalize({...raw,events:[...raw.events,...events]});const timeline=M.timeline(macro);
 if(timeline.events.length>128)throw Error('Maximal 128 Tastenereignisse pro Makro. Bitte den Ablauf kürzen.');
 if(timeline.duration>60000)throw Error('Maximal 60 Sekunden pro Durchlauf.');
 return macro;
}
function groups(events){
 const result=[];
 for(let start=0;start<events.length;){
  const keys=[];let at=start;
  while(events[at]?.type==='keydown'&&!keys.includes(events[at].value)){keys.push(events[at].value);at++}
  const delayIndex=at;let complete=keys.length>0&&events[at]?.type==='delay';at++;
  if(complete){for(const key of keys.slice().reverse()){if(events[at]?.type!=='keyup'||events[at].value!==key){complete=false;break}at++}}
  if(complete){result.push({type:'press',keys,start,length:at-start,delayIndex,hold:events[delayIndex].value});start=at;}
  else{const event=events[start];result.push({type:event.type,start,length:1,value:event.value});start++;}
 }
 return result;
}
function editGroup(raw,index,operation){
 const macro=M.normalize(raw),items=groups(macro.events),item=items[index];if(!item)throw Error('Aktion nicht gefunden.');
 if(operation==='remove')macro.events.splice(item.start,item.length);
 else{const other=items[index+(operation==='up'?-1:1)];if(!other||!['up','down'].includes(operation))return macro;const first=item.start<other.start?item:other,last=first===item?other:item;const a=macro.events.slice(first.start,first.start+first.length),b=macro.events.slice(last.start,last.start+last.length);macro.events.splice(first.start,first.length+last.length,...b,...a);}
 return macro;
}
const api={press,pause,text,append,groups,editGroup};if(typeof module!=='undefined')module.exports=api;else root.HarpeComposer=api;
})(globalThis);
