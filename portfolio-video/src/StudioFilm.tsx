import React from 'react';
import {AbsoluteFill,Audio,Img,OffthreadVideo,Sequence,Freeze,staticFile,useCurrentFrame,useVideoConfig,interpolate,Easing} from 'remotion';
import {forum,manrope} from './font-data';
import layout from '../public/studio/layout.json';
import detail from '../public/studio/detail-layout.json';
import interaction from '../public/studio/interactions.json';
import {MUSIC} from './studio-music';

if(typeof document!=='undefined'&&!document.getElementById('studio-fonts')){const tag=document.createElement('style');tag.id='studio-fonts';tag.textContent=`@font-face{font-family:Forum;src:url('${forum}') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:Manrope;src:url('${manrope}') format('woff2');font-weight:200 800;font-display:swap}*{box-sizing:border-box}`;document.head.appendChild(tag);}
export const PALETTE={cream:'#fbf7f0',accent:'#842124',ink:'#1a1210',muted:'#5a524f',line:'#e5dccb'};
type Box={x:number;y:number;w:number;h:number};
const sizes=Object.fromEntries(Object.entries({...layout,...detail}).filter(([,v])=>'w' in v&&'h' in v)) as Record<string,{w:number;h:number}>;
const motion=Easing.bezier(.55,0,.18,1);
export const B=(n:number)=>Math.round(n*MUSIC.T*30);
export const STUDIO_TOTAL=B(64);
const progress=(f:number,a:number,d:number)=>interpolate(f,[a,a+d],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:motion});
const mix=(a:number,b:number,p:number)=>a+(b-a)*p;
export const STUDIO_SHOTS=[
 {id:'hero',from:B(0),duration:B(6),title:'Сайт со вкусом.',label:'Первый экран'},
 {id:'catalog',from:B(6),duration:B(18)-B(6),title:'Каталог. Точный выбор.',label:'Каталог и фильтры'},
 {id:'product',from:B(18),duration:B(26)-B(18),title:'Состав. Цена. В корзину.',label:'Карточка и корзина'},
 {id:'custom',from:B(26),duration:B(34)-B(26),title:'Под ваш повод.',label:'Торты на заказ'},
 {id:'calculator',from:B(34),duration:B(42)-B(34),title:'Гостей больше? Сайт посчитает.',label:'Калькулятор'},
 {id:'request',from:B(42),duration:B(50)-B(42),title:'Своя идея. Заявка онлайн.',label:'Индивидуальная заявка'},
 {id:'adaptive',from:B(50),duration:B(56)-B(50),title:'Удобно на любом экране.',label:'Адаптив'},
 {id:'outro',from:B(56),duration:B(64)-B(56),title:'Елена Абрикосова',label:'Финал'},
] as const;
export const STUDIO_CLIPS=STUDIO_SHOTS.map(s=>({...s}));
export function assetBox(name:string,box:Box):Box{const s=sizes[name];if(!s?.w||!s?.h)throw Error('No asset dimensions: '+name);const k=Math.min(box.w/s.w,box.h/s.h);return{x:box.x+(box.w-s.w*k)/2,y:box.y+(box.h-s.h*k)/2,w:s.w*k,h:s.h*k};}
const Pic:React.FC<{name:string;box:Box;start?:number;animated?:boolean}> = ({name,box,start=0,animated=true})=>{const f=useCurrentFrame();const r=assetBox(name,box);const t=animated?progress(f,start,22):1;return <Img data-ui={name} src={staticFile(`studio/${name}.png`)} style={{position:'absolute',left:r.x,top:r.y+24*(1-t),width:r.w,height:r.h,opacity:t,display:'block'}}/>;};
const Type:React.FC<{text:string;size:number;frame:number;serif?:boolean;color?:string}> = ({text,size,frame,serif=true,color=PALETTE.ink})=><div style={{fontFamily:serif?'Forum':'Manrope',fontSize:size,lineHeight:1.04,fontWeight:serif?400:600,letterSpacing:serif?-1.2:-2,color}}>{text.split('\n').map((line,i)=><div key={i} style={{transform:`translateY(${18*(1-progress(frame,i*3,16))}px)`,opacity:progress(frame,i*3,16),whiteSpace:'nowrap'}}>{line}</div>)}</div>;
const Cursor:React.FC<{box:Box;point:{x:number;y:number};native:{w:number;h:number};click:number}> = ({box,point,native,click})=>{const f=useCurrentFrame();const t=progress(f,click-16,16),r=progress(f,click,18);const x=box.x+point.x/native.w*box.w,y=box.y+point.y/native.h*box.h;return <div style={{position:'absolute',left:x+65*(1-t),top:y+45*(1-t),opacity:progress(f,click-20,5)*(1-progress(f,click+20,5)),pointerEvents:'none'}}><svg width="38" height="48" viewBox="0 0 28 36"><path d="M3 2L25 23L15 24L10 33Z" fill={PALETTE.accent} stroke={PALETTE.cream} strokeWidth="2"/></svg><div style={{position:'absolute',left:-35,top:-35,width:70,height:70,border:`2px solid ${PALETTE.accent}`,borderRadius:'50%',transform:`scale(${.3+r*1.2})`,opacity:f<click?0:1-r}}/></div>};
const Chrome:React.FC<{vertical:boolean;number:number;dark?:boolean}> = ({vertical,number,dark})=><>
 <div style={{position:'absolute',left:vertical?70:90,right:vertical?130:90,top:vertical?142:43,fontFamily:'Manrope',fontSize:vertical?29:31,fontWeight:500,color:dark?'#f3e5c8':PALETTE.accent,display:'flex',justifyContent:'space-between',letterSpacing:1.8}}><span>ЕЛЕНА АБРИКОСОВА</span><span>{vertical?'ВЕБ-КЕЙС':`ВЕБ-КЕЙС / 0${number}`}</span></div>
 <div style={{position:'absolute',left:vertical?70:90,right:vertical?130:90,bottom:vertical?175:42,fontFamily:'Manrope',fontSize:32,color:dark?'#f3e5c8':PALETTE.muted,display:'flex',justifyContent:vertical?'center':'space-between'}}>{!vertical&&<span>Дизайн и разработка</span>}<span>www.abrikosova-elena.ru</span></div>
 </>;

