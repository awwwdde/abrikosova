const fs=require('fs'),path=require('path');
const wb='C:/Users/Inv/.codex/skills/video-shotcraft/workbench';
for(const file of ['scripts/open.mjs','scripts/gen-index.mjs']){
const p=path.join(wb,file);let s=fs.readFileSync(p,'utf8');if(s.includes('WINDOWS_JUNCTION_COMPAT'))continue;
fs.writeFileSync(p+'.windows-original',s);
s=s.replace(/\bsymlinkSync(?=,)/,'symlinkSync as rawSymlinkSync');
s=s.replace('const wb =',`// WINDOWS_JUNCTION_COMPAT: junctions do not require Windows Developer Mode.
const symlinkSync=(target,dest)=>{const resolved=winResolve(winDirname(dest),target);if(process.platform==='win32'){if(winFs.statSync(resolved).isDirectory())return rawSymlinkSync(resolved,dest,'junction');return winFs.linkSync(resolved,dest);}return rawSymlinkSync(target,dest);};
const wb =`);
s="import * as winFs from 'node:fs';\nimport {resolve as winResolve,dirname as winDirname} from 'node:path';\n"+s.replace(/^#![^\n]*\n/,'');
if(file==='scripts/open.mjs')s=s.replace('spawnSync("npm", ["install", "--ignore-scripts"], { cwd: wb, stdio: "inherit" })','spawnSync(process.platform==="win32"?"npm.cmd":"npm", ["install", "--ignore-scripts"], { cwd: wb, stdio: "inherit",shell:process.platform==="win32",windowsHide:true })').replace('cwd: wb, detached: true, stdio:', 'cwd: wb, detached: true, windowsHide:true, stdio:');
fs.writeFileSync(p,s);
}
// ZIP downloads materialize the repository symlink as a text file on Windows.
const demo=path.join(wb,'demosrc');if(fs.existsSync(demo)&&fs.lstatSync(demo).isFile()&&fs.readFileSync(demo,'utf8').trim()==='../demos'){fs.renameSync(demo,demo+'.windows-original');fs.symlinkSync(path.resolve(wb,'../demos'),demo,'junction');}
console.log('Workbench Windows compatibility ready');
