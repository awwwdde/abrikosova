const {chromium}=require('../app/e2e/node_modules/playwright');const fs=require('fs');
const ROOT='public/studio';fs.mkdirSync(ROOT,{recursive:true});const meta={};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{for(const mode of ['desktop','mobile']){
 const vp=mode==='desktop'?{width:1920,height:950}:{width:480,height:720};const ctx=await b.newContext({viewport:vp,deviceScaleFactor:2});const p=await ctx.newPage();p.setDefaultNavigationTimeout(60000);
 async function settle(){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);}
 async function go(route){await p.goto('https://abrikosova.awwwdde.art'+route,{waitUntil:'domcontentloaded'});await settle();}
 async function save(name,loc){if(loc){await loc.evaluate(e=>{e.querySelectorAll('img').forEach(i=>i.loading='eager')});await loc.scrollIntoViewIfNeeded();await settle();await p.addStyleTag({content:'header{visibility:hidden!important}'});await loc.screenshot({path:`${ROOT}/${mode}-${name}.png`});const r=await loc.boundingBox();meta[`${mode}-${name}`]={w:r.width,h:r.height};}else{await p.screenshot({path:`${ROOT}/${mode}-${name}.png`});meta[`${mode}-${name}`]={w:vp.width,h:vp.height};}fs.writeFileSync(ROOT+'/layout.json',JSON.stringify(meta,null,2));console.log(mode,name);}
 async function snapViewAt(name,loc){await loc.evaluate(e=>window.scrollTo({top:Math.max(0,e.getBoundingClientRect().top+scrollY-125),behavior:'instant'}));await settle();await save(name);}
 const old=mode==='desktop'?'home':'mobile-home';fs.copyFileSync('public/textures/'+old+'.png',ROOT+'/'+mode+'-home.png');meta[mode+'-home']=mode==='desktop'?{w:1920,h:1080}:{w:430,h:900};if(mode==='desktop'){fs.copyFileSync('public/textures/hero-overlay.png',ROOT+'/desktop-home-overlay.png');meta['desktop-home-overlay']={w:1920,h:1080};}
 await go('/catalog');await save('catalog');if(mode==='mobile')await snapViewAt('catalog-focus',p.locator('article').first());
 for(let i=0;i<4;i++)await save('card'+i,p.locator('article').nth(i));
 await go('/catalog');await p.getByRole('button',{name:'Фильтры',exact:true}).click();await settle();await save('filters',p.getByRole('dialog'));
 await p.getByRole('checkbox',{name:/Без глютена/}).check();await settle();await save('filters-selected',p.getByRole('dialog'));
 await p.getByRole('button',{name:/Показать/}).last().click();await settle();await save('filtered-card',p.locator('article').first());
 await save('tag',p.locator('article').first().getByText('Без глютена',{exact:true}));
 await go('/product/smorodina-zhasmin');await save('product');await save('summary',p.locator('.product-summary'));
 if(mode==='desktop'){
  await p.addStyleTag({content:'header{visibility:hidden!important}'});const grid=p.locator('.product-page > div.grid');await grid.scrollIntoViewIfNeeded();await settle();const r=await grid.evaluate(e=>{const a=e.children[0].getBoundingClientRect(),z=e.children[1].getBoundingClientRect();return{x:a.x+scrollX,y:a.y+scrollY,width:z.right-a.x,height:Math.max(a.height,z.height)}});await p.screenshot({path:`${ROOT}/desktop-product-block.png`,clip:r});meta['desktop-product-block']={w:r.width,h:r.height};
 }
 await p.getByRole('button',{name:'В корзину',exact:true}).last().click();await settle();await go('/cart');await save('cart');await save('cart-summary',p.getByRole('complementary',{name:'Ваш заказ'}));
 await go('/custom-cakes');await save('custom');await save('calculator20',p.locator('section[aria-labelledby="calculator-title"]'));
 const guests=p.locator('section[aria-labelledby="calculator-title"] input');await guests.fill('40');await guests.blur();await p.waitForTimeout(1000);await save('calculator40',p.locator('section[aria-labelledby="calculator-title"]'));
 const calcRect=await p.locator('section[aria-labelledby="calculator-title"]').boundingBox();const plusRect=await p.getByRole('button',{name:'Больше гостей',exact:true}).boundingBox();meta[`${mode}-calculator-target`]={x:plusRect.x-calcRect.x+plusRect.width/2,y:plusRect.y-calcRect.y+plusRect.height/2};
 await go('/custom-cakes?request=1');await save('request',p.getByRole('dialog'));
 await ctx.close();
}fs.writeFileSync(`${ROOT}/layout.json`,JSON.stringify(meta,null,2));}finally{await b.close();}})();
