import React from 'react';
import { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Basket } from '../../finance/categories';
import { PT_INK } from '../perTieeriPoses';
import { BUCKET_LABELS } from './receiptSorting';

export const INK = PT_INK;

/** Hand-drawn SVG geometry, shared by the stationary papers and the moving receipt. */
export function ReceiptArt() {
  return (
    <G stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="white">
      <Path d="M3 3l5 3 5-3 5 3 5-3 5 3 5-3 6 3v53l-5-3-5 3-5-3-5 3-5-3-5 3-6-3Z" />
      <Path d="M11 17h19M11 24h13M11 34h19M11 41h16M11 49h9" fill="none" strokeWidth={2} />
    </G>
  );
}

function House() {
  return <Path d="M1 19L20 3l19 16h-5v25H7V19Zm14 25V29h10v15M29 10V4h6v11" />;
}
function Calendar() {
  return <G><Rect x={2} y={9} width={38} height={36} rx={5} /><Path d="M3 20h36M12 3v12M30 3v12" /><Path d="M12 28h2m9 0h2m9 0h1M12 36h2m9 0h2m9 0h1" strokeWidth={4} /></G>;
}
function Coffee() {
  return <G><Path d="M2 20h29l-3 17q-11 13-23 0Zm29 3q16-2 9 10l-12 3M0 46h38M12 15c-8-7 8-8 0-15M23 14c-7-6 7-7 0-13" /></G>;
}
function Bag() {
  return <G><Path d="M5 17h31l5 30H1Zm7 0V11q0-17 17-8 5 3 3 14" /><Circle cx={13} cy={23} r={1} /><Circle cx={29} cy={23} r={1} /></G>;
}
function Tooth() {
  return <Path d="M4 6C-7 16 7 47 12 45c6-1 1-20 9-20s3 21 9 20C36 44 48 14 36 6c-8-7-12 1-16 1S11 0 4 6Z" />;
}
function Tools() {
  return <G><Path d="M4 1l9 8-4 6L0 7c-3 13 6 19 15 15l19 23 7-6-22-23c4-10-1-16-9-16M29 4l9-4 5 5-5 9-5 1-23 29-7-6 26-28Z" /></G>;
}

/** Back and front are separate so the animated receipt physically disappears behind the rim. */
export function BucketBack({ basket }: { basket: Basket }) {
  return (
    <G stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="white">
      <Ellipse cx={100} cy={84} rx={88} ry={20} />
      <G transform="translate(48 39) rotate(-17)"><ReceiptArt /></G>
      <G transform="translate(87 22) rotate(6)"><ReceiptArt /></G>
      <G transform="translate(128 43) rotate(19)"><ReceiptArt /></G>
      {basket === 'regular' && <G strokeWidth={2.5}><Path d="M105 35l-8 13h9l-7 14 17-18h-10l7-9" fill={INK} /><Path d="M64 55q-12 13-4 17 14 5 4-17Z" /></G>}
      {basket === 'irregular' && <G transform="translate(111 45) rotate(12)" strokeWidth={3}><Rect x={0} y={0} width={38} height={31} rx={5} /><Path d="M12 0v-6h14v6M19 7v17M11 15h16" /></G>}
      {basket === 'slipping' && <G transform="translate(46 37) rotate(-13) scale(.85)" strokeWidth={3}><Coffee /></G>}
    </G>
  );
}

export function BucketFront({ basket, selected }: { basket: Basket; selected?: boolean }) {
  return (
    <G stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="white">
      {/* Side hinges remain visible outside the bucket. */}
      <Path d="M17 99C-8 84-2 141 26 153M183 99c25-15 19 42-9 54" fill="none" />
      <Path d="M15 85l22 156c3 20 123 20 126 0l22-156q-85 30-170 0Z" fill={selected ? '#F0F8F1' : 'white'} />
      <Path d="M15 85q85 30 170 0M19 97q81 28 162 0" fill="none" />
      <Path d="M12 108C9 216 190 216 188 108" fill="none" strokeWidth={3} />
      {/* White inset keeps the carrying handle behind the lettering. */}
      <Path d="M36 112h128v89H36Z" stroke="none" />
      {BUCKET_LABELS[basket].map((line, i) => (
        <SvgText key={line} x={100} y={128 + i * 20} textAnchor="middle" fontFamily="Figtree-700" fontSize={basket === 'irregular' ? 17 : 18} fill={INK} stroke="none">{line}</SvgText>
      ))}
      <G transform="translate(40 180) scale(.73)" fill="none" strokeWidth={3.8}>
        {basket === 'regular' ? <><House /><G transform="translate(62 0)"><Path d="M8 3l-9 18h11L3 39l22-25H13l7-11" fill={INK} stroke="none" /></G><G transform="translate(112 0)"><Calendar /></G></>
          : basket === 'irregular' ? <><Tools /><G transform="translate(60 0)"><Tooth /></G><G transform="translate(119 7)"><Path d="M0 16l5-12h27l5 12v20H0Zm0 0h37M6 24h5m15 0h5M4 36v5m29-5v5" /></G></>
            : <><Coffee /><G transform="translate(60 0)"><Bag /></G><G transform="translate(121 1)"><Path d="M1 16h35l-6 31H7ZM4 16C-7 6 6-1 12 4 17-7 28-2 28 4c13-2 15 12 8 12M12 23l3 19m10-19-2 19" /></G></>}
      </G>
      <Rect x={67} y={222} width={66} height={13} rx={6.5} />
      <Path d="M40 243q60 14 120 0" fill="none" strokeWidth={2} />
    </G>
  );
}
