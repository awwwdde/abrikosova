import React,{useEffect,useState} from 'react';
import {AbsoluteFill, Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig,delayRender,continueRender} from 'remotion';
import {PageCam} from './PageCam';
import {forum,manrope} from './font-data';

export const TOTAL=1200;
export const C={cream:'#fbf7f0',accent:'#842124',ink:'#1a1210',muted:'#5a524f',line:'#e5dccb',photo:'#f2ece1'};
const ease=Easing.bezier(.25,.46,.45,.94);
export const ramp=(f:number,start:number,dur:number)=>interpolate(f,[start,start+dur],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:ease});
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const fonts=`@font-face{font-family:Forum;src:url('${staticFile('fonts/forum.woff2')}')}@font-face{font-family:Manrope;src:url('${staticFile('fonts/manrope.woff2')}');font-weight:200 800}*{box-sizing:border-box}`;

export const SHOTS=[
 {id:'hook',from:0,duration:90,title:'Сайт, который\nхочется рассматривать',sub:'Веб-кейс · Кондитерская Елены Абрикосовой'},
 {id:'home',from:90,duration:120,title:'Первый экран.\nСо вкусом.',sub:'Видео на первом экране'},
 {id:'catalog',from:210,duration:180,title:'Найти\nсвой десерт',sub:'Каталог и фильтры по составу'},
 {id:'product',from:390,duration:120,title:'Выбрать.\nВ корзину.',sub:'Состав, цена и корзина'},
 {id:'custom',from:510,duration:150,title:'Торт под\nваш повод',sub:'Дизайны и примеры работ'},
 {id:'calculator',from:660,duration:120,title:'Сколько\nнужно торта',sub:'Калькулятор веса и стоимости'},
 {id:'fillings',from:780,duration:120,title:'Начинка —\nна ваш вкус',sub:'Выбор начинки и заявка по своей идее'},
 {id:'mobile',from:900,duration:150,title:'Удобно\nс телефона',sub:'Адаптивная версия'},
 {id:'outro',from:1050,duration:150,title:'Елена\nАбрикосова',sub:'Дизайн, который ведёт к заказу'},
] as const;
export type Shot=typeof SHOTS[number];

export const SFX=[
 ...SHOTS.slice(1).filter(s=>s.id!=='product'&&s.id!=='calculator').map(s=>({from:s.from-12+3,duration:30,src:'audio/soft.mp3',volume:.18})),
 {from:SHOTS[2].from-12+96-7,duration:12,src:'audio/click.mp3',volume:.22},
 {from:SHOTS[3].from-12+74-7,duration:12,src:'audio/click.mp3',volume:.25},
 {from:SHOTS[5].from-12+48-7,duration:12,src:'audio/click.mp3',volume:.25},
];
export const MusicBed:React.FC<{volume?:number}>=({volume=.25})=><Audio src={staticFile('audio/bgm.mp3')} volume={f=>volume*ramp(f,0,24)*(1-ramp(f,TOTAL-60,60))}/>;
export const AudioBed:React.FC<{bgm?:boolean}> = ({bgm=true})=><>
 {bgm&&<MusicBed/>}
 {SFX.map((s,i)=><Sequence key={i} from={s.from} durationInFrames={s.duration}><Audio src={staticFile(s.src)} volume={s.volume}/></Sequence>)}
 </>;

if(typeof document!=='undefined'&&!document.getElementById('brand-fonts')){
const style=document.createElement('style');style.id='brand-fonts';style.textContent="@font-face{font-family:Forum;src:url('"+forum+"') format('woff2');font-weight:400;font-display:swap}@font-face{font-family:Manrope;src:url('"+manrope+"') format('woff2');font-weight:200 800;font-display:swap}";document.head.appendChild(style);
}
export const FontReady:React.FC=()=> <style>{'*{box-sizing:border-box}'}</style>;

