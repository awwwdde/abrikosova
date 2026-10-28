const {bundle}=require('@remotion/bundler');const {openBrowser,selectComposition,renderStill}=require('@remotion/renderer');
const fs=require('fs');
(async()=>{const serveUrl=await bundle({entryPoint:require('path').resolve('src/index.tsx')});const browser=await openBrowser('chrome',{browserExecutable:'C:/Program Files/Google/Chrome/Application/chrome.exe',chromeMode:'chrome-for-testing',chromiumOptions:{gl:'angle'}});const frames=process.argv[2]?process.argv[2].split(',').map(Number):[45,72,135,185,245,272,300,325,360,425,480,555,630,690,735,810,875,950,1005,1125,1180];
for(const id of ['Landscape','Reels']){const composition=await selectComposition({serveUrl,id,puppeteerInstance:browser});for(const frame of frames){await renderStill({serveUrl,composition,frame,output:`out/qa/v3-${id}-${frame}.png`,puppeteerInstance:browser,chromeMode:'chrome-for-testing',chromiumOptions:{gl:'angle'},logLevel:'error'});console.log(id,frame);}}
await browser.close({silent:true});})();
