from pathlib import Path
import subprocess,numpy as np,json
root=Path(__file__).parent;ffmpeg=next((root/'.tool-deps/imageio_ffmpeg/binaries').glob('*.exe'))
p=subprocess.run([str(ffmpeg),'-v','error','-i',str(root/'public/audio/bgm.mp3'),'-ac','1','-ar','8000','-f','f32le','-'],capture_output=True,check=True);y=np.frombuffer(p.stdout,dtype='<f4');sr=8000
begin=16.;duration=34.;segment=y[int(begin*sr):int((begin+duration)*sr)].astype(float);freq=np.fft.rfftfreq(len(segment),1/sr);band=np.fft.rfft(segment);band[(freq<40)|(freq>160)]=0;kick=np.fft.irfft(band,len(segment));hop=80;env=np.sqrt(np.mean(kick[:len(kick)//hop*hop].reshape(-1,hop)**2,axis=1));onset=np.maximum(env-np.concatenate(([env[0]],env[:-1])),0)
best=None
for T in np.arange(.44,.49,.0001):
 for phase in np.arange(0,T,.01):
  times=phase+np.arange(int((duration-phase)/T))*T;ind=np.rint(times/.01).astype(int);ind=ind[ind<len(env)];score=float(np.mean(onset[ind]));
  if best is None or score>best[0]:best=(score,T,phase)
_,T,phase=best
# Refine the phase and measure nearest attack in a ±40ms window for every beat.
beats=[];errors=[]
for t in phase+np.arange(int((duration-phase)/T))*T:
 i=round(t/.01);lo=max(0,i-4);hi=min(len(onset),i+5);hit=(lo+int(np.argmax(onset[lo:hi])))*.01;beats.append(begin+hit);errors.append((hit-t)*1000)
data={'track':'Cat Walk — Arulo','analysis_window_sec':[begin,begin+duration],'bpm':round(60/T,4),'T':float(T),'beat0_source_sec':round(begin+phase,5),'rms':float(np.sqrt(np.mean(segment**2))),'attack_alignment_mean_abs_ms':round(float(np.mean(np.abs(errors))),3),'beats_sec':beats,'method':'FFT40–160Hz kick band,10ms RMS novelty,least energy-grid search .44–.49s,phase10ms; approximate beat alignment, not a full three-drum classification'}
(root/'out/studio-v2').mkdir(parents=True,exist_ok=True);(root/'out/studio-v2/music-analysis.json').write_text(json.dumps(data,indent=2),encoding='utf8');(root/'src/studio-music.ts').write_text('export const MUSIC='+json.dumps(data)+' as const;\n',encoding='utf8');print(json.dumps({k:v for k,v in data.items() if k!='beats_sec'},indent=2))