const Kicker:React.FC<{dark?:boolean;vertical:boolean}> = ({dark,vertical})=><div style={{position:'absolute',left:vertical?72:90,top:vertical?145:64,right:vertical?150:90,display:'flex',alignItems:'center',gap:24,fontFamily:'Manrope',fontSize:32,fontWeight:500,color:dark?'#f3e5c8':C.accent,letterSpacing:3}}><span style={{height:1,width:54,background:'currentColor'}}/>ВЕБ-ДИЗАЙН <span style={{opacity:.45}}> / </span> В ДЕТАЛЯХ</div>;

const LetterTitle:React.FC<{text:string;size:number;color?:string;delay?:number}> = ({text,size,color=C.ink,delay=0})=>{const f=useCurrentFrame();return <div style={{fontFamily:'Forum',fontSize:size,lineHeight:1.02,letterSpacing:-1.4,color}}>{text.split('\n').map((line,j)=><div key={j} style={{display:'flex',flexWrap:'wrap',gap:'0 .2em'}}>{line.split(' ').map((w,i)=>{const t=interpolate(f,[delay+4+(i+j*3)*4,delay+13+(i+j*3)*4],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.2,.75,.3,1)});return <span key={i} style={{display:'inline-block',opacity:t,transform:`scale(${1.28-.28*t})`,filter:`blur(${7*(1-t)}px)`}}>{w}</span>})}</div>)}</div>};

const Browser:React.FC<{children:React.ReactNode;vertical:boolean;label?:string;dark?:boolean}> = ({children,vertical,label='www.abrikosova-elena.ru',dark})=>{const f=useCurrentFrame();const t=ramp(f,0,30);return <div style={{position:'absolute',left:vertical?68:660,top:vertical?645:198,width:vertical?850:1170,height:vertical?850:740,opacity:t,transform:`translateY(${mix(65,0,t)}px)`,boxShadow:`0 36px 80px ${dark?'#0005':'#341b1320'}`,border:`1px solid ${dark?'#f3e5c833':C.line}`,background:C.cream,overflow:'hidden'}}><div style={{height:46,borderBottom:`1px solid ${C.line}`,display:'flex',alignItems:'center',gap:9,padding:'0 21px',color:C.muted,fontFamily:'Manrope',fontSize:32,background:C.cream}}>{[0,1,2].map(i=><span key={i} style={{width:7,height:7,borderRadius:8,background:i===0?C.accent:C.line}}/>)}<span style={{margin:'0 auto',paddingRight:40}}>{label}</span></div><div style={{position:'absolute',top:46,bottom:0,left:0,right:0,overflow:'hidden',background:C.cream}}>{children}</div></div>};

const Camera:React.FC<{src:string;vertical:boolean;cx?:number;cy?:number;zoom?:number;endCx?:number;endCy?:number;endZoom?:number;duration?:number;video?:boolean;previousSrc?:string;at?:number}> = ({src,vertical,cx=960,cy=540,zoom=.60,endCx=cx,endCy=cy,endZoom=zoom,duration=100,video,previousSrc,at=0})=>{
 const f=useCurrentFrame();const t=ramp(f,8,Math.max(25,duration-35));const z=mix(zoom,endZoom,t),x=mix(cx,endCx,t),y=mix(cy,endCy,t);const w=vertical?850:1170,h=vertical?804:694;
 return <div style={{position:'absolute',inset:0,overflow:'hidden'}}>{video?<div style={{position:'absolute',width:1920,height:1080,transformOrigin:'0 0',transform:`translate(${w/2-x*z}px,${h/2-y*z}px) scale(${z})`}}><OffthreadVideo muted src={staticFile('hero.mp4')} style={{position:'absolute',width:1920,height:1080,objectFit:'cover'}}/><Img src={staticFile('textures/hero-overlay.png')} style={{position:'absolute',width:1920,height:1080}}/></div>:<div style={{position:'absolute',width:1920,height:1080,left:w/2-960,top:h/2-540}}>{previousSrc&&<PageCam src={`textures/${previousSrc}.png`} pageH={1080} keys={[{frame:0,cx:x,cy:y,zoom:z}]}/>}<AbsoluteFill style={{opacity:previousSrc?ramp(f,at,12):1}}><PageCam src={`textures/${src}.png`} pageH={1080} keys={[{frame:0,cx:x,cy:y,zoom:z}]}/></AbsoluteFill></div>}</div>;
};