export const StudioScene:React.FC<{id?:string;title?:string;duration?:number;vertical?:boolean}>=({id='hero',title,duration,vertical:forced})=>{
 const f=useCurrentFrame();const {width}=useVideoConfig();const vertical=forced??width===1080;const mode=vertical?'mobile':'desktop';const shot=STUDIO_SHOTS.find(s=>s.id===id)??STUDIO_SHOTS[0];const n=STUDIO_SHOTS.indexOf(shot)+1;duration=duration??shot.duration;
 const area:Box=vertical?{x:70,y:520,w:880,h:1120}:{x:90,y:280,w:1740,h:680};
 const heading=title&&title!==shot.title?title:(vertical?({hero:'Сайт со вкусом.',catalog:'Каталог.\nТочный выбор.',product:'Состав. Цена.\nВ корзину.',custom:'Под ваш повод.',calculator:'Гостей больше?\nСайт посчитает.',request:'Своя идея.\nЗаявка онлайн.',adaptive:'Удобно\nна любом экране.',outro:'Елена\nАбрикосова'} as Record<string,string>)[id]:shot.title);
 const groupName=f>=B(6)?'diet-group-selected':'diet-group';
 const calcName=`${mode}-calculator${f>=B(4)?40:20}`;
 if(id==='outro')return <AbsoluteFill style={{background:PALETTE.accent}}><Chrome vertical={vertical} number={n} dark/><div style={{position:'absolute',left:vertical?70:90,top:vertical?570:330,right:vertical?130:90}}><Type text={vertical?'Елена\nАбрикосова':'Елена Абрикосова'} size={vertical?143:164} frame={f} color={PALETTE.cream}/><div style={{height:2,width:240,background:PALETTE.cream,marginTop:44,transformOrigin:'left',transform:`scaleX(${progress(f,22,24)})`}}/><div style={{font:'400 '+(vertical?40:46)+'px Manrope',color:PALETTE.cream,marginTop:36,opacity:progress(f,25,18),lineHeight:1.5}}>Дизайн · Разработка · Адаптив</div><div style={{font:'500 '+(vertical?46:56)+'px Manrope',color:PALETTE.cream,marginTop:40,opacity:progress(f,30,18)}}>www.abrikosova-elena.ru</div></div></AbsoluteFill>;
 return <AbsoluteFill style={{background:PALETTE.cream}}><Chrome vertical={vertical} number={n}/>
 <div style={{position:'absolute',left:vertical?70:90,right:vertical?130:90,top:vertical?232:119}}><Type text={heading} size={vertical?(id==='hero'?98:94):(id==='calculator'?95:106)} frame={id==='hero'?f+18:f}/></div>
 {id==='hero'&&(()=>{const target=vertical?{x:70,y:400,w:880,h:1260}:{x:90,y:265,w:1740,h:710};if(vertical)return <Pic name="mobile-home" box={target} animated={false}/>;const r=assetBox(mode+'-home',target);return <div data-ui="live-home" style={{position:'absolute',left:r.x,top:r.y,width:r.w,height:r.h,overflow:'hidden'}}><OffthreadVideo src={staticFile('hero.mp4')} startFrom={150} muted style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover'}}/><Img src={staticFile(`studio/${mode}-home-overlay.png`)} style={{position:'absolute',width:'100%',height:'100%'}}/></div>})()}
 {id==='catalog'&&f<B(4)&&[0,1,...(vertical?[]:[2,3])].map((i)=>{const count=vertical?2:4,gap=vertical?30:34,w=(area.w-gap*(count-1))/count;return <Pic key={i} name={`${mode}-card${i}`} box={{x:area.x+i*(w+gap),y:area.y,w,h:area.h}} start={i*3}/>})}
 {id==='catalog'&&f>=B(4)&&f<B(8)&&(()=>{const groupArea=vertical?{x:70,y:695,w:880,h:640}:{x:715,y:320,w:1000,h:620};const r=assetBox(groupName,groupArea);return <>{!vertical&&<Pic name="desktop-card2" box={{x:160,y:280,w:440,h:680}} animated={false}/>}<Pic name={groupName} box={groupArea} animated={false}/><Cursor box={r} point={detail['diet-target']} native={detail['diet-group']} click={B(6)}/></>})()}
 {id==='catalog'&&f>=B(8)&&<><Pic name="tag-macro" box={vertical?{x:70,y:460,w:500,h:100}:{x:715,y:280,w:500,h:100}} animated={false}/>{vertical?<Pic name="mobile-filtered-card" box={{x:70,y:580,w:880,h:1060}} animated={false}/>:<><Pic name="desktop-filtered-card" box={{x:160,y:280,w:480,h:680}} animated={false}/><Pic name="diet-group-selected" box={{x:715,y:410,w:1000,h:480}} animated={false}/></>}</>}
 {id==='product'&&f<B(4)&&(()=>{const key=mode+'-summary',r=assetBox(key,area);const point=interaction[(mode+'-buy') as keyof typeof interaction];return <>{vertical?<Pic name={key} box={area}/>:<Pic name="desktop-product-block" box={area}/>}<Cursor box={vertical?r:assetBox('desktop-product-block',area)} point={vertical?point:{x:point.x+744,y:point.y}} native={vertical?sizes[key]:sizes['desktop-product-block']} click={B(4)}/></>})()}
 {id==='product'&&f>=B(4)&&<>{vertical?<Pic name="mobile-cart-summary" box={area} animated={false}/>:<><Pic name="desktop-card2" box={{x:230,y:280,w:420,h:680}} animated={false}/><Pic name="desktop-cart-summary" box={{x:850,y:300,w:800,h:640}} animated={false}/></>}</>}
 {id==='custom'&&[1,2,...(vertical?[]:[3])].map((i)=>{const count=vertical?2:3,gap=vertical?30:60,w=(area.w-gap*(count-1))/count;return <Pic key={i} name={'design'+i} box={{x:area.x+(i-1)*(w+gap),y:area.y,w,h:area.h}} start={(i-1)*4}/>})}
 {id==='calculator'&&(()=>{const key=vertical?calcName:(f>=B(4)?'calc-padded40':'calc-padded20');const box=vertical?area:{x:270,y:300,w:1380,h:650};const r=assetBox(key,box);return <><Pic name={key} box={box}/><Cursor box={r} point={vertical?{x:79.5,y:213}:{x:82,y:81}} native={sizes[key]} click={B(4)}/></>})()}
 {id==='request'&&<><Pic name="desktop-form-date" box={vertical?{x:70,y:520,w:880,h:635}:{x:130,y:300,w:760,h:620}}/><Pic name="desktop-form-filling" box={vertical?{x:70,y:1170,w:880,h:467}:{x:1030,y:300,w:760,h:620}} start={4}/></>}
 {id==='adaptive'&&<>{vertical?<><Pic name="desktop-catalog" box={{x:70,y:520,w:880,h:410}}/><Pic name="mobile-catalog" box={{x:235,y:1000,w:550,h:640}} start={6}/></>:<><Pic name="desktop-catalog" box={{x:90,y:290,w:1220,h:660}}/><Pic name="mobile-catalog" box={{x:1440,y:280,w:390,h:680}} start={6}/></>}</>}
 </AbsoluteFill>;
};
export const StudioUnit:React.FC<React.ComponentProps<typeof StudioScene>>=(props)=>{const f=useCurrentFrame();const i=STUDIO_SHOTS.findIndex(s=>s.id===props.id);const previous=i>0?STUDIO_SHOTS[i-1]:null;return <AbsoluteFill>{previous&&f<14&&<Freeze frame={previous.duration-1}><StudioScene {...previous} vertical={props.vertical}/></Freeze>}<AbsoluteFill style={{clipPath:previous&&f<14?`inset(0 ${(1-progress(f,0,14))*100}% 0 0)`:undefined}}><StudioScene {...props}/></AbsoluteFill></AbsoluteFill>};
export const STUDIO_SFX=[...STUDIO_SHOTS.slice(1).map(s=>({from:s.from-8,duration:24,src:'audio/soft.mp3',volume:.13})),...[12,22,38].map(beat=>({from:B(beat)-7,duration:12,src:'audio/click.mp3',volume:.23}))];
export const StudioMusicBed:React.FC<{volume?:number}>=({volume=.30})=><Audio src={staticFile('audio/bgm.mp3')} startFrom={Math.round(MUSIC.beat0_source_sec*30)} volume={f=>volume*progress(f,0,6)*(1-progress(f,STUDIO_TOTAL-48,48))}/>;
export const StudioAudio:React.FC<{bgm?:boolean}>=({bgm=true})=><>{bgm&&<StudioMusicBed/>}{STUDIO_SFX.map((s,i)=><Sequence key={i} from={s.from} durationInFrames={s.duration}><Audio src={staticFile(s.src)} volume={s.volume}/></Sequence>)}</>;
export const StudioFilm:React.FC<{bgm?:boolean}>=({bgm=true})=><AbsoluteFill style={{background:PALETTE.cream}}>{STUDIO_CLIPS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}><StudioUnit {...s}/></Sequence>)}<StudioAudio bgm={bgm}/></AbsoluteFill>;
