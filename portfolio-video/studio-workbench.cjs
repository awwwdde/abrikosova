const fs=require('fs'),path=require('path'),cp=require('child_process');const wb='C:/Users/Inv/.codex/skills/video-shotcraft/workbench';
const target=path.join(wb,'public/studio');if(!fs.existsSync(target))fs.symlinkSync(path.resolve('public/studio'),target,'junction');
let r=cp.spawnSync(process.execPath,['scripts/gen-index.mjs'],{cwd:wb,stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error('Workbench generation');
console.log('Studio V2 connected to localhost:5198/?import=project');
