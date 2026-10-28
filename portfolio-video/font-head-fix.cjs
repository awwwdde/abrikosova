const fs=require('fs');let s=fs.readFileSync('src/Film.tsx','utf8');const a=s.indexOf("if(typeof document!=='undefined'){");const b=s.indexOf('export const FontReady:',a);
s=s.slice(0,a)+`if(typeof document!=='undefined'&&!document.getElementById('brand-fonts')){
const style=document.createElement('style');style.id='brand-fonts';style.textContent="@font-face{font-family:Forum;src:url('"+forum+"') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:Manrope;src:url('"+manrope+"') format('woff2');font-weight:200 800;font-display:swap}";document.head.appendChild(style);
}
`+s.slice(b);fs.writeFileSync('src/Film.tsx',s);
let r=fs.readFileSync('render.cjs','utf8').replace("logLevel:'error',onProgress","onBrowserLog:log=>{if(log.type==='error')console.log('BROWSER',log.text)},logLevel:'error',onProgress");fs.writeFileSync('render.cjs',r);
