/* SPDX-License-Identifier: GPL-3.0-or-later
 * Independent implementation of packet facts recovered from ASUS Companion CIL.
 * Experimental interoperability format; no claim of Harpe firmware support.
 */
(function(root){
'use strict';
const keys={};
function key(code,label,hid,vk){keys[code]={code,label,hid,vk}}
for(let i=0;i<26;i++)key('Key'+String.fromCharCode(65+i),String.fromCharCode(65+i),4+i,65+i);
for(let i=1;i<=9;i++)key('Digit'+i,String(i),29+i,48+i);key('Digit0','0',39,48);
[['Enter','Enter',40,13],['Escape','Esc',41,27],['Backspace','Rücktaste',42,8],['Tab','Tab',43,9],['Space','Leertaste',44,32],['ControlLeft','Strg links',224,162],['ShiftLeft','Umschalt links',225,160],['AltLeft','Alt links',226,164],['MetaLeft','Windows links',227,91],['ControlRight','Strg rechts',228,163],['ShiftRight','Umschalt rechts',229,161],['AltRight','Alt rechts',230,165],['ArrowRight','Pfeil rechts',79,39],['ArrowLeft','Pfeil links',80,37],['ArrowDown','Pfeil abwärts',81,40],['ArrowUp','Pfeil aufwärts',82,38],['Delete','Entf',76,46],['Home','Pos1',74,36],['End','Ende',77,35],['PageUp','Bild auf',75,33],['PageDown','Bild ab',78,34],['Insert','Einfg',73,45],['MouseLeft','Maus links',240,301],['MouseRight','Maus rechts',241,302],['MouseMiddle','Mausrad',242,303],['MouseBack','Maus zurück',228,304],['MouseForward','Maus vor',229,305]].forEach(x=>key(...x));
for(let i=1;i<=12;i++)key('F'+i,'F'+i,57+i,111+i);
const targets={back:{label:'Seitentaste zurück',source:0x01e4},forward:{label:'Seitentaste vor',source:0x01e5},middle:{label:'Mausradklick',source:0x01f2}};
const special=new Set([240,241,232,233,242,228,229]);
const int=(n,min,max,label)=>{if(!Number.isInteger(n)||n<min||n>max)throw Error(label+' muss zwischen '+min+' und '+max+' liegen.');return n};
function normalize(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Ungültiger Makroentwurf.');
 const name=String(raw.name??'My macro').trim();if(!name||name.length>100)throw Error('Makroname: 1–100 Zeichen.');
 const mode=raw.mode??'once';if(!['once','repeat','toggle','hold'].includes(mode))throw Error('Unbekannter Wiederholungsmodus.');
 const target=raw.target??'back';if(!Object.hasOwn(targets,target))throw Error('Unbekannte Zieltaste.');
 const repeat=int(raw.repeat??2,2,255,'Wiederholungen');
 if(!Array.isArray(raw.events)||raw.events.length>1000)throw Error('Maximal 1000 Schritte erlaubt.');
 const events=raw.events.map(e=>{if(!e||!['keydown','keyup','delay'].includes(e.type))throw Error('Unbekannter Schritttyp.');if(e.type==='delay')return {type:e.type,value:int(Number(e.value),0,65535,'Wartezeit')};if(!Object.hasOwn(keys,e.value))throw Error('Tastencode nicht unterstützt: '+e.value);return {type:e.type,value:e.value}});
 const gap=int(raw.gap??100,10,60000,'Pause zwischen Durchlaeufen');return {name,mode,target,repeat,gap,events};
}
function timeline(raw){const macro=normalize(raw);let time=0;const held=new Set(),events=[],issues=[];for(const [i,e] of macro.events.entries()){if(e.type==='delay'){time+=e.value;continue}if(e.type==='keydown'){if(held.has(e.value))issues.push('Schritt '+(i+1)+': '+keys[e.value].label+' ('+e.value+') ist bereits gedrückt.');held.add(e.value)}else{if(!held.has(e.value))issues.push('Schritt '+(i+1)+': '+keys[e.value].label+' ('+e.value+') wird losgelassen, wurde vorher nicht gedrückt. '+(held.size?'Noch gedrückt: '+[...held].map(code=>keys[code].label+' ('+code+')').join(', ')+'. Prüfe, ob beim Loslassen dieselbe Taste ausgewählt ist.':'Entferne diesen Loslassen-Schritt oder füge davor das passende Drücken ein.'));held.delete(e.value)}events.push({...e,time,step:i})}if(held.size)issues.push('Nicht losgelassene Tasten: '+[...held].join(', '));if(time>300000)issues.push('Maximal fünf Minuten pro Ablauf.');return {macro,events,duration:time,issues};}
function compile(raw){
 const t=timeline(raw);if(t.issues.length)throw Error(t.issues.join(' '));if(!t.events.length)throw Error('Das Makro enthält noch keine Tastenereignisse.');if(t.events.length>500)throw Error('Maximal 500 Tastenereignisse für den Hardwareentwurf.');if(t.events[0].time!==0)throw Error('Eine Startverzögerung ist im rekonstruierten Hardwareformat nicht belegt. Bitte den ersten Warte-Schritt entfernen.');
 const records=t.events.map((e,i)=>{const k=keys[e.value],delay=(t.events[i+1]?.time??t.duration)-e.time;int(delay,0,65535,'Abstand zwischen Ereignissen');return [k.hid,(special.has(k.hid)?0x10:0)+(e.type==='keydown'?1:2),delay&255,delay>>8]});
 records.push([255,0,0,0]);
 const mode={once:1,repeat:2,toggle:3,hold:4}[t.macro.mode];const modePacket=[0x51,0x24,mode,0,t.macro.mode==='repeat'?t.macro.repeat:0];
 const source=targets[t.macro.target].source,packets=[];
 for(let i=0;i<records.length;i+=14){const block=records.slice(i,i+14);const packet=new Uint8Array(64);packet.set([0x52,block.length|(i?0x80:0),source&255,source>>8]);block.forEach((record,j)=>packet.set(record,4+j*4));packets.push(Array.from(packet))}
 return {format:'harpe-experimental-transfer-plan',version:1,provenance:'ASUS MS Companion 2.0.0.23 / MsApi.dll / SetMacroMode + WriteMacroFlash + SaveToProfile',hardwareVerified:false,model:'P713',transportConstraint:'Native report 65 bytes including report ID; WebHID payload 64 bytes. Omni framing unverified.',source,macro:t.macro,duration:t.duration,eventCount:t.events.length,records,modePacket,packets,commitPacket:[0x50,3]};
}
function serialize(raw){return JSON.stringify({format:'harpe-control-macro',version:2,...normalize(raw)},null,2)}
function parse(text){if(text.length>200000)throw Error('Datei zu groß (maximal 200 KB).');let raw;try{raw=JSON.parse(text)}catch{throw Error('Die Datei enthält kein gültiges JSON.')}if(raw.format!=='harpe-control-macro'||![1,2].includes(raw.version))throw Error('Unbekanntes Makroformat oder Version.');return normalize(raw)}
function gmac(raw){const t=timeline(raw);if(t.issues.length)throw Error(t.issues.join(' '));if(!t.events.length)throw Error('Das Makro ist leer.');const lines=[];let last=0;for(const e of t.events){const k=keys[e.value],vk=e.value==='KeyY'?90:e.value==='KeyZ'?89:k.vk,label=e.value==='KeyY'?'Z':e.value==='KeyZ'?'Y':k.label;lines.push('Delay,'+(e.time-last),(e.type==='keydown'?'Press':'Release')+','+label+',0,'+vk);last=e.time}if(t.duration>last)lines.push('Delay,'+(t.duration-last));lines.push(String({once:1,toggle:0,hold:-1,repeat:t.macro.repeat}[t.macro.mode]));return lines.join('\r\n')+'\r\n'}
const api={keys,targets,normalize,timeline,compile,serialize,parse,gmac};if(typeof module!=='undefined')module.exports=api;else root.HarpeMacros=api;
})(globalThis);
