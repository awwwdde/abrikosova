import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {Film,TOTAL} from './Film';
const Root:React.FC=()=> <>
 <Composition id="Reels" component={Film} width={1080} height={1920} fps={30} durationInFrames={TOTAL} defaultProps={{bgm:true}}/>
 <Composition id="Landscape" component={Film} width={1920} height={1080} fps={30} durationInFrames={TOTAL} defaultProps={{bgm:true}}/>
 </>;
registerRoot(Root);
