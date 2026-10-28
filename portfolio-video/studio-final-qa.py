import json,subprocess
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).parent
ffmpeg=next((root/'.tool-deps/imageio_ffmpeg/binaries').glob('*.exe'))
out=root/'out/studio-v2';qa=out/'qa/decoded';qa.mkdir(exist_ok=True)
frames=sorted(set([0,45,82,83,90,97,115,138,158,165,166,180,193,194,213,248,249,256,263,278,303,304,330,359,360,367,374,400,470,471,478,485,500,525,526,550,581,582,589,596,625,669,670,677,684,692,735,774,775,782,789,810,840,885]))
checks=[]
for mode,file in [('reels','reels-1080x1920.mp4'),('wide','telegram-1920x1080.mp4')]:
    folder=qa/mode;folder.mkdir(exist_ok=True);select='+'.join('eq(n\\,%s)'%f for f in frames)
    subprocess.run([str(ffmpeg),'-v','error','-y','-i',str(out/'final'/file),'-vf','select='+select,'-fps_mode','vfr','-q:v','2',str(folder/'%03d.jpg')],check=True)
    files=sorted(folder.glob('[0-9]*.jpg'));assert len(files)==len(frames),(mode,len(files),len(frames))
    w,h=(216,384) if mode=='reels' else (384,216);cols=6;sheet=Image.new('RGB',(w*cols,(h+25)*((len(files)+cols-1)//cols)),'#e5dccb');d=ImageDraw.Draw(sheet)
    for i,(file,f) in enumerate(zip(files,frames)):
        im=Image.open(file);im.thumbnail((w,h));sheet.paste(im,(i%cols*w,i//cols*(h+25)));d.text((i%cols*w+6,i//cols*(h+25)+h+5),f'f{f}',fill='#1a1210')
    sheet.save(qa/(mode+'-contact.jpg'))
    checks.append({'mode':mode,'decoded_keyframes':frames,'count':len(files)})
for a,b in [('reels-1080x1920.mp4','reels-no-music.mp4'),('telegram-1920x1080.mp4','landscape-no-music.mp4')]:
    hashes=[]
    for name in [a,b]:
        p=subprocess.run([str(ffmpeg),'-v','error','-i',str(out/'final'/name),'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-'],capture_output=True,text=True,check=True);hashes.append(p.stdout.strip())
    assert hashes[0]==hashes[1],(a,b);checks.append({'video_packet_identity':[a,b],'sha256':hashes[0]})
(out/'final/visual-qa.json').write_text(json.dumps(checks,indent=2),encoding='utf8');print(json.dumps(checks,indent=2))
