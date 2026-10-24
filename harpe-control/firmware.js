/* SPDX-License-Identifier: GPL-3.0-or-later */
(function(root){'use strict';
const START=0x1c000,SIZE=204800,PAGE=4096,END=START+SIZE;
const IMAGES=Object.freeze({
 ADA09D08C91FDEED6F4758E78955143884B0FCA1CEEADAC120847852A4075C41:'Stock 8.00.10',
 B2CB6FF860C86E005895D919E264471FF031FA8120D465DE8816D8DB441C0ABE:'HCEX RAM prototype',
 '09F0BEBBD08C7C53B5B7C4D949DB6706D9A8CC2562CC2E5E7D57F047151776F0':'HCEX persistent prototype',
 '064B01DE4BF5201CD0FF66F514138A7E078D0F051F0837686C55C94B4F616B7F':'HCEX repeat / toggle / hold',
 '4BBA17CD670679B1813A552E7DACEA11A4E713914EEBAE8D0C1B7251EF68C423':'HCEX persistence startup fix (experimental)',
 'E3505A86C5ECD168C0EEA3C2FDF9DD25D8B8CE5CE95DDA7CFEDEBEC555E68930':'HCEX named macros (limited hardware trial)'
});
const CATALOG=Object.freeze({'p713-e350':Object.freeze({device:'ROG Harpe Ace Aim Lab Edition (P713)',url:'firmware/P713-HCEX-named-E3505A86.bin',hash:'E3505A86C5ECD168C0EEA3C2FDF9DD25D8B8CE5CE95DDA7CFEDEBEC555E68930',description:'Custom on-device keyboard macros: one persistent named slot, Once / Repeat / Toggle / Hold. Direct USB only. Experimental; no wireless macros or custom debounce.'})});
async function loadCatalogImage(id,fetcher=globalThis.fetch){const item=CATALOG[id];if(!item)throw Error('Unknown firmware selection.');const response=await fetcher(item.url,{credentials:'omit',cache:'no-cache'});if(!response.ok)throw Error('Firmware download failed: HTTP '+response.status);const bytes=new Uint8Array(await response.arrayBuffer());const checked=await inspectImage(bytes);if(checked.hash!==item.hash)throw Error('Downloaded firmware does not match the selected device image.');return checked;}
const STOCK=Object.keys(IMAGES)[0],KNOWN_PARTIAL=new Set(['ACB240027AF20051EEDF16C38CF32FC31C5984CDEE041A9D93E484C2795AF873','646B29B17323A5C4E8A2073E8774C8CFA53A27BCB2E568A88A8222E90EE580FE']);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function validatePacket(p){
 const command=p[0],u32=i=>(p[i]|(p[i+1]<<8)|(p[i+2]<<16)|(p[i+3]<<24))>>>0;
 if([0x82,0x8f,0xaa].includes(command)&&p.length===1)return;
 if(command===0x20&&p.length===5){windowCheck(u32(1),1);return;}
 if(command===0x21&&p.length===3&&(p[1]|p[2]<<8)>0&&(p[1]|p[2]<<8)<=PAGE)return;
 if(command===0x1f&&p.length===2&&[1,5,0x51].includes(p[1]))return;
 if(command===0x22&&p.length===p[1]+4&&p[1]>0&&p[1]<=60&&(p[2]|p[3]<<8)+p[1]<=PAGE)return;
 if(command===0x10&&p.join(',')===[0x10,65,83,85,83,72,73,68,70,87,85].join(','))return;
 if(command===0x11&&p.length===2&&p[1]===255)return;
 throw Error('Boot packet is outside the reviewed protocol.');
}
async function sha(bytes){const c=typeof module!=='undefined'?require('node:crypto').webcrypto:root.crypto;return Array.from(new Uint8Array(await c.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()}
function windowCheck(address,n){if(!Number.isInteger(address)||!Number.isInteger(n)||n<1||address<START||address+n>END)throw Error('Application window only: 0x1C000–0x4DFFF.');}
async function inspectImage(bytes){const b=Uint8Array.from(bytes);if(b.length!==SIZE)throw Error('Expected exactly 204800 bytes (application only).');const hash=await sha(b);if(!IMAGES[hash])throw Error('Unknown firmware SHA-256. This image cannot be flashed.');const v=new DataView(b.buffer);let sum=0;for(let i=0;i<SIZE-4;i+=4)sum=(sum+v.getUint32(i,true))>>>0;if(sum!==v.getUint32(SIZE-4,true))throw Error('Application checksum mismatch.');return {bytes:b,hash,name:IMAGES[hash]};}
async function plan(before,target){const image=await inspectImage(target),sourceHash=await sha(before);if(before.length!==SIZE)throw Error('A complete application dump is required.');const known=!!IMAGES[sourceHash]||KNOWN_PARTIAL.has(sourceHash);if(!known&&image.hash!==STOCK)throw Error('Unknown current application: only exact stock recovery is allowed.');const pages=[];for(let i=1;i<SIZE/PAGE;i++){const o=i*PAGE;if(before.subarray(o,o+PAGE).some((v,n)=>v!==image.bytes[o+n]))pages.push(START+o)}if(before.subarray(0,PAGE).some((v,n)=>v!==image.bytes[n]))pages.push(START);return {image,sourceHash,recovery:!known,pages};}
class WebHIDLink{
 constructor(device){this.device=device;this.pending=null;this.failed=false;this.onReport=e=>{if(e.reportId!==0||!this.pending)return;const b=Uint8Array.from(new Uint8Array(e.data.buffer,e.data.byteOffset,e.data.byteLength));if(b[0]===255&&b[1]===170)this.pending.finish(Error('Bootloader rejected the request.'));else if(b[0]===this.pending.expected)this.pending.finish(null,b)};device.addEventListener('inputreport',this.onReport);}
 async send(bytes){validatePacket(bytes);if(this.failed||!this.device.opened)throw Error('Reconnect the bootloader after a transport failure.');if(bytes[0]===0x20)this.address=(bytes[1]|bytes[2]<<8|bytes[3]<<16|bytes[4]<<24)>>>0;if(bytes[0]===0x1f&&bytes[1]===1&&(this.address==null||(this.address&4095)))throw Error('Erase requires a page-aligned application address.');const b=new Uint8Array(64);b.set(bytes);try{await this.device.sendReport(0,b)}catch(e){this.failed=true;throw e}}
 query(command,expected){if(this.pending)throw Error('Concurrent boot queries are forbidden.');return new Promise((resolve,reject)=>{let done=false;const timer=setTimeout(()=>{this.failed=true;this.pending?.finish(Error('Bootloader timeout. No automatic retry or restart.'))},2500);this.pending={expected,finish:(e,b)=>{if(done)return;done=true;clearTimeout(timer);this.pending=null;e?reject(e):resolve(b)}};this.send([command]).catch(e=>this.pending?.finish(e));})}
 async close(){this.pending?.finish(Error('Bootloader disconnected.'));this.device.removeEventListener('inputreport',this.onReport);if(this.device.opened)await this.device.close();}
}
class Bootloader{
 constructor(link){this.link=link;this.busy=false;this.verifiedHash=null;}
 async ready(){for(let i=0;i<100;i++){const r=await this.link.query(0x8f,15);if(r.length<3||r[2]!==0)throw Error('Bootloader status error; no automatic retry.');if(!(r[1]&3))return r;await wait(5)}throw Error('Bootloader busy timeout.');}
 async check(){const r=await this.link.query(0x82,2);if(r.length<4||r[1]!==0x19||r[2]!==0||r[3]!==2)throw Error('Only the verified bootloader 2.00.19 is supported.');await this.ready();return '2.00.19';}
 async address(a,n){windowCheck(a,n);await this.link.send([0x20,a&255,(a>>>8)&255,(a>>>16)&255,a>>>24]);}
 async length(n){if(n<1||n>PAGE)throw Error('Invalid boot transfer size.');await this.link.send([0x21,n&255,n>>>8]);}
 async read(a,n){windowCheck(a,n);if(n>48||(a&4095)+n>PAGE)throw Error('Read must remain within one page and at most 48 bytes.');await this.ready();await this.address(a,n);await this.length(n);await this.link.send([0x1f,5]);await this.ready();const r=await this.link.query(0xaa,42);if(r.length<n+1)throw Error('Incomplete boot read.');return r.slice(1,n+1);}
 async readPage(a){const b=new Uint8Array(PAGE);for(let i=0;i<PAGE;i+=48){const n=Math.min(48,PAGE-i);b.set(await this.read(a+i,n),i)}return b;}
 async readAll(progress=()=>{}){const b=new Uint8Array(SIZE);for(let i=0;i<SIZE;i+=PAGE){b.set(await this.readPage(START+i),i);progress(i+PAGE,SIZE)}return b;}
 async dump(progress){if(this.busy)throw Error('Bootloader operation already running.');this.busy=true;try{await this.check();const bytes=await this.readAll(progress),hash=await sha(bytes);this.verifiedHash=IMAGES[hash]?hash:null;return {bytes,hash,name:IMAGES[hash]||'Unknown application',start:START,size:SIZE,bootloader:'2.00.19',includesConfiguration:false};}finally{this.busy=false}}
 async flash(target,authorization,progress=()=>{}){
  if(!authorization?.physicalRecovery||!(authorization?.backupSaved||authorization?.allowWithoutBackup)||authorization?.confirmation!=='FLASH')throw Error('Physical recovery, backup or explicit flashing-risk acceptance, and FLASH confirmation are required.');
  if(this.busy)throw Error('Bootloader operation already running.');this.busy=true;this.verifiedHash=null;
  try{const image=await inspectImage(target);await this.check();const before=await this.readAll((n,t)=>progress('before',n,t)),p=await plan(before,image.bytes);if(p.recovery&&!authorization.stockRecovery)throw Error('Explicit stock recovery confirmation is required for an unknown application.');
   if(p.pages.length){await this.link.send([0x10,65,83,85,83,72,73,68,70,87,85]);if(!((await this.ready())[1]&128))throw Error('Bootloader did not enable programming.');}
   for(const [index,a] of p.pages.entries()){
    await this.ready();await this.address(a,PAGE);await this.link.send([0x1f,1]);await this.ready();if((await this.readPage(a)).some(v=>v!==255))throw Error('Erase verification failed at 0x'+a.toString(16)+'. Stay in bootloader.');
    const o=a-START;for(let i=0;i<PAGE;i+=60){const n=Math.min(60,PAGE-i);await this.link.send([0x22,n,i&255,i>>>8,...image.bytes.slice(o+i,o+i+n)]);await this.ready()}
    await this.address(a,PAGE);await this.length(PAGE);await this.link.send([0x1f,0x51]);await this.ready();if((await this.readPage(a)).some((v,i)=>v!==image.bytes[o+i]))throw Error('Program verification failed. Stay in bootloader.');progress('write',index+1,p.pages.length);
   }
   const after=await this.readAll((n,t)=>progress('after',n,t));if(await sha(after)!==image.hash)throw Error('Full application SHA-256 mismatch. Do not restart.');this.verifiedHash=image.hash;return {hash:image.hash,name:image.name,pages:p.pages.length,verified:true,restarted:false};
  }finally{this.busy=false}
 }
 async restart(){if(this.busy||!this.verifiedHash)throw Error('Restart requires a completely verified known application.');this.busy=true;try{const expected=this.verifiedHash;await this.check();if(await sha(await this.readAll())!==expected){this.verifiedHash=null;throw Error('Application changed after verification. Stay in bootloader.');}await this.link.send([0x11,255]);this.verifiedHash=null;}finally{this.busy=false}}
}
const api={CATALOG,loadCatalogImage,START,SIZE,PAGE,END,IMAGES,STOCK,sha,inspectImage,plan,windowCheck,validatePacket,WebHIDLink,Bootloader};if(typeof module!=='undefined')module.exports=api;else root.HarpeFirmware=api;
})(globalThis);
