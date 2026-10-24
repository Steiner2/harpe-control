/* SPDX-License-Identifier: GPL-3.0-or-later
 * Protocol adaptation from seerge/g-helper, app/Peripherals/Mouse/AsusMouse.cs
 * and Models/HarpeAceAimLab.cs. See research/GHelper-LICENSE and SOURCES.md.
 * All byte arrays here EXCLUDE the HID report ID, as required by WebHID.
 */
(function(root){
'use strict';
function integer(n,min,max){if(!Number.isInteger(n)||n<min||n>max)throw Error(`Wert muss zwischen ${min} und ${max} liegen.`);return n}
const P={
 readInfo:()=>[0x12,0,0,0],
 parseInfo(b){if(b.length<19||b[0]!==0x12||b[1]!==0||b[2]!==0)throw Error('Ungültige Geräteinfo.');return {firmware:[b[6],b[5],b[4]].map((n,i)=>n.toString(16).padStart(i?2:1,'0')).join('.'),profiles:b[8],currentProfile:b[10]+1,dpiLevels:b[18],raw:Array.from(b)}},
 readDpi:()=>[0x12,4,2],readColors:()=>[0x12,4,3],readPolling:()=>[0x12,4,0],save:()=>[0x50,3],
 readLighting:()=>[0x12,3,0],
 parseLighting(b){if(b.length<10||b[0]!==0x12||b[1]!==3||b[2]!==0||![0,1,2,4,6,240].includes(b[4])||b[5]>100)throw Error('Unknown wheel lighting response. Writing remains blocked.');return {mode:b[4],brightness:b[5],color:'#'+Array.from(b.slice(6,9),v=>v.toString(16).padStart(2,'0')).join(''),random:b[11]===1};},
 setLighting({mode,brightness,color,random=false}){if(![0,1,2,4,6,240].includes(mode))throw Error('Unsupported wheel lighting mode.');integer(brightness,0,100);if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Invalid LED color.');return [0x51,0x28,1,0,mode,brightness,...color.slice(1).match(/../g).map(x=>parseInt(x,16)),0,0,0]},
 setDpi(stage,dpi,color){integer(stage,1,4);integer(dpi,50,36000);if(dpi%50)throw Error('DPI muss ein Vielfaches von 50 sein.');if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Ungültige Farbe.');const n=dpi/50-1;return [0x51,0x31,stage-1,0,n&255,n>>8,...color.slice(1).match(/../g).map(x=>parseInt(x,16))]},
 setPolling(hz){const n=[125,250,500,1000].indexOf(hz);if(n<0)throw Error('Ungültige Pollingrate.');return [0x51,0x31,4,0,n]},
 singleDpiPlan(settings,dpi){
  if(!settings||settings.dpi?.length!==4||settings.colors?.length!==4)throw Error('Read all four DPI slots and their colors first.');
  if(settings.dpi.some(v=>v.x!==v.y))throw Error('Single DPI is blocked while any slot has different X/Y values.');
  return settings.colors.map((color,i)=>P.setDpi(i+1,dpi,color));
 },
 parseDpi(b){if(b.length<20||b[0]!==0x12||b[1]!==4||b[2]!==2)throw Error('Ungültige DPI-Antwort.');return Array.from({length:4},(_,i)=>{const k=4+i*4;const x=(b[k]|b[k+1]<<8)*50+50,y=(b[k+2]|b[k+3]<<8)*50+50;integer(x,50,36000);integer(y,50,36000);return {x,y}})},
 parseColors(b){if(b.length<16||b[0]!==0x12||b[1]!==4||b[2]!==3)throw Error('Ungültige Farbauskunft.');return Array.from({length:4},(_,i)=>'#'+Array.from(b.slice(4+i*3,7+i*3),v=>v.toString(16).padStart(2,'0')).join(''))},
 parsePolling(b){if(b.length<13||b[0]!==0x12||b[1]!==4||b[2]!==0||(b[12]&7)>3)throw Error('Unbekannte Pollingrate.');return [125,250,500,1000][b[12]&7]},
 readBindings:()=>[0x12,5,0,0,0],
 parseBindings(b){if(b.length<20||b[0]!==0x12||b[1]!==5||b[2]!==0)throw Error('Tastenbelegung nicht lesbar.');return Array.from({length:8},(_,i)=>b[4+i*2]|b[5+i*2]<<8)},
 setBinding(source,dest){if(![0x1e4,0x1e5,0x1f2].includes(source))throw Error('Nur Seiten- und Mausradtaste sind im Testmodus freigegeben.');integer(dest,0,65535);return [0x51,0x21,0,0,source&255,source>>8,dest&255,dest>>8]}
};
if(typeof module!=='undefined')module.exports=P;else root.HarpeProtocol=P;
})(globalThis);