const Cursor:React.FC<{x:number;y:number;at:number;vertical:boolean}> = ({x,y,at,vertical})=>{const f=useCurrentFrame();const t=ramp(f,at-16,16);const ring=ramp(f,at,15);return <div style={{position:'absolute',left:x+mix(100,0,t),top:y+mix(80,0,t),opacity:ramp(f,at-20,7)*(1-ramp(f,at+18,10)),pointerEvents:'none'}}><svg width={vertical?46:35} height={vertical?58:44} viewBox="0 0 28 36"><path d="M3 2L25 23L15 24L10 33Z" fill={C.accent} stroke={C.cream} strokeWidth="2"/></svg><div style={{position:'absolute',width:100,height:100,left:-50,top:-50,border:`3px solid ${C.accent}`,borderRadius:'50%',transform:`scale(${.2+ring})`,opacity:1-ring}}/></div>};

const Multiplane:React.FC<{vertical:boolean}> = ({vertical})=>{const f=useCurrentFrame();const drive=interpolate(f,[6,41],[0,vertical?929:690],{extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.45,0,.18,1)});const lift=ramp(f,41,12);return <div style={{position:'absolute',inset:0,overflow:'hidden',background:C.photo}}>
 <Img src={staticFile('textures/catalog.png')} style={{position:'absolute',width:1600,left:-drive*.35,top:-200,filter:'blur(5px) saturate(.7)',opacity:.17}}/>
 <div style={{position:'absolute',inset:0,background:'linear-gradient(180deg,#fbf7f0e0,#fbf7f020)'}}/>
 {[0,1,2,3].map((k)=><div key={k} style={{position:'absolute',width:vertical?390:370,left:60+k*410-drive*.7,top:vertical?160:90,transform:`translateY(${k===2?-12*lift:0}px) scale(${k===2?1+.035*lift:1})`,boxShadow:'0 18px 34px #341b1325',outline:k===2?`2px solid ${C.accent}`:undefined,overflow:'hidden'}}><Img src={staticFile(`textures/card${k}.png`)} style={{display:'block',width:'100%'}}/></div>)}
 <div style={{position:'absolute',left:1180-drive*1.4,top:vertical?640:540,padding:'15px 40px',borderRadius:80,background:C.accent,color:C.cream,fontFamily:'Manrope',fontSize:40,filter:'blur(7px)'}}>Без глютена</div>
 </div>};

const FilteredResult:React.FC<{vertical:boolean}>=({vertical})=>{const f=useCurrentFrame();return <AbsoluteFill style={{background:C.cream,alignItems:'center',justifyContent:'center'}}><Img src={staticFile('textures/card2.png')} style={{height:'92%',width:'auto',display:'block',boxShadow:'0 14px 35px #341b1315',transform:'translateY('+mix(18,0,ramp(f,126,16))+'px)'}}/></AbsoluteFill>;};

const Phones:React.FC<{vertical:boolean}> = ({vertical})=>{const f=useCurrentFrame();return <>{['mobile-home','mobile-catalog','mobile-product'].map((src,i)=>{const t=ramp(f,i*12,36);const x=vertical?[65,329,593][i]:[700,1065,1430][i];const w=vertical?294:308;return <div key={src} style={{position:'absolute',left:x,top:(vertical?675:250)+(i===1?-40:20),width:w,height:w*900/430+26,borderRadius:36,overflow:'hidden',background:C.ink,padding:8,boxShadow:'0 32px 50px #341b1330',transform:`translateY(${mix(160,0,t)}px) rotate(${mix(i===0?-8:i===2?8:0,0,t)}deg)`,opacity:t}}><Img src={staticFile(`textures/${src}.png`)} style={{width:'100%',borderRadius:27,display:'block'}}/></div>})}</>};

