from PIL import Image
import numpy as np,json
from pathlib import Path
root=Path(__file__).parent;out={}
for mode in ['desktop','mobile']:
 im=np.array(Image.open(root/f'public/studio/{mode}-summary.png').convert('RGB'));mask=(im[:,:,0]>110)&(im[:,:,0]<160)&(im[:,:,1]>15)&(im[:,:,1]<75)&(im[:,:,2]>15)&(im[:,:,2]<80)
 rows=np.where(mask.sum(axis=1)>im.shape[1]*.12)[0];parts=[]
 for a in rows:
  if not parts or a>parts[-1][-1]+1:parts.append([a])
  else:parts[-1].append(a)
 part=max(parts,key=len);cols=np.where(mask[part].sum(axis=0)>len(part)*.5)[0];out[mode+'-buy']={'x':float((cols.min()+cols.max())/4),'y':float((part[0]+part[-1])/4)}
(root/'public/studio/interactions.json').write_text(json.dumps(out,indent=2),encoding='utf8');print(out)
