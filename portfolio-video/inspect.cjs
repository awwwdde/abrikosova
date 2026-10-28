const {chromium}=require('../app/e2e/node_modules/playwright');
const fs=require('fs');
(async()=>{
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:1512,height:980},deviceScaleFactor:1});
for(const route of ['/catalog','/product/smorodina-zhasmin','/custom-cakes','/gallery']){
await p.goto('https://abrikosova.awwwdde.art'+route,{waitUntil:'networkidle'});
await p.evaluate(()=>document.fonts.ready);
console.log('\nPAGE '+route+'\n'+(await p.locator('body').innerText()).slice(0,9500));
console.log('CONTROLS',JSON.stringify(await p.locator('button,input,select').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:e.textContent?.trim(),aria:e.getAttribute('aria-label'),placeholder:e.getAttribute('placeholder'),type:e.getAttribute('type')})))));
await p.screenshot({path:'out/qa/inspect-'+route.replaceAll('/','-')+'.png'});
}
await b.close();
})();
