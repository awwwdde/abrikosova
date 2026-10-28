import json,subprocess,math,io,wave
from pathlib import Path
import numpy as np
root=Path(__file__).parent
out=root/'out/studio-v2/final'
ffmpeg=root/'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe'
def decode(file):
    p=subprocess.run([str(ffmpeg),'-v','error','-i',str(file),'-vn','-ac','1','-ar','48000','-c:a','pcm_s16le','-f','wav','-'],capture_output=True,check=True)
    with wave.open(io.BytesIO(p.stdout)) as wav:return np.frombuffer(wav.readframes(wav.getnframes()),dtype='<i2').astype(np.float64)/32768
source=decode(root/'public/audio/click.mp3');source_peak=float(np.argmax(np.abs(source))/48000)
reports=[]
for file in ['reels-1080x1920.mp4','telegram-1920x1080.mp4','reels-no-music.mp4','landscape-no-music.mp4']:
    y=decode(out/file);peak=float(np.max(np.abs(y)));rms=float(np.sqrt(np.mean(y*y)));cues=[]
    for frame in [166,304,526]:
        start=max(0,int((frame/30-.35)*48000));window=y[start:start+len(source)+int(.7*48000)]
        n=1<<(len(window)+len(source)-2).bit_length();corr=np.fft.irfft(np.fft.rfft(window,n)*np.fft.rfft(source[::-1],n),n)
        valid=corr[len(source)-1:len(window)];lag=int(np.argmax(valid));found=(start+lag)/48000
        cues.append({'visual_frame':frame,'detected_start_sec':round(found,5),'audible_peak_offset_frames':round((found+source_peak-frame/30)*30,3)})
    reports.append({'file':file,'sample_peak_dbfs':round(20*math.log10(peak),2),'rms_dbfs':round(20*math.log10(rms),2),'clipped_samples':int(np.count_nonzero(np.abs(y)>=1)),'clicks':cues})
(out/'audio-qa.json').write_text(json.dumps({'pipeline':'Remotion4.0.484 H264+AAC192k 48kHz MP4, same AAC encoder for no-BGM; original click peak lag measured independently','source_click_peak_lag_frames':round(source_peak*30,3),'compensation_frames':7,'date':'2026-10-28','results':reports},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps(reports,indent=2))
