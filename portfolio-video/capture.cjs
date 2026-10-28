const {chromium}=require('../app/e2e/node_modules/playwright');
const fs=require('fs');
const BASE='https://abrikosova.awwwdde.art';
(async()=>{
const b=await chromium.launch({channel:'chrome',headless:true});
const ctx=await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2});
const p=await ctx.newPage();const layout={};
async function settle(){await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1000);}
async function go(route){await p.goto(BASE+route,{waitUntil:'networkidle'});await settle();}
async function snap(name){await p.screenshot({path:`public/textures/${name}.png`});layout[name]={url:p.url(),scroll:await p.evaluate(()=>scrollY),width:1920,height:1080};console.log('Captured',name);}
async function focus(selector){const e=p.locator(selector).first();await e.scrollIntoViewIfNeeded();await p.evaluate(el=>{window.scrollTo({top:el.getBoundingClientRect().top+scrollY-160,behavior:'instant'})},await e.elementHandle());await settle();}
await go('/');await p.evaluate(()=>{document.querySelectorAll('video').forEach(v=>{v.pause();v.currentTime=2;})});await settle();await snap('home');
const logo=p.locator('header img').first();if(await logo.count())await logo.screenshot({path:'public/textures/logo.png',omitBackground:true});
await go('/catalog');await snap('catalog');
for(let i=0;i<4;i++){const card=p.locator('article').nth(i);if(await card.count()){layout['card'+i]=await card.boundingBox();await card.screenshot({path:`public/textures/card${i}.png`});}}
await p.getByRole('button',{name:'Фильтры',exact:true}).click();await settle();await snap('filters');
console.log('FILTERS',await p.getByRole('dialog').innerText());
await p.getByRole('checkbox',{name:/Без глютена/}).check();await settle();await snap('filters-selected');
await p.getByRole('button',{name:/Показать/}).last().click();await settle();await snap('filtered');
await go('/product/smorodina-zhasmin');await snap('product');
await p.getByRole('button',{name:'В корзину',exact:true}).last().click();await settle();
await go('/cart');await snap('cart');console.log('CART',await p.locator('main').innerText());
await go('/custom-cakes');await snap('custom');
await focus('#calculator-title');await snap('calculator20');
const guests=p.locator('input').first();await guests.fill('40');await guests.blur();await settle();await snap('calculator40');
await focus('#fillings-title');await snap('fillings');
await go('/gallery');await snap('gallery');
await go('/custom-cakes?request=1');await snap('request');console.log('REQUEST',await p.getByRole('dialog').innerText());
const mobile=await ctx.newPage({viewport:{width:430,height:900}});await mobile.goto(BASE,{waitUntil:'networkidle'});await mobile.evaluate(()=>document.fonts.ready);await mobile.waitForTimeout(1000);await mobile.screenshot({path:'public/textures/mobile-home.png'});
await mobile.goto(BASE+'/catalog',{waitUntil:'networkidle'});await mobile.waitForTimeout(1000);await mobile.screenshot({path:'public/textures/mobile-catalog.png'});
await mobile.goto(BASE+'/product/smorodina-zhasmin',{waitUntil:'networkidle'});await mobile.waitForTimeout(1000);await mobile.screenshot({path:'public/textures/mobile-product.png'});
fs.writeFileSync('public/textures/layout.json',JSON.stringify(layout,null,2));await b.close();
})();
