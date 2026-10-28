const {chromium}=require('../app/e2e/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const c=await b.newContext({deviceScaleFactor:2,viewport:{width:430,height:900}});const p=await c.newPage();p.setDefaultNavigationTimeout(90000);
for(const [name,route] of [['mobile-home','/'],['mobile-catalog','/catalog'],['mobile-product','/product/smorodina-zhasmin']]){
await p.goto('https://abrikosova.awwwdde.art'+route,{waitUntil:'domcontentloaded'});await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(4000);await p.screenshot({path:`public/textures/${name}.png`});console.log(name);
}
const layout={source:'https://abrikosova.awwwdde.art',captured:'2026-10-28',desktop:{width:1920,height:1080,scale:2},mobile:{width:430,height:900,scale:2},states:fs.readdirSync('public/textures').filter(x=>x.endsWith('.png'))};fs.writeFileSync('public/textures/layout.json',JSON.stringify(layout,null,2));await b.close();})();
