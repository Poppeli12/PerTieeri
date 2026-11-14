import React, { memo, useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';
import { C } from '../theme';
import { PT_POSES } from './perTieeriPoses';

const portrait = PT_POSES.ristissa;

/** Alapalkin rintakuva: alkuperäisen hahmon vektorit painikkeen tilan värillä. */
export const PerTieeriTabIcon = memo(function PerTieeriTabIcon({ size, color = C.greenDark }: { size: number; color?: string }) {
  const clipId = `tieeri-tab-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  return (
    <Svg width={size} height={size} viewBox="80 -10 180 180">
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={170} cy={80} r={89} />
        </ClipPath>
        <ClipPath id={`${clipId}-head`}>
          <Path d="M80 -10H260V91H193L189 99.5H151L147 91H80Z" />
        </ClipPath>
        <ClipPath id={`${clipId}-body`}>
          <Path d="M80 91H147L151 99.5H189L193 91H260V170H80Z" />
        </ClipPath>
      </Defs>
      <Circle cx={170} cy={80} r={90} fill={color} />
      <G clipPath={`url(#${clipId})`}>
        {/* Lyhyempi takin rajaus tuo olkapäät ja napit näkyviin pienessä kuvakkeessa. */}
        <G clipPath={`url(#${clipId}-body)`}>
          <G transform="translate(0 25) scale(1 0.75)">
            <Path d={portrait.silhouette} fill="#fff" stroke="#fff" strokeWidth={3} />
            <Path d={portrait.body} fill={color} fillRule="evenodd" />
          </G>
        </G>
        <Path d={portrait.silhouette} fill="#fff" stroke="#fff" strokeWidth={3} clipPath={`url(#${clipId}-head)`} />
        <Path d={portrait.head} fill={color} fillRule="evenodd" />
        <Path d={portrait.eyes} fill={color} fillRule="evenodd" />
        <Path d={portrait.stache} fill={color} fillRule="evenodd" />
      </G>
      <Circle cx={170} cy={80} r={89} fill="none" stroke={color} strokeWidth={2} />
    </Svg>
  );
});
