/* SPDX-License-Identifier: GPL-3.0-or-later */

(function(root){

'use strict';

// No device access until an explicit button action; all writes require a verified handshake.

root.createHarpeExtensionUI=function({getConnection,getMacro,setMacro,getSelectedButton,restoreNative,log,changedState}){

 const E=root.HarpeExtension,$=s=>document.querySelector(s);

 let info=null,uploaded=null,working=false,sequence=100,owner=null,known=false,savedRecord=null,currentRecord=null,phase='';
 function progress(text){phase=text;$('#extensionStatus').textContent=text+'…';log('Macro apply: '+text);}

 function connection(){const c=getConnection();if(c.transport!==owner){owner=c.transport;info=null;uploaded=null;known=false;savedRecord=null;currentRecord=null}return c}

 function fingerprint(){return JSON.stringify(getMacro())}

 function drawAssignment(locked,usable){
  const selected=getSelectedButton?.(),label=$('#activeMacroAssignment'),picker=$('#savedMacroSelect');
  const active=known&&info?.armed&&info?.configured;
  if(label)label.textContent=!usable?'Connect to read button assignment.':!known||!info?'Macro assignment unavailable.':currentRecord&&active&&currentRecord.macro.target===selected?'Macro '+currentRecord.macro.name+' · '+(info.running?'Running':'Enabled'):active&&!currentRecord&&['back','forward'].includes(selected)?'Active macro identity unavailable — firmware update required.':'Normal button assignment';
  if(picker){picker.replaceChildren();const option=document.createElement('option');option.value=savedRecord?'device-slot-1':'';option.textContent=savedRecord?savedRecord.macro.name+' · '+savedRecord.macro.target+' · '+(savedRecord.nameStored?'On mouse':'Unnamed legacy slot'):info?.saved?'Saved macro could not be read':'No saved macros on mouse';picker.append(option);picker.value=option.value;picker.disabled=locked||!usable||!known||!savedRecord;
   if($('#useSavedMacro'))$('#useSavedMacro').disabled=picker.disabled||savedRecord?.macro.target!==selected;
  }
 }
 function draw(){const c=connection(),usable=!!c.transport&&c.ready&&!c.transport.poisoned&&!c.simulated&&c.productId===0x1a92&&c.transport.length===64,locked=working||c.busy;
  const gate=!usable||!known;$('#macroFieldset').disabled=gate||locked;$('#macroFieldset').inert=gate||locked;$('#macroFieldset').classList.toggle('firmware-locked',gate);$('#macroLockBanner').hidden=!gate;$('#libraryPanel').inert=gate;$('#libraryPanel').classList.toggle('firmware-locked',gate);

  $('#extensionProbe').disabled=locked||!usable;
  const side=['back','forward'].includes(getSelectedButton?.());
  for(const id of ['readSavedMacro','useNormalButton','useSavedMacro'])if($('#'+id))$('#'+id).disabled=locked||!usable||!known||!info?.persistent||!info?.saved||(id!=='readSavedMacro'&&!side);
  if($('#assignmentState'))$('#assignmentState').textContent=!known?'Check firmware to inspect the saved assignment.':!info?.saved?'No saved macro. Apply a macro with Keep after power-off first.':'Saved sequence preserved · currently '+(info.armed?'macro enabled':'normal button / macro disabled')+' · after restart: '+(info.bootEnabled?'macro':'normal button')+'. Switching affects the one shared macro slot.';


  $('#extensionUpload').disabled=locked||!usable||!info;

  $('#extensionArm').disabled=locked||!usable||!info?.configured||uploaded!==fingerprint();

  $('#extensionStart').disabled=locked||!usable||!info?.armed||uploaded!==fingerprint()||getMacro().mode==='hold';

  $('#extensionStop').disabled=locked||!usable||!known;

  $('#extensionPersist').disabled=locked||!usable||!info?.persistent||!info?.configured||info?.running||uploaded!==fingerprint();

  $('#extensionClearPersistent').disabled=locked||!usable||!info?.persistent||!info?.saved||info?.running;

  $('#persistenceHint').textContent=!info?'Nach "Maus prüfen" wird angezeigt, ob dauerhaftes Speichern verfügbar ist.':!info.persistent?'Die installierte Firmware speichert Makros nur im RAM. Die dauerhafte Speicherung wird noch entwickelt.':info.saving?'Speichervorgang läuft – USB-Verbindung beibehalten.':info.saveResult===2?'Letzter Speichervorgang nicht bestätigt. Maus prüfen, bevor du erneut speicherst.':info.saved&&!info.bootEnabled?'Saved sequence retained. Normal button mode is saved for the next restart. Select the saved macro and assign it to enable it again.':info.saved?'Ein Makro ist dauerhaft gespeichert und wird beim Einschalten geladen. "Makro deaktivieren" stoppt es bis zum Neustart; "Dauerhaftes Makro löschen" entfernt die Speicherung.':'Dauerhafter Speicher ist leer. Nach der RAM-Übertragung kannst du das Makro hier speichern.';

  drawAssignment(locked,usable);
  const next=$('#extensionNext');

  if(next){let problem='';try{E.compile(getMacro());if(info?.named)E.nameBytes(getMacro().name);if(info&&!info.repeating&&getMacro().mode!=='once')throw Error('Die installierte Firmware braucht ein Update fuer Wiederholungen. Einmalige Makros funktionieren weiterhin.');}catch(e){problem=e.message}

   next.textContent=working?'Bitte warten – die Maus antwortet …':!usable?'Verbinde zuerst die echte Maus per USB-Kabel über „Maus verbinden“.':!info?'Als Nächstes: „1. Maus prüfen“ anklicken.':problem?'Makro bitte korrigieren: '+problem:uploaded!==fingerprint()?'Als Nächstes: „2. In Mausspeicher schreiben“ anklicken.':!info.armed?'Im Mausspeicher vorhanden. Als Nächstes: „3. Seitentaste aktivieren“ anklicken.':'Bereit! Die gewählte Seitentaste startet dein Makro. Du kannst den Browser schließen.';

   if(problem)$('#extensionUpload').disabled=true;

   $('#applyMacro').disabled=locked||!usable||!known||!!problem||!!c.editing;$('#applyTop').disabled=$('#applyMacro').disabled;

   $('#deploymentState').textContent=working?'ARBEITET':!usable?'OFFLINE':info?.armed?'AKTIV':uploaded===fingerprint()?'UEBERTRAGEN':'ENTWURF';

   next.textContent=working?'Bitte warten. Die Maus wird geprüft und dein Ablauf verarbeitet.':!usable?(c.simulated?'Die Demo verändert keine echte Maus. Verbinde deine Maus für die Übertragung.':'Verbinde deine Maus per USB. Deinen Ablauf kannst du schon vorbereiten.'):problem?'Bitte korrigieren: '+problem:info?.armed&&uploaded===fingerprint()?'Aktiv. Deine Seitentaste verwendet den gewählten Modus. Der Browser kann geschlossen werden.':'Mit einem Klick prüfen, übertragen und die Seitentaste aktivieren.';

  }

 }

 async function action(fn){const c=connection();if(working||c.busy||!c.ready||c.simulated||c.productId!==0x1a92||c.transport?.length!==64)return;

  working=true;phase='';changedState(true);draw();try{await fn(c.transport)}catch(e){info=null;uploaded=null;currentRecord=null;savedRecord=null;$('#extensionStatus').textContent=/FF AA/.test(e.message)&&!known?'Diese Firmware unterstützt HCEX1 nicht. Keine Makrodaten übertragen.':(phase?phase+' failed: ':'')+e.message;log('HCEX1: '+(phase?phase+': ':'')+e.message)}finally{working=false;changedState(false);draw()}}

 async function control(tx,op,beforeWrite){await E.probe(tx);known=true;if(beforeWrite)beforeWrite();const request=E[op](sequence++ & 65535);E.checkReply(request,await tx.command(Array.from(request),4));info=await E.probe(tx)}

 $('#applyMacro').onclick=()=>action(async tx=>{
  if(connection().editing)throw Error('Die Aufnahme zuerst beenden.');
  const snapshot=JSON.parse(fingerprint()),keep=$('#keepAfterRestart').checked;E.compile(snapshot);
  const same=()=>{if(fingerprint()!==JSON.stringify(snapshot))throw Error('Der Entwurf wurde während der Übertragung geändert. Bitte den aktuellen Ablauf erneut anwenden.');};
  progress('Checking firmware');info=await E.probe(tx);known=true;
  if(keep&&!info.persistent)throw Error('Diese Firmware unterstützt das Behalten nach Ausschalten nicht. Es wurde nichts übertragen.');
  if(!info.repeating&&snapshot.mode!=='once')throw Error('Für diesen Modus ist ein Firmwareupdate erforderlich. Es wurde nichts übertragen.');
  if(info.named)E.nameBytes(snapshot.name);
  progress('Disabling previous macro');await stopConfirmed(tx);
  progress('Preparing side button');await E.waitIdle(tx);await restoreNative(tx,snapshot.target);await E.waitIdle(tx);same();
  progress('Uploading sequence and name');uploaded=null;currentRecord=null;await E.sendUpload(tx,snapshot);info=await E.probe(tx);same();
  if(!info.configured)throw Error('Upload acknowledged but RAM macro is incomplete.');
  if(info.named){progress('Verifying uploaded RAM macro');const actual=await E.readCurrent(tx);same();if(!E.matches(actual.macro,snapshot))throw Error('RAM readback differs from the editor. Macro remains disabled.');currentRecord=actual;}
  uploaded=JSON.stringify(snapshot);
  if(keep){progress('Saving persistent macro');info=await E.savePersistent(tx,{sequence:sequence++ & 65535});same();progress('Verifying persistent macro');const actual=await E.readSaved(tx);same();if(!E.matches(actual.macro,snapshot,{name:!!info.named})||!actual.enabled)throw Error('Persistent readback differs from the editor. Macro remains disabled.');savedRecord=actual;}
  progress('Enabling and verifying side button');same();await control(tx,'arm',same);if(!info.armed||!info.configured)throw Error('Macro activation was not confirmed.');
  if(info.named){const actual=await E.readCurrent(tx);same();if(!actual.enabled||!E.matches(actual.macro,snapshot))throw Error('Active macro readback differs from the editor.');currentRecord=actual;}else currentRecord={macro:snapshot,nameStored:false,enabled:true};
  $('#extensionStatus').textContent='“'+snapshot.name+'” '+(info.named?'read back from mouse and enabled.':'uploaded and enabled; exact RAM readback is unavailable on this firmware.')+(keep?' Persistent storage verified.':' RAM only. Previously saved macro unchanged.');
 });
 $('#applyTop').onclick=()=>$('#applyMacro').onclick();
 $('#extensionProbe').onclick=()=>action(async tx=>{known=false;info=await E.probe(tx);known=true;$('#extensionStatus').textContent='Maus bereit · '+(info.armed?'Ein Makro ist aktiviert':info.configured?'Ein Makro liegt im Arbeitsspeicher, ist aber deaktiviert':'Der Mausspeicher enthält noch kein Makro')+'. Du kannst deinen aktuellen Ablauf anwenden.'});

 $('#extensionUpload').onclick=()=>action(async tx=>{const macro=JSON.parse(fingerprint());uploaded=null;const plan=await E.sendUpload(tx,macro);info=await E.probe(tx);known=true;uploaded=JSON.stringify(macro);$('#extensionStatus').textContent='„'+macro.name+'“ ist im Arbeitsspeicher der Maus gespeichert ('+plan.events+' Ereignisse). Zum Verwenden die Seitentaste aktivieren. Die Taste muss ihre Standardbelegung Zurück/Vor haben.'});

 $('#extensionArm').onclick=()=>action(async tx=>{if(uploaded!==fingerprint())throw Error('Aktuellen Entwurf zuerst übertragen.');await restoreNative(tx,getMacro().target);await control(tx,'arm');$('#extensionStatus').textContent='Makro aktiviert. Einmal/Feste Wiederholungen: drücken startet. Toggle: erneut drücken stoppt. Halten: loslassen stoppt.'});

 $('#extensionStart').onclick=()=>action(async tx=>{if(uploaded!==fingerprint())throw Error('Aktuellen Entwurf zuerst übertragen.');await control(tx,'start');$('#extensionStatus').textContent='Makrostart auf der Maus wurde angefordert.'});

 async function stopConfirmed(tx){await control(tx,'stop');for(let i=0;i<30&&info.releasePending;i++){await new Promise(r=>setTimeout(r,20));info=await E.probe(tx)}if(info.armed||info.running||info.releasePending)throw Error('Macro disable/release not confirmed.');}
 async function switchAssignment(tx,enabled){
  const record=await E.readSaved(tx),selected=getSelectedButton();
  if(record.macro.target!==selected)throw Error('The saved macro belongs to the '+record.macro.target+' side button. Select that button first.');
  await stopConfirmed(tx);await E.sendUpload(tx,record.macro);info=await E.probe(tx);uploaded=null;
  // Persist only the read-back device sequence, never an unrelated browser draft.
  if(record.enabled!==enabled)info=await E.savePersistent(tx,{sequence:sequence++ & 65535,enabled});
  if(info.bootEnabled!==enabled)throw Error('Saved assignment was not confirmed.');
  await restoreNative(tx,selected);
  if(enabled)await control(tx,'arm');else await stopConfirmed(tx);
  const check=await E.readSaved(tx);savedRecord=check;currentRecord=check;if(check.crc!==record.crc||check.enabled!==enabled)throw Error('Saved sequence/assignment verification failed.');
  $('#extensionStatus').textContent=enabled?'Saved macro enabled for this side button. Sequence preserved.':'Normal side button restored, including after restart. Saved macro preserved.';
 }
 if($('#readSavedMacro'))$('#readSavedMacro').onclick=()=>action(async tx=>{const record=await E.readSaved(tx);savedRecord=record;setMacro(record.macro);info=await E.probe(tx);known=true;uploaded=null;$('#extensionStatus').textContent='Saved sequence read from mouse into the editor. No device settings changed.'+(record.nameStored?' Name read from mouse.':' Legacy firmware has no stored name.')});
 if($('#useNormalButton'))$('#useNormalButton').onclick=()=>action(tx=>switchAssignment(tx,false));
 if($('#useSavedMacro'))$('#useSavedMacro').onclick=()=>action(tx=>switchAssignment(tx,true));
 $('#extensionStop').onclick=()=>action(async tx=>{await stopConfirmed(tx);$('#extensionStatus').textContent='Macro stopped; session activation disabled. To keep normal button behavior after restart, choose Use normal button in Button assignment.'});

 $('#extensionPersist').onclick=()=>action(async tx=>{if(uploaded!==fingerprint())throw Error('Aktuellen Entwurf zuerst in den Mausspeicher Übertragen.');info=await E.savePersistent(tx,{sequence:sequence++ & 65535});$('#extensionStatus').textContent='Dauerhafte Speicherung bestätigt. Nach dem Einschalten ist das Makro wieder per Seitentaste verfügbar. Für jetzt "Seitentaste aktivieren" wählen.'});

 $('#extensionClearPersistent').onclick=()=>action(async tx=>{info=await E.savePersistent(tx,{sequence:sequence++ & 65535,clear:true});savedRecord=null;$('#extensionStatus').textContent='Dauerhaftes Makro gelöscht. Der Browserentwurf bleibt erhalten.'});

 async function initialize(tx){
  connection();info=null;known=false;savedRecord=null;currentRecord=null;uploaded=null;
  try{info=await E.probe(tx);known=true;$('#keepAfterRestart').checked=!!info.persistent;
   $('#extensionStatus').textContent='HCEX firmware detected. '+(info.saved?'Saved macro found.':'No saved macro.');
   if(info.saved&&!info.saving){try{savedRecord=await E.readSaved(tx);$('#extensionStatus').textContent='Saved macro read: '+savedRecord.macro.target+' button · '+savedRecord.macro.mode+'. Your browser draft is preserved.';}catch(e){log('Saved macro read: '+e.message);$('#extensionStatus').textContent='HCEX detected; saved macro could not be read: '+e.message;}}
   if(info.named&&info.configured){try{currentRecord=await E.readCurrent(tx);}catch(e){log('Current macro read: '+e.message);}}
  }catch(e){info=null;known=false;$('#extensionStatus').textContent='HCEX unavailable: '+e.message;log('HCEX detection: '+e.message);}
 }
 return {draw,initialize,isBusy:()=>working,drawAssignment,probe:()=>$('#extensionProbe').onclick(),getStatus:()=>{const c=connection();return {verified:!!c.transport&&c.ready&&!c.transport.poisoned&&!c.simulated&&c.productId===0x1a92&&known,info,savedRecord,currentRecord}}};

};

})(globalThis);
