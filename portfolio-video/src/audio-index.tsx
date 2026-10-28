import React from 'react';
import {Composition,registerRoot} from 'remotion';
import {AudioBed,TOTAL} from './Film';
const Root:React.FC=()=> <Composition id="Audio" component={AudioBed} fps={30} width={1920} height={1080} durationInFrames={TOTAL} defaultProps={{bgm:true}}/>;
registerRoot(Root);
