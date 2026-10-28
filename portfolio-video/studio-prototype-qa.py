from PIL import Image,ImageOps,ImageDraw
import subprocess
from pathlib import Path
root=Path(__file__).parent
ffmpeg=next((root/'.tool-deps/imageio_ffmpeg/binaries').glob('*.exe'))
out=root/'out/studio-v2/qa/prototype';out.mkdir(exist_ok=True)
subprocess.run([str(ffmpeg),'-v','error','-y','-i',str(root/'out/studio-v2/final/prototype-reels.mp4'),'-vf','fps=3,scale=270:480',str(out/'%03d.jpg')],check=True)
files=list(out.glob('*.jpg'));sheet=Image.new('RGB',(270*7,510*((len(files)+6)//7)),'#e5dccb');d=ImageDraw.Draw(sheet)
for i,file in enumerate(files):
    sheet.paste(Image.open(file),((i%7)*270,(i//7)*510));d.text(((i%7)*270+8,(i//7)*510+485),f'{i/3:.2f}s',fill='#1a1210')
sheet.save(out/'contact.jpg')
print(out/'contact.jpg')
