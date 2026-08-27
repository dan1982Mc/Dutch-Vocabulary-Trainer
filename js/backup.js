/* Dutch Vocabulary Trainer V2.3 - user backup and restore. */
(function(){'use strict';
function stamp(){return new Date().toISOString().replace(/[:.]/g,'-');}
async function exportBackup(){if(!window.DutchTrainerDB?.export)throw new Error('Backup API is not available.');const data=await DutchTrainerDB.export();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`dutch-vocabulary-trainer-backup-${stamp()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);return data;}
async function readBackupFile(file){if(!file)throw new Error('Please choose a backup file.');const text=await file.text();let data;try{data=JSON.parse(text);}catch(e){throw new Error('The selected file is not valid JSON.');}if(!data||typeof data!=='object'||!Array.isArray(data.vocabulary)||!Array.isArray(data.packs))throw new Error('This is not a valid Dutch Vocabulary Trainer backup.');return data;}
async function importBackup(file,options={}){const data=await readBackupFile(file);return DutchTrainerDB.import(data,options);}
window.DutchTrainerBackup=Object.freeze({export:exportBackup,read:readBackupFile,import:importBackup});
})();
