const fs=require('fs'),cp=require('child_process'),path=require('path');
const bin=path.resolve('node_modules/@remotion/compositor-win32-x64-msvc');const out='out/final';
const run=(name,args)=>{const r=cp.spawnSync((name==='ffmpeg'?require('./video-tools.cjs').ffmpeg:path.join(bin,name+'.exe')),args,{stdio:'inherit',windowsHide:true});if(r.status!==0)throw Error(name+' exit '+r.status);};
run('ffmpeg',['-y','-i',out+'/telegram-1920x1080.mp4','-an','-c:v','libx264','-preset','slow','-crf','25','-pix_fmt','yuv420p','-movflags','+faststart',out+'/portfolio-web.mp4']);
run('ffmpeg',['-y','-i',out+'/telegram-1920x1080.mp4','-an','-c:v','libvpx-vp9','-b:v','0','-crf','34','-deadline','realtime','-cpu-used','6','-row-mt','1','-threads','2',out+'/portfolio-web.webm']);
run('ffmpeg',['-y','-i',out+'/telegram-1920x1080.mp4','-vf',"select=eq(n\\,45)",'-frames:v','1','-q:v','2',out+'/poster-landscape.jpg']);
run('ffmpeg',['-y','-i',out+'/reels-1080x1920.mp4','-vf',"select=eq(n\\,45)",'-frames:v','1','-q:v','2',out+'/cover-reels.jpg']);
const report=[];
for(const f of fs.readdirSync(out).filter(x=>/\.(mp4|webm)$/.test(x))){const r=cp.spawnSync(path.join(bin,'ffprobe.exe'),['-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,avg_frame_rate,sample_rate,channels','-of','json',out+'/'+f],{encoding:'utf8'});report.push({file:f,...JSON.parse(r.stdout)});}
fs.writeFileSync(out+'/media-info.json',JSON.stringify(report,null,2));
for(const f of ['reels-1080x1920.mp4','telegram-1920x1080.mp4']){run('ffmpeg',['-y','-i',out+'/'+f,'-vf',"select='eq(n,45)+eq(n,135)+eq(n,245)+eq(n,300)+eq(n,360)+eq(n,425)+eq(n,480)+eq(n,555)+eq(n,690)+eq(n,735)+eq(n,810)+eq(n,875)+eq(n,950)+eq(n,1125)'",'-fps_mode','vfr',`out/qa/decoded-${f.startsWith('reels')?'reels':'landscape'}-%02d.png`]);}
console.log('Delivery prepared');
