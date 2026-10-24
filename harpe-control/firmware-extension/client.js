/* SPDX-License-Identifier: GPL-3.0-or-later */
(function(root){
'use strict';
const M=typeof module!=='undefined'?require('../macros.js'):root.HarpeMacros;
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((-(c&1))&0xedb88320)}return (~c)>>>0}
function packet(op,sequence,body=[]){if(!Number.isInteger(sequence)||sequence<0||sequence>65535||body.length>60)throw Error('Ungültiges Erweiterungspaket.');const p=new Uint8Array(64);p.set([0x53,op,sequence&255,sequence>>8,...body]);return p}
function compile(raw){const t=M.timeline(raw),macro=t.macro;if(t.issues.length)throw Error(t.issues.join(' '));if(!['back','forward'].includes(macro.target))throw Error('Nur standardbelegte Seitentasten sind vorbereitet.');if(t.events.length<1||t.events.length>128||t.duration>60000||t.events[0].time!==0)throw Error('Maximal 128 Ereignisse und 60 Sekunden, keine Startverzögerung.');const bytes=[];for(let i=0;i<t.events.length;i++){const e=t.events[i],key=M.keys[e.value]?.hid,delay=(t.events[i+1]?.time??t.duration)-e.time;if(e.value.startsWith('Mouse')||!((key>=4&&key<=0x91)||(key>=0xe0&&key<=0xe7))||delay>65535)throw Error('Taste oder Wartezeit wird von der Firmware-Erweiterung nicht unterstützt.');bytes.push(key,e.type==='keydown'?1:0,delay&255,delay>>8)}const checksum=crc32(bytes);let sequence=1;const packets=[packet(1,sequence++,[t.events.length,0,macro.target==='back'?8:16,{once:0,repeat:1,toggle:2,hold:3}[macro.mode],macro.repeat&255,macro.repeat>>8,macro.gap&255,macro.gap>>8])];for(let start=0;start<t.events.length;start+=14){const data=bytes.slice(start*4,(start+14)*4);packets.push(packet(2,sequence++,[start&255,start>>8,data.length/4,0,...data]))}packets.push(packet(3,sequence++,[checksum&255,(checksum>>>8)&255,(checksum>>>16)&255,checksum>>>24]));return {format:'harpe-extension-upload',version:1,macroName:macro.name,packets:packets.map(p=>Array.from(p)),events:t.events.length,duration:t.duration,persistent:false,hardwareValidated:false}}
function info(sequence=0){return packet(0,sequence)}
function arm(sequence){return packet(4,sequence,[72,65,82,80])}
function start(sequence){return packet(5,sequence)}
function stop(sequence){return packet(6,sequence)}
function checkReply(request,response){if(response.length<16||!request.slice(0,4).every((v,i)=>v===response[i]))throw Error('Falsche Antwort der Firmware-Erweiterung.');if(response[4]!==0){const op={0:'INFO',1:'BEGIN',2:'DATA',3:'COMMIT',4:'ARM',5:'START',6:'STOP',7:'SAVE',8:'CLEAR',9:'NAME',10:'READ RAM'}[request[1]]||request[1],chunk=request[1]===2?' (events '+((request[4]|request[5]<<8)+1)+'–'+((request[4]|request[5]<<8)+request[6])+')':'';throw Error('HCEX '+op+chunk+' rejected: status '+response[4]+'.');}return response.slice(4)}
async function probe(tx){const request=info(),r=checkReply(request,await tx.command(Array.from(request),4));if(String.fromCharCode(...r.slice(1,5))!=='HCEX'||r[5]!==1||r[6]!==128)throw Error('Keine passende HCEX1-Firmware erkannt.');return {protocol:1,maxEvents:r[6],configured:!!r[7],armed:!!r[8],running:!!r[9],releasePending:!!r[10],repeating:!!(r[11]&2),persistent:!!(r[11]&1),named:!!(r[11]&4),saved:!!r[12],saving:!!r[13],saveResult:r[14]||0,bootEnabled:!!r[15],queueBusy:!!r[26],savedCount:(r[24]|r[25]<<8),savedCRC:(r[20]|r[21]<<8|r[22]<<16|r[23]<<24)>>>0,generation:(r[16]|(r[17]<<8)|(r[18]<<16)|(r[19]<<24))>>>0}}
async function sendUpload(tx,macro){const plan=compile(macro);const state=await probe(tx);if(M.normalize(macro).mode!=='once'&&!state.repeating)throw Error('Wiederholungen benoetigen die neue Firmware. Es wurde nichts geschrieben.');const name=state.named?nameBytes(M.normalize(macro).name):null;for(const request of plan.packets)checkReply(request,await tx.command(request,4));if(name){const request=packet(9,500,[name.length,...name]);checkReply(request,await tx.command(Array.from(request),4));}return plan}
async function savePersistent(tx,{sequence=1000,clear=false,enabled=true,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const before=await probe(tx);if(!before.persistent)throw Error('Diese Firmware unterstützt noch keine dauerhafte Speicherung. Es wurde nichts geschrieben.');
 if(before.saving)throw Error('Die Maus speichert bereits. Bitte warten.');
 const request=packet(clear?8:7,sequence,[78,86,77,clear?67:83,clear?0:+enabled]);checkReply(request,await tx.command(Array.from(request),4));
 for(let i=0;i<200;i++){await wait(80);const state=await probe(tx);if(state.saving||state.queueBusy)continue;
  if(state.saveResult!==0||state.generation!==((before.generation+1)>>>0)||state.saved===clear)throw Error('Dauerhafte Speicherung nicht bestätigt. Nicht automatisch erneut schreiben.');
  return state;
 }
 throw Error('Keine Speicherbestätigung erhalten. Zustand unklar; Maus erneut prüfen.');
}
// Bounded observer already present in the installed HCEX NVM firmware.
async function readBlock(tx,kind,offset,length){
 const out=new Uint8Array(length);
 for(let i=0;i<length;i+=48){const n=Math.min(48,length-i),off=offset+i,q=new Uint8Array(64);q.set([0x55,kind,0x37,0x48,off&255,off>>8,n,0]);const r=await tx.command(Array.from(q),4);
 if(r.length<16+n||!q.slice(0,4).every((v,j)=>v===r[j])||r[4]!==0||r[5]!==1||r[6]!==kind||r[7]!==n||r[8]!==q[4]||r[9]!==q[5])throw Error('Invalid bounded storage response. No writes sent.');out.set(r.slice(16,16+n),i);
 }return out;
}
function decodeRecord(r){
 const v=new DataView(r.buffer,r.byteOffset,r.byteLength),u16=i=>v.getUint16(i,true),u32=i=>v.getUint32(i,true),n=u16(12);
 if(![548,612].includes(r.length)||u32(0)!==0x324e4348||![2,3].includes(r[4])||r[5]>1||![8,16].includes(r[6])||n<1||n>128||u16(14)!==n*4||u32(544)!==0x54494d43)throw Error('No valid saved macro record.');
 const header=r[4]===2?r.slice(0,20):Uint8Array.from([...r.slice(0,20),...r.slice(24,32)]);
 if(crc32(header)!==u32(20)||crc32(r.slice(32,32+n*4))!==u32(16)||r.slice(32+n*4,544).some(b=>b!==255))throw Error('Saved macro checksum mismatch.');
 if(r[4]===2&&(r[7]!==0||r.slice(24,32).some(b=>b!==255)))throw Error('Invalid saved macro header.');
 if(r[4]===3&&(![1,2,3].includes(r[7])||r.slice(28,32).some(b=>b!==255)))throw Error('Invalid saved macro mode.');
 let name='Saved macro '+u32(16).toString(16).padStart(8,'0').toUpperCase(),nameStored=false;
 if(r.length===612&&u32(548)===0x314d414e){if(u32(604)!==u32(20)||r[552]<1||r[552]>48||crc32(r.slice(548,608))!==u32(608)||r.slice(553+r[552],604).some(b=>b!==255))throw Error('Saved name checksum mismatch.');name=new TextDecoder('utf-8',{fatal:true}).decode(r.slice(553,553+r[552]));nameBytes(name);nameStored=true;}
 const events=[];
 for(let i=0;i<n;i++){const off=32+i*4,key=Object.values(M.keys).find(k=>k.hid===r[off]&&!k.code.startsWith('Mouse'));if(!key||r[off+1]>1)throw Error('Unsupported saved key.');events.push({type:r[off+1]?'keydown':'keyup',value:key.code});const delay=u16(off+2);if(delay)events.push({type:'delay',value:delay});}
 const macro=M.normalize({name,target:r[6]===8?'back':'forward',mode:r[4]===2?'once':['once','repeat','toggle','hold'][r[7]],repeat:r[4]===2?2:u16(24),gap:r[4]===2||r[7]===0?100:u16(26),events});
 const plan=compile(macro),bytes=plan.packets.filter(q=>q[1]===2).flatMap(q=>q.slice(8,8+q[6]*4));
 if(bytes.length!==n*4||bytes.some((b,i)=>b!==r[32+i]))throw Error('Saved macro cannot be represented without changes.');
 return {macro,nameStored,enabled:!!r[5],generation:u32(8),crc:u32(16)};
}
async function readSaved(tx){
 const before=await probe(tx);if(!before.persistent||!before.saved||before.saving)throw Error('No stable saved macro available.');
 const slot=await readBlock(tx,4,0,4),kind=new DataView(slot.buffer).getUint32(0,true);if(![1,2].includes(kind))throw Error('Invalid active configuration slot.');
 const a=await readBlock(tx,kind,0xd1c,548),b=await readBlock(tx,kind,0xd1c,548),after=await probe(tx),slotAfter=await readBlock(tx,4,0,4);
 if(a.some((v,i)=>v!==b[i])||slot.some((v,i)=>v!==slotAfter[i])||before.generation!==after.generation||after.saving)throw Error('Storage changed while reading. No writes sent.');
 let bytes=a;if(before.named){const tail=await readBlock(tx,kind,0xd1c+548,64),tail2=await readBlock(tx,kind,0xd1c+548,64),final=await probe(tx);if(tail.some((v,i)=>v!==tail2[i])||final.generation!==after.generation||final.saving)throw Error('Storage changed while reading names.');bytes=Uint8Array.from([...a,...tail]);}const record=decodeRecord(bytes);if(record.generation!==after.generation)throw Error('Saved generation mismatch.');return record;
}
function nameBytes(name){const bytes=new TextEncoder().encode(String(name).trim());if(!bytes.length||bytes.length>48||/[\u0000-\u001f\u007f-\u009f]/.test(name))throw Error('Macro name must contain 1–48 UTF-8 bytes and no control characters.');return bytes;}
async function readCurrent(tx){
 const before=await probe(tx);if(!before.named||!before.configured)throw Error('Current macro readback needs named-macro firmware.');
 async function pass(){const out=new Uint8Array(612);for(let off=0;off<612;off+=48){const n=Math.min(48,612-off),q=packet(10,600+off,[off&255,off>>8,n]),r=checkReply(q,await tx.command(Array.from(q),4));if(r.length<12+n||r[1]!==1||r[2]!==q[4]||r[3]!==q[5]||r[4]!==n)throw Error('Invalid current macro reply.');out.set(r.slice(12,12+n),off);}return out;}
 const a=await pass(),b=await pass(),after=await probe(tx);if(a.some((v,i)=>v!==b[i])||!after.configured||before.armed!==after.armed)throw Error('Current macro changed while reading.');return decodeRecord(a);
}
function identity(raw){const m=M.normalize(raw),p=compile(m),data=p.packets.filter(q=>q[1]===2).flatMap(q=>q.slice(8,8+q[6]*4));return JSON.stringify({target:m.target,mode:m.mode,repeat:m.mode==='repeat'?m.repeat:2,gap:m.mode==='once'?0:m.gap,data});}
function matches(actual,expected,{name=true}={}){return identity(actual)===identity(expected)&&(!name||M.normalize(actual).name===M.normalize(expected).name);}
async function waitIdle(tx,{wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){for(let i=0;i<200;i++){const state=await probe(tx);if(!state.queueBusy&&!state.saving)return state;await wait(80);}throw Error('Device settings save did not become idle. No macro activation requested.');}
const api={identity,matches,waitIdle,nameBytes,readCurrent,readBlock,decodeRecord,readSaved,compile,crc32,info,arm,start,stop,checkReply,probe,sendUpload,savePersistent};if(typeof module!=='undefined')module.exports=api;else root.HarpeExtension=api;
})(globalThis);
