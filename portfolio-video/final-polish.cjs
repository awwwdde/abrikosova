const fs=require('fs');const p='src/Film.tsx';let s=fs.readFileSync(p,'utf8');
s=s.replace('fontSize:vertical?28:25','fontSize:32').replace('fontSize:18,background:C.cream','fontSize:32,background:C.cream').replace('fontSize:vertical?27:24','fontSize:32').replace('fontSize:vertical?28:24','fontSize:32');
const anchor='const Phones:';
s=s.replace(anchor,`const FilteredResult:React.FC<{vertical:boolean}>=({vertical})=>{const f=useCurrentFrame();return <AbsoluteFill style={{background:C.cream,alignItems:'center',justifyContent:'center'}}><div style={{fontFamily:'Manrope',fontSize:32,color:C.accent,marginBottom:18}}>Без глютена · результат фильтра</div><Img src={staticFile('textures/card2.png')} style={{width:vertical?490:410,display:'block',boxShadow:'0 14px 35px #341b1315',transform:'translateY('+mix(18,0,ramp(f,126,16))+'px)'}}/></AbsoluteFill>;};
\n`+anchor);
const old='<Camera src="filtered" vertical={vertical} zoom={vertical?1.45:1.35} cx={vertical?290:400} cy={640} endZoom={vertical?1.48:1.38} duration={60}/>';
if(!s.includes(old))throw Error('filtered anchor missing');s=s.replace(old,'<FilteredResult vertical={vertical}/>');fs.writeFileSync(p,s);
fs.appendFileSync('DESIGN.md','\nРезультат фильтра показывает подлинный снимок карточки «Смородина-жасмин» (та же карточка каталога, реально присутствующая в отфильтрованной выдаче). Карточку без исходного фото не включаем. Видимый адрес рамки и служебные подписи увеличены до 32px; главные титры ≥89px, финальный URL40px.\n');
