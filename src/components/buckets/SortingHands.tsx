import React from 'react';
import { Animated } from 'react-native';
import { Path } from 'react-native-svg';
import { INK } from './BucketArt';

const AnimatedPath = Animated.createAnimatedComponent(Path);
type Openness = Animated.AnimatedInterpolation<number>;

// Same command topology in each pose: only finger joints flex, never the palm or wrist.
const RIGHT_CLOSED = 'M0 -11 C15 -17 33 -15 42 -6 C50 2 53 14 49 27 Q45 32 42 26 L39 10 L42 31 Q40 37 35 32 L30 12 L32 30 Q29 35 25 29 L21 13 L23 23 Q20 28 16 22 L12 10 Q5 12 0 8Z';
const RIGHT_OPEN = 'M0 -11 C15 -17 33 -15 42 -6 C50 2 55 9 55 18 Q53 23 49 19 L43 6 L49 24 Q47 29 43 25 L35 9 L41 26 Q38 31 34 26 L27 12 L32 23 Q29 28 25 23 L16 9 Q6 12 0 8Z';
const THUMB_CLOSED = 'M7 4 C16 5 22 10 27 16 C30 21 34 21 38 22 Q42 25 37 29 C30 33 25 27 21 23 L13 18';
const THUMB_OPEN = 'M7 4 C15 4 19 6 23 10 C25 12 27 12 29 13 Q33 16 28 20 C22 22 19 19 16 17 L10 15';
const LEFT_CLOSED = 'M-10 -2 C-20 -14 -28 -28 -22 -40 C-20 -48 -10 -52 -3 -51 L18 -57 Q28 -57 25 -49 L4 -42 L25 -45 Q35 -45 31 -36 L8 -30 L28 -32 Q36 -30 29 -23 L11 -18 Q10 -7 4 1Z';
const LEFT_OPEN = 'M-10 -2 C-20 -14 -28 -28 -22 -40 C-20 -48 -10 -52 -3 -51 L9 -56 Q17 -57 15 -49 L-1 -41 L25 -45 Q35 -45 31 -36 L8 -30 L28 -32 Q36 -30 29 -23 L11 -18 Q10 -7 4 1Z';
const LEFT_THUMB = 'M-14 -20 C-8 -27 -2 -32 5 -34 Q14 -35 13 -29 C7 -23 5 -17 3 -12';
const LEFT_THUMB_OPEN = 'M-14 -20 C-13 -28 -11 -34 -7 -37 Q0 -41 1 -35 C-2 -28 -3 -20 -3 -13';

export function RightSortingHand({ open }: { open: Openness }) {
  return <>
    <AnimatedPath d={open.interpolate({ inputRange: [0, 1], outputRange: [RIGHT_CLOSED, RIGHT_OPEN] })} fill="white" stroke={INK} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
    <AnimatedPath d={open.interpolate({ inputRange: [0, 1], outputRange: [THUMB_CLOSED, THUMB_OPEN] })} fill="white" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M10 -8q10-3 19 1" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
  </>;
}

export function LeftSortingHand({ open }: { open: Openness }) {
  return <>
    <AnimatedPath d={open.interpolate({ inputRange: [0, 1], outputRange: [LEFT_CLOSED, LEFT_OPEN] })} fill="white" stroke={INK} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
    <AnimatedPath d={open.interpolate({ inputRange: [0, 1], outputRange: [LEFT_THUMB, LEFT_THUMB_OPEN] })} fill="white" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
    <Path d="M-15 -14q4 6 10 8" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
  </>;
}
