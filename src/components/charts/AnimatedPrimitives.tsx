import React, { useId } from 'react';
import { Animated } from 'react-native';
import { ClipPath, Defs, G, Rect } from 'react-native-svg';
import { useChartAnimation } from './useChartAnimation';

export const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function LineReveal({ progress, width, height, children }: { progress: Animated.Value; width: number; height: number; children: React.ReactNode }) {
  const id = `chart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <>
    <Defs><ClipPath id={id}><AnimatedRect x={0} y={0} width={progress.interpolate({ inputRange: [0, 1], outputRange: [0, width] })} height={height} /></ClipPath></Defs>
    <G clipPath={`url(#${id})`}>{children}</G>
  </>;
}

export function GrowingBar({ percent, color, height = 24 }: { percent: number; color: string; height?: number }) {
  const { progress } = useChartAnimation(`${percent}:${color}`);
  return <Animated.View testID="growing-bar" style={{ height, borderRadius: 5, backgroundColor: color, width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${Math.max(0, Math.min(100, percent))}%`] }) }} />;
}
