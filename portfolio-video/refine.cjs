const fs=require('fs');const p='src/Film.tsx';let s=fs.readFileSync(p,'utf8');
s=s.replace("import React from 'react';","import React,{useEffect,useState} from 'react';").replace('useVideoConfig} from','useVideoConfig,delayRender,continueRender} from');
for(const [a,b] of [
 ['Первое впечатление —\\nсо вкусом','Первый экран.\\nСразу со вкусом.'],
 ['От выбора —\\nк заказу','Выбрать.\\nВ корзину.'],
 ['Торт\\nпод ваш повод','Торт под\\nваш повод'],
 ['Гостей больше?\\nСайт посчитает','Сколько\\nнужно торта'],
 ['Выбрать вкус.\\nОписать идею.','Начинка —\\nна ваш вкус'],
 ['Начинки и заявка на торт','Выбор начинки и заявка по своей идее'],
 ['Так же удобно\\nс телефона','Удобно\\nс телефона'],
 ["id==='calculator'?89:103","id==='calculator'?89:95"],
 ['zoom={vertical?.78:.65} endZoom={vertical?.82:.68}','zoom={vertical?.78:.60} endZoom={vertical?.82:.61}'],
 ['cy={vertical?450:450}','cy={vertical?390:405}'],
 ['x={vertical?620:820} y={vertical?300:280}','x={vertical?200:656} y={vertical?410:325}'],
 ])s=s.replace(a,b);
s=s.replaceAll('<style>{fonts}</style>','<FontReady/>');
s=s.replace('const Kicker:',`export const FontReady:React.FC=()=>{const [handle]=useState(()=>delayRender('Brand fonts'));useEffect(()=>{Promise.all([document.fonts.load('400 90px Forum'),document.fonts.load('400 32px Manrope'),document.fonts.load('500 28px Manrope')]).then(()=>document.fonts.ready).then(()=>continueRender(handle));},[handle]);return <style>{fonts}</style>;};
\nconst Kicker:`);
fs.writeFileSync(p,s);
