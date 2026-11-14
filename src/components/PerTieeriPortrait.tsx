import React, { memo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { PT_INK, PT_POSES } from './perTieeriPoses';

/** A still portrait: no animation clock, talking state or expression changes. */
export const PerTieeriPortrait = memo(function PerTieeriPortrait({ size }: { size: number }) {
  const face = PT_POSES.ristissa;
  return <Svg testID="static-tieeri-portrait" width={size} height={size} viewBox="121 0 98 100" accessibilityLabel="Per Tieeri">
    <Path d={face.silhouette} fill="white" />
    <Path d={face.head} fill={PT_INK} fillRule="evenodd" />
    <Path d={face.eyes} fill={PT_INK} fillRule="evenodd" />
    <Path d={face.stache} fill={PT_INK} fillRule="evenodd" />
  </Svg>;
});
