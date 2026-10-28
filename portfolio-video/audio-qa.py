import json,subprocess,math,io,wave
from pathlib import Path
import numpy as np
root=Path(__file__).parent
ffmpeg=root/'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'
def decode(file):
    p=subprocess.run([str(ffmpeg),'-v','error','-i',str(file),'-vn','-ac','1','-ar','48000','-c:a','pcm_s16le','-f','wav','-'],capture_output=True,check=True)
    with wave.open(io.BytesIO(p.stdout)) as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').astype(np.float64)/32768
source=decode(root/'public/audio/click.mp3');source_peak=float(np.argmax(np.abs(source))/48000)
reports=[]
for file in ['reels-1080x1920.mp4','telegram-1920x1080.mp4']:
    path=root/'out/final'/file
    if not path.exists(): continue
    y=decode(path); peak=float(np.max(np.abs(y)));rms=float(np.sqrt(np.mean(y*y)))
    cues=[]
    for frame in [294,452,696]:
        start=max(0,int((frame/30-.2)*48000));window=y[start:start+len(source)+int(.4*48000)]
        n=1<<(len(window)+len(source)-2).bit_length()
        corr=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(source[::-1],n),n)
        valid=corr[len(source)-1:len(window)];lag=int(np.argmax(valid));found=(start+lag)/48000
        cues.append({'visual_frame':frame,'detected_source_start_sec':round(found,5),'output_offset_frames':round((found-frame/30)*30,3),'source_peak_offset_frames':round(source_peak*30,3),'audible_peak_offset_frames':round((found+source_peak-frame/30)*30,3)})
    reports.append({'file':file,'sample_peak_dbfs':round(20*math.log10(peak),2),'rms_dbfs':round(20*math.log10(rms),2),'clipped_samples':int(np.count_nonzero(np.abs(y)>=1)),'clicks':cues})
out=root/'out/final/audio-qa.json';out.write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf8');print(out.read_text(encoding='utf8'))
