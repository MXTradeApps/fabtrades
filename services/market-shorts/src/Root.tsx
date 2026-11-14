import React from 'react';
import {Composition} from 'remotion';
import {MarketMovers} from './MarketMovers';
import {FPS, totalFrames, Week} from './types';
import sample from '../data/week-2026-11-14.json';

export const Root: React.FC = () => (
  <Composition
    id="MarketMovers"
    component={MarketMovers}
    width={1080}
    height={1920}
    fps={FPS}
    durationInFrames={totalFrames(sample as Week)}
    defaultProps={sample as Week}
    calculateMetadata={({props}) => ({durationInFrames: totalFrames(props)})}
  />
);
