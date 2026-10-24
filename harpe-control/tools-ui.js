/* SPDX-License-Identifier: GPL-3.0-or-later */
(function(root){'use strict';
root.createHarpeToolsUI=function({getConnection,extension,changedState,download,log}){
 const F=root.HarpeFirmware,D=root.HarpeDebounce,$=s=>document.querySelector(s);let boot=null,bootDevice=null,snapshot=null,target=null,exported=false,busy=false;
 let trials=[],trial=null,finished=false,debounceReadable=false,lastTransport=null;
 const note=(id,text)=>{$('#'+id).textContent=text};
 function draw(){const c=getConnection();if(c.transport!==lastTransport){lastTransport=c.transport;debounceReadable=false}const blocked=busy||c.busy,normal=!!c.transport&&c.ready&&!c.transport.poisoned&&!c.simulated&&c.device?.productId===0x1a92;
  $('#firmwareStatus').textContent=boot?'Bootloader detected':!c.device?'No device connected':extension.getStatus().verified?'HCEX firmware detected':'Normal mode';
  $('#checkFirmware').disabled=blocked||!normal;$('#bootConnect').disabled=blocked||!!c.device;$('#bootDump').disabled=blocked||!boot;$('#bootExport').disabled=blocked||!snapshot;$('#bootRestart').disabled=blocked||!boot?.verifiedHash;
  $('#firmwareCatalog').disabled=blocked;$('#loadCatalogFirmware').disabled=blocked||!F.CATALOG[$('#firmwareCatalog').value];
  $('#bootImage').disabled=busy;$('#bootFlash').disabled=blocked||!boot||!snapshot||!target||!exported||!$('#physicalRecovery').checked||!$('#backupSaved').checked||$('#flashConfirm').value!=='FLASH';
  const missing=[];
  if(blocked)missing.push('Wait for the current operation to finish');
  if(!boot)missing.push('Connect the mouse in bootloader mode');
  if(!snapshot)missing.push('Read application dump');
  if(!exported)missing.push('Export backup');
  if(!target)missing.push('Load selected firmware');
  if(!$('#physicalRecovery').checked)missing.push('Confirm physical recovery');
  if(!$('#backupSaved').checked)missing.push('Confirm backup files were saved');
  if($('#flashConfirm').value!=='FLASH')missing.push('Type FLASH exactly');
  note('flashReadiness',missing.length?'Still required: '+missing.join(' · '):'Ready to flash the checked image.');
  $('#debounceRead').disabled=blocked||!normal;$('#debounceApply').disabled=blocked||!normal||!debounceReadable||$('#debouncePreset').value==='';
  $('#calStart').disabled=!!trial&&!finished;$('#calFinish').disabled=!trial||finished;$('#calKeep').disabled=!trial||!finished;$('#calDiscard').disabled=!trial;$('#calExport').disabled=!trials.length;$('#calAnalyze').disabled=!trials.length;
 }
 async function run(fn,resultId='firmwareResult'){if(busy||getConnection().busy)return;busy=true;changedState(true);draw();try{await fn()}catch(e){note(resultId,e.message);log('Firmware tools: '+e.message)}finally{busy=false;changedState(false);draw()}}
 const runDebounce=fn=>run(fn,'debounceResult');
 try{const draft=JSON.parse(localStorage.getItem('harpe-custom-debounce-draft'));if(Number.isInteger(draft?.ms)&&draft.ms>=0&&draft.ms<=50)$('#debounceCustom').value=String(draft.ms)}catch{}

 async function attachBoot(device){
  const collections=cs=>cs.flatMap(c=>[c,...collections(c.children||[])]);const report=collections(device.collections||[]).filter(c=>c.usagePage===0xff01).flatMap(c=>c.outputReports||[]).find(r=>r.reportId===0&&r.items.reduce((n,i)=>n+i.reportSize*i.reportCount,0)===512);
  if(device.vendorId!==0x0b05||device.productId!==0x1a93||!report)throw Error('Not the verified P713 bootloader interface.');
  await device.open();const link=new F.WebHIDLink(device);try{boot=new F.Bootloader(link);await boot.check();bootDevice=device;snapshot=null;exported=false;note('firmwareResult','Bootloader detected · 2.00.19. Read and export an application backup before flashing.');draw();return 'Bootloader detected · 2.00.19';}catch(e){await link.close();boot=null;throw e}
 }
 async function disconnect(){if(boot){await boot.link.close();boot=null}bootDevice=null;snapshot=null;target=null;exported=false;draw();}
 $('#bootConnect').onclick=()=>$('#connect').onclick();$('#checkFirmware').onclick=async()=>{await extension.probe();draw()};$('#macroCheck').onclick=()=>$('#checkFirmware').onclick();
 $('#bootDump').onclick=()=>run(async()=>{snapshot=null;exported=false;snapshot=await boot.dump((n,t)=>{$('#bootProgress').max=t;$('#bootProgress').value=n});note('firmwareResult','Application dump complete · '+snapshot.name+' · SHA-256 '+snapshot.hash);});
 $('#bootExport').onclick=()=>{if(!snapshot)return;download('harpe-application-'+snapshot.hash.slice(0,8)+'.bin',snapshot.bytes,'application/octet-stream');download('harpe-application-backup.json',{format:'harpe-application-backup',version:1,sha256:snapshot.hash,bytes:F.SIZE,start:F.START,includesConfiguration:false,bootloader:'2.00.19'});exported=true;note('firmwareResult','Backup export requested. Confirm that both files were saved before flashing.');draw();};
 $('#firmwareCatalog').onchange=()=>{if(busy||getConnection().busy)return;target=null;const item=F.CATALOG[$('#firmwareCatalog').value];note('imageStatus','');note('firmwareCatalogHint',item?item.description:'Choose your device to see the available firmware.');const link=$('#downloadCatalogFirmware');link.hidden=!item;if(item){link.href=item.url;link.download=item.url.split('/').pop();link.textContent='Download .bin';}draw();};
 $('#loadCatalogFirmware').onclick=()=>run(async()=>{const id=$('#firmwareCatalog').value,item=F.CATALOG[id];target=null;if(!item)throw Error('Select your exact mouse model first.');note('imageStatus','Downloading and verifying selected firmware…');try{const checked=await F.loadCatalogImage(id);if($('#firmwareCatalog').value!==id)throw Error('Firmware selection changed while loading.');target=checked;note('imageStatus',item.device+' · '+checked.name+' · SHA-256 '+checked.hash+' · Ready for the separate backup and flash steps.');}catch(error){target=null;note('imageStatus',error.message);throw error;}},'imageStatus');
 $('#bootImage').onchange=async e=>{target=null;draw();const file=e.target.files?.[0];if(!file)return;try{if(file.size!==F.SIZE)throw Error('Expected exactly 204800 bytes.');target=await F.inspectImage(new Uint8Array(await file.arrayBuffer()));note('imageStatus',target.name+' · SHA-256 '+target.hash);if(snapshot){const p=await F.plan(snapshot.bytes,target.bytes);note('imageStatus',target.name+' · '+p.pages.length+' application pages · SHA-256 '+target.hash)}}catch(error){target=null;note('imageStatus',error.message)}draw();};
 for(const id of ['physicalRecovery','backupSaved','stockRecovery'])$('#'+id).onchange=draw;$('#flashConfirm').oninput=draw;
 $('#bootFlash').onclick=()=>run(async()=>{if(!snapshot||!target||!exported)throw Error('Read and export a complete backup first.');const result=await boot.flash(target.bytes,{physicalRecovery:$('#physicalRecovery').checked,backupSaved:$('#backupSaved').checked,confirmation:$('#flashConfirm').value,stockRecovery:$('#stockRecovery').checked},(phase,n,t)=>{$('#bootProgress').max=t;$('#bootProgress').value=n;note('firmwareResult',phase+' · '+n+' / '+t)});note('firmwareResult','Full application SHA-256 verified · '+result.hash+'. Use Restart to leave the bootloader.');download('harpe-flash-result.json',result);});
 $('#bootRestart').onclick=()=>run(async()=>{await boot.restart();note('firmwareResult','Verified application restart requested. Reconnect the normal mouse interface.');});
 async function readDebounce(){debounceReadable=false;const c=getConnection();if(!c.transport||!c.ready||c.simulated)throw Error('Connect the real wired mouse first.');const info=D.decode(await c.transport.command([0x12,4,0],3));lastTransport=c.transport;debounceReadable=info.ms!=null;$('#debouncePreset').value=info.ms==null?'':String(info.ms);note('debounceResult',info.ms==null?'Unknown debounce encoding; writing remains blocked.':'Read debounce: '+info.ms+' ms (native preset).');}
 $('#debounceRead').onclick=()=>runDebounce(readDebounce);
 $('#debounceApply').onclick=()=>runDebounce(async()=>{const c=getConnection(),ms=Number($('#debouncePreset').value);if(!debounceReadable||!c.transport||!c.ready||c.simulated||c.device?.productId!==0x1a92)throw Error('Connect the real wired mouse first.');debounceReadable=false;await c.transport.command(D.packet(ms),2);await c.transport.command([0x50,3],2);const read=D.decode(await c.transport.command([0x12,4,0],3));if(read.ms!==ms)throw Error('Debounce readback mismatch. No automatic retry.');debounceReadable=true;note('debounceResult','Native debounce preset saved and verified: '+ms+' ms.');});
 $('#debouncePreset').onchange=draw;
 $('#debounceSaveDraft').onclick=()=>{const n=Number($('#debounceCustom').value);if(!Number.isInteger(n)||n<0||n>50){note('debounceResult','Custom draft range: integer 0–50 ms.');return}try{localStorage.setItem('harpe-custom-debounce-draft',JSON.stringify({ms:n,applied:false}));note('debounceResult','Custom draft saved locally; no device command sent.')}catch{note('debounceResult','Local storage unavailable. Draft was not saved.')}};
 $('#calStart').onclick=()=>{trial={button:Number($('#calButton').value),intent:$('#calIntent').value,events:[],confirmed:false};finished=false;note('calResult','Trial ready. Perform the selected action, then finish and confirm it.');draw();};
 function event(type,e){if(!trial||finished||e.button!==trial.button||e.isTrusted===false)return;const time=performance.now();trial.events.push({type,time});note('calLive',trial.events.filter(e=>e.type==='down').length+' press events · '+trial.events.length+' edges');}
 $('#calArea').addEventListener('mousedown',e=>event('down',e));$('#calArea').addEventListener('mouseup',e=>event('up',e));$('#calArea').addEventListener('contextmenu',e=>e.preventDefault());
 $('#calFinish').onclick=()=>{if(!trial)return;finished=true;note('calResult','Confirm that you performed the selected action. Extra edges in a single-click or hold trial will be treated as unwanted.');note('calRaw',JSON.stringify(trial.events,null,2));draw();};
 $('#calKeep').onclick=()=>{if(!trial||!finished)return;trial.confirmed=true;trials.push(trial);trial=null;finished=false;note('calResult','Trial stored. No mouse setting changed.');draw();};
 $('#calDiscard').onclick=()=>{trial=null;finished=false;note('calLive','');note('calResult','Trial discarded.');draw();};
 $('#calAnalyze').onclick=()=>{const result=D.analyze(trials,Number($('#calButton').value));note('calRaw',JSON.stringify(result,null,2));note('calResult','Confirmed single / hold trials: '+(result.singles+result.holds)+' · double-click trials: '+result.doubles+' · unwanted transitions: '+result.confirmedFalseTransitions+' · '+result.reason);if(result.proposedMs!=null){$('#debounceCustom').value=result.proposedMs;note('calSuggestion','Provisional custom draft: '+result.proposedMs+' ms. Native preset at or above it: '+(result.nearestPreset??'none')+'. Nothing applied.')}else note('calSuggestion','No automatic increase: '+result.reason);};
 $('#calExport').onclick=()=>download('harpe-click-calibration.json',{format:'harpe-click-calibration',version:1,source:'browser-processed-events',rawSwitchMeasurement:false,trials});
 return {draw,readDebounce,attachBoot,disconnect,get busy(){return busy},get bootConnected(){return !!boot},get bootDevice(){return bootDevice}};
};
})(globalThis);
