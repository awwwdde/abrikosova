const fs=require('fs');fs.writeFileSync('src/font-data.ts',`export const forum='data:font/woff2;base64,${fs.readFileSync('public/fonts/forum.woff2').toString('base64')}';\nexport const manrope='data:font/woff2;base64,${fs.readFileSync('public/fonts/manrope.woff2').toString('base64')}';\n`);
let s=fs.readFileSync('src/Film.tsx','utf8');s=s.replace("import {PageCam} from './PageCam';","import {PageCam} from './PageCam';\nimport {loadFont} from '@remotion/fonts';\nimport {forum,manrope} from './font-data';");
const a=s.indexOf("if(typeof document!=='undefined'){");const b=s.indexOf('export const FontReady:',a);s=s.slice(0,a)+`if(typeof document!=='undefined'){
loadFont({family:'Forum',url:forum,format:'woff2',weight:'400'});
loadFont({family:'Manrope',url:manrope,format:'woff2',weight:'200 800'});
}
`+s.slice(b);fs.writeFileSync('src/Film.tsx',s);
let r=fs.readFileSync('render.cjs','utf8').replace('concurrency:2','concurrency:1,timeoutInMilliseconds:120000');fs.writeFileSync('render.cjs',r);
