import {Config} from '@remotion/cli/config';
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(3);
Config.setChromiumOpenGlRenderer('angle');
Config.setBrowserExecutable('C:/Program Files/Google/Chrome/Application/chrome.exe');