export const Scene:React.FC<{id?:string;title?:string;sub?:string;duration?:number;vertical?:boolean}>=({id='home',title,sub,duration,vertical:propVertical})=>{
 const f=useCurrentFrame();const {width}=useVideoConfig();const vertical=propVertical??width===1080;const shot=SHOTS.find(s=>s.id===id)??SHOTS[1];title=title??shot.title;sub=sub??shot.sub;duration=duration??shot.duration;
 const dark=id==='outro';const fade=1;
 if(id==='hook')return <AbsoluteFill style={{background:C.cream,opacity:fade,overflow:'hidden'}}><FontReady/><Kicker vertical={vertical}/><div style={{position:'absolute',left:vertical?72:92,top:vertical?295:250,width:vertical?820:1010,zIndex:3}}><LetterTitle text={vertical?'Сайт, который\nхочется\nрассматривать':'Сайт, который\nхочется рассматривать'} size={vertical?111:145}/><div style={{marginTop:35,width:180,height:4,background:C.accent,transformOrigin:'left',transform:`scaleX(${ramp(f,27,20)})`}}/></div><div style={{position:'absolute',left:vertical?270:1250,top:vertical?895:200,width:vertical?620:520,height:vertical?620:640,background:C.photo,transform:`translateY(${mix(120,0,ramp(f,8,38))}px) rotate(${mix(9,-5,ramp(f,8,55))}deg)`,overflow:'hidden',boxShadow:'0 38px 90px #341b1328'}}><Img src={staticFile('textures/card2.png')} style={{width:'100%'}}/></div><div style={{position:'absolute',left:vertical?72:94,bottom:vertical?270:135,fontFamily:'Manrope',fontSize:vertical?33:30,color:C.muted,lineHeight:1.45,width:vertical?660:900,opacity:ramp(f,24,20)}}>Кондитерская Елены Абрикосовой<br/><span style={{color:C.accent}}>Дизайн · Каталог · Онлайн-заказ</span></div></AbsoluteFill>;
 if(id==='outro')return <AbsoluteFill style={{background:C.accent,color:C.cream,overflow:'hidden'}}><FontReady/><Kicker dark vertical={vertical}/>{['catalog','custom','mobile-catalog'].map((src,i)=>{const t=ramp(f,4+i*6,42);return <div key={src} style={{position:'absolute',left:vertical?[30,695,100][i]:[70,1460,1210][i],top:vertical?[1050,1030,1360][i]:[490,340,750][i],width:vertical?[290,260,220][i]:[370,340,220][i],height:vertical?250:220,opacity:.4*t,overflow:'hidden',transform:`translateY(${mix(110,0,t)}px) rotate(${[-9,8,-5][i]}deg)`}}><Img src={staticFile(`textures/${src}.png`)} style={{width:'100%'}}/></div>})}<div style={{position:'absolute',left:vertical?72:480,top:vertical?380:270,width:vertical?840:1000,textAlign:'left'}}><LetterTitle text={title} size={vertical?145:174} color={C.cream}/><div style={{height:2,width:200,background:C.cream,marginTop:38,transformOrigin:'left',transform:`scaleX(${ramp(f,26,30)})`}}/><div style={{fontFamily:'Manrope',fontSize:vertical?48:47,lineHeight:1.3,marginTop:38,maxWidth:850,opacity:ramp(f,30,22)}}>{sub}</div><div style={{fontFamily:'Manrope',fontSize:vertical?38:40,marginTop:36,opacity:ramp(f,45,22),color:'#f3e5c8'}}>www.abrikosova-elena.ru</div></div><div style={{position:'absolute',bottom:vertical?270:80,left:vertical?72:90,fontFamily:'Manrope',fontSize:32,letterSpacing:2,color:'#f3e5c8',opacity:ramp(f,55,20)}}>САЙТ В ДЕТАЛЯХ · ПОРТФОЛИО</div></AbsoluteFill>;
 return <AbsoluteFill style={{background:C.cream,opacity:fade,overflow:'hidden'}}><FontReady/><Kicker vertical={vertical}/>
 <div style={{position:'absolute',left:vertical?72:90,top:vertical?260:272,width:vertical?830:510,zIndex:4}}><div style={{fontFamily:'Manrope',fontSize:vertical?29:23,color:C.accent,letterSpacing:3,marginBottom:vertical?25:28}}>0{SHOTS.indexOf(shot)} <span style={{display:'inline-block',height:1,width:60,background:C.accent,verticalAlign:'middle',marginLeft:15}}/></div><LetterTitle text={title} size={vertical?93:id==='calculator'?89:95}/><div style={{fontFamily:'Manrope',fontSize:vertical?34:32,lineHeight:1.45,color:C.muted,marginTop:30,maxWidth:vertical?800:490,opacity:ramp(f,22,20)}}>{sub}</div></div>
 {id==='mobile'?<Phones vertical={vertical}/>:<Browser vertical={vertical} label={id==='product'&&f>=74?'www.abrikosova-elena.ru/cart':undefined}>
 {id==='home'&&<Camera src="home" vertical={vertical} zoom={vertical?.44:.60} endZoom={vertical?.44:.61} cx={960} endCx={960} video duration={duration}/>}
 {id==='catalog'&&(f<68?<Multiplane vertical={vertical}/>:f<126?<Camera src={f<96?'filters':'filters-selected'} previousSrc={f>=96?'filters':undefined} at={96} vertical={vertical} zoom={vertical?1.04:.85} cx={vertical?1550:1260} cy={vertical?390:405} endZoom={vertical?1.08:.90} duration={60}/>:<FilteredResult vertical={vertical}/>)}
 {id==='product'&&(f<74?<Camera src="product" vertical={vertical} zoom={vertical?.96:.82} cx={vertical?690:830} cy={520} endCx={vertical?1030:880} endZoom={vertical?1.02:.86} duration={74}/>:<Camera src="cart" vertical={vertical} zoom={vertical?.44:.60} cx={960} cy={540} duration={46}/>)}
 {id==='custom'&&<Camera src={f<85?'custom':'gallery'} previousSrc={f>=85?'custom':undefined} at={85} vertical={vertical} zoom={vertical?1:.83} cx={vertical?1080:1170} cy={f<85?700:700} endCx={vertical?1250:1280} endZoom={vertical?1.04:.87} duration={150}/>}
 {id==='calculator'&&<Camera src={f<48?'calculator20':'calculator40'} previousSrc={f>=48?'calculator20':undefined} at={48} vertical={vertical} zoom={vertical?1.5:1.6} cx={vertical?1500:1470} cy={vertical?350:300} endZoom={vertical?1.53:1.64} duration={120}/>}
 {id==='fillings'&&<Camera src={f<65?'fillings':'request'} vertical={vertical} zoom={f<65?(vertical?1:.82):(vertical?1.16:1)} cx={f<65?(vertical?600:960):(vertical?1610:1410)} cy={f<65?600:485} duration={120}/>}
 {id==='catalog'&&f>=68&&f<126&&<Cursor vertical={vertical} x={vertical?200:656} y={vertical?410:325} at={94}/>}
 {id==='calculator'&&<Cursor vertical={vertical} x={vertical?175:370} y={vertical?200:215} at={47}/>}
 </Browser>}
 <div style={{position:'absolute',left:vertical?72:90,right:vertical?155:90,bottom:vertical?250:65,display:'flex',justifyContent:'space-between',alignItems:'center',fontFamily:'Manrope',fontSize:32,color:C.muted}}><span>Елена Абрикосова</span><span style={{color:C.accent}}>ВЕБ-КЕЙС</span></div>
 </AbsoluteFill>;
};

export const CLIPS=SHOTS.map((s,i)=>({...s,from:Math.max(0,s.from-12),duration:s.duration+(i===0?0:12)}));
export const ShotUnit:React.FC<React.ComponentProps<typeof Scene>>=(props)=>{const f=useCurrentFrame();return <AbsoluteFill style={{opacity:props.id==='hook'?1:ramp(f,0,12)}}><Scene {...props}/></AbsoluteFill>;};
export const Film:React.FC<{bgm?:boolean}>=({bgm=true})=><AbsoluteFill style={{background:C.cream}}>{CLIPS.map(s=><Sequence key={s.id} from={s.from} durationInFrames={s.duration}><ShotUnit {...s}/></Sequence>)}<AudioBed bgm={bgm}/></AbsoluteFill>;
