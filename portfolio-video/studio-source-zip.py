from pathlib import Path
import zipfile
root=Path(__file__).parent
files=['package.json','package-lock.json','tsconfig.json','remotion.config.ts','STUDIO-DESIGN.md','studio-render.cjs','src/studio-index.tsx','src/StudioFilm.tsx','src/font-data.ts','src/studio-music.ts','src/workbench.ts']
files += [str(p.relative_to(root)) for p in (root/'public/studio').glob('*') if p.is_file()]
files += ['public/hero.mp4','public/audio/bgm.mp3','public/audio/click.mp3','public/audio/soft.mp3']
with zipfile.ZipFile(root/'out/studio-v2/final/editable-project.zip','w',compression=zipfile.ZIP_DEFLATED) as z:
    for name in files:z.write(root/name,'abrikosova-studio-video/'+name.replace('\\','/'))
    z.write(root/'out/studio-v2/final/README.md','abrikosova-studio-video/README.md')
print('Editable project archived')
