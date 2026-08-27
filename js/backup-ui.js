/* Dutch Vocabulary Trainer V2.3 - backup UI bindings. */
(function(){'use strict';
function status(message){const el=document.getElementById('backupStatus');if(el)el.textContent=message;}
async function exportBackup(){try{const data=await DutchTrainerBackup.export();status(`Backup exported: ${data.vocabulary.length} words, ${data.packs.length} packs, ${data.sessions.length} sessions.`);}catch(e){console.error(e);status('Backup export failed: '+e.message);}}
async function importBackup(file){if(!file)return;try{const data=await DutchTrainerBackup.read(file);const ok=window.confirm(`Restore backup from ${data.exportedAt||'unknown date'}?\n\nThis will merge ${data.vocabulary.length} words, ${data.packs.length} packs and ${data.sessions?.length||0} sessions into this browser.`);if(!ok)return;const result=await DutchTrainerBackup.import(file,{replace:false});status(`Backup restored: ${result.words} words, ${result.packs} packs, ${result.sessions} sessions.`);if(typeof getAllWords==='function')window.DutchTrainerV2VocabularyPool=await getAllWords();}catch(e){console.error(e);status('Backup restore failed: '+e.message);}}
function bind(){const out=document.getElementById('exportBackupBtn'),input=document.getElementById('importBackupInput');out?.addEventListener('click',exportBackup);input?.addEventListener('change',()=>{const f=input.files?.[0];importBackup(f).finally(()=>{input.value='';});});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
