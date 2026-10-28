const fs=require('fs');let s=fs.readFileSync('src/Film.tsx','utf8');
const start=s.indexOf('export const FontReady:');const end=s.indexOf('const Kicker:',start);
s=s.slice(0,start)+`if(typeof document!=='undefined'){
 const fontHandle=delayRender('Persistent brand font loading');
 Promise.all([new FontFace('Forum',"url("+staticFile('fonts/forum.woff2')+")"),new FontFace('Manrope',"url("+staticFile('fonts/manrope.woff2')+")",{weight:'200 800'})].map(async face=>{await face.load();document.fonts.add(face);})).then(()=>continueRender(fontHandle));
}
export const FontReady:React.FC=()=> <style>{'*{box-sizing:border-box}'}</style>;
\n`+s.slice(end);
s=s.replace('const SFX=','const SFX=');
const sf0=s.indexOf('export const SFX=');const sf1=s.indexOf('export const AudioBed',sf0);
s=s.slice(0,sf0)+`export const SFX=[
 ...SHOTS.slice(1).filter(s=>s.id!=='product'&&s.id!=='calculator').map(s=>({from:s.from-12+3,duration:30,src:'audio/soft.mp3',volume:.18})),
 {from:SHOTS[2].from-12+96,duration:12,src:'audio/click.mp3',volume:.22},
 {from:SHOTS[3].from-12+74,duration:12,src:'audio/click.mp3',volume:.25},
 {from:SHOTS[5].from-12+48,duration:12,src:'audio/click.mp3',volume:.25},
];
`+s.slice(sf1);
s=s.replace('x={vertical?480:590} y={vertical?250:250}','x={vertical?175:370} y={vertical?200:215}');
s=s.replace('zoom={vertical?.78:.60} endZoom={vertical?.82:.61} cx={vertical?800:960} endCx={vertical?850:960}','zoom={vertical?.44:.60} endZoom={vertical?.44:.61} cx={960} endCx={960}');
s=s.replace('zoom={vertical?1.1:.92} cx={vertical?630:1060} cy={480}','zoom={vertical?.44:.60} cx={960} cy={540}');
s=s.replace('zoom={vertical?1:.76} cx={vertical?420:800} cy={620} endZoom={vertical?1.04:.79}','zoom={vertical?1.45:1.35} cx={vertical?290:400} cy={640} endZoom={vertical?1.48:1.38}');
s=s.replace('const drive=interpolate(f,[6,56],[0,690]','const drive=interpolate(f,[6,41],[0,vertical?929:690]');
s=s.replace('const lift=ramp(f,51,12)','const lift=ramp(f,41,12)');
s=s.replace("[{frame:0,cx:x,cy:y,zoom:z},{frame:2000,cx:x,cy:y,zoom:z}]","[{frame:0,cx:x,cy:y,zoom:z},{frame:2000,cx:x,cy:y,zoom:z}]");
fs.writeFileSync('src/Film.tsx',s);
fs.appendFileSync('DESIGN.md','\nНезависимый предэкспортный QA: вертикальный hero и корзина отдалены для целостности UI; результат фильтра укрупнён на карточке с полноценным фото; multiplane заканчивает движение на f41, подъём на f53, затем ≥15f hold. PaperTitleCard используется как авторская типографическая адаптация, без обещания точного повтора italic/accent. Clicks привязаны к реальным сменам состояний (фильтр f294, корзина f452, калькулятор f696), а не началу сцены.\n');
