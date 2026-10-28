const fs=require('fs'),path=require('path');const wb='C:/Users/Inv/.codex/skills/video-shotcraft/workbench';let s=fs.readFileSync(path.join(wb,'scripts/parity.mjs'),'utf8');
s=s.replaceAll('"python3"','"python"');
const a='const rs = spawnSync("rsync", ["-aL", "--delete", "--exclude=cardpreviews", "public/", `${renderPublic}/`], { cwd: wb, stdio: "inherit" });';
const b='const rs = spawnSync(process.execPath, ["-e", "require(\'fs\').cpSync(\'public\',\'.render-public\',{recursive:true,dereference:true,filter:p=>!p.includes(\'cardpreviews\')})"], { cwd: wb, stdio: "inherit",windowsHide:true });';
if(!s.includes(a))throw Error('parity sync anchor missing');s=s.replace(a,b);
s=s.replace('selectComposition({ serveUrl, id, inputProps: {} })','selectComposition({ serveUrl, id, inputProps: {},browserExecutable:"C:/Program Files/Google/Chrome/Application/chrome.exe",chromeMode:"chrome-for-testing" })');
s=s.replace('imageFormat: "png", chromiumOptions:', 'imageFormat: "png",browserExecutable:"C:/Program Files/Google/Chrome/Application/chrome.exe",chromeMode:"chrome-for-testing", chromiumOptions:');
fs.writeFileSync(path.join(wb,'scripts/parity-windows.mjs'),s);console.log('Windows parity script ready');
