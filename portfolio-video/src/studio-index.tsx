import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {StudioFilm,StudioAudio,STUDIO_TOTAL} from './StudioFilm';
const Root:React.FC=()=> <>
<Composition id="StudioReels" component={StudioFilm} width={1080} height={1920} fps={30} durationInFrames={STUDIO_TOTAL} defaultProps={{bgm:true}}/>
<Composition id="StudioWide" component={StudioFilm} width={1920} height={1080} fps={30} durationInFrames={STUDIO_TOTAL} defaultProps={{bgm:true}}/>
<Composition id="StudioAudio" component={StudioAudio} width={1920} height={1080} fps={30} durationInFrames={STUDIO_TOTAL} defaultProps={{bgm:true}}/>
</>;
registerRoot(Root);
