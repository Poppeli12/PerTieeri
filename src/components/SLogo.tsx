import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { C } from '../theme';

/**
 * S-ryhmän S-tunnus, jäljitetty pikselitarkasti alkuperäisestä logosta.
 *
 * Tunnus on YKSI yhtenäinen, tasapaksu viiva, joka kiertää paksun S-kirjaimen ääriviivan:
 * alkaa oikeasta yläkulmasta, kiertää vasemman alakulman "laatikon", nousee keskeltä,
 * kiertää oikean yläkulman "laatikon" ja päättyy vasempaan alakulmaan. Pystyosat ovat suoria
 * (ei kursivointia), kaaret ovat ympyränkaaria ja päät suoria.
 *
 * Koordinaatit ovat alkuperäisen kuvan (349 × 372) pikseleitä.
 */
export const S_PATH =
  'M262 42.5 H237 A110 110 0 0 0 127 152.5 V215.5 A22 22 0 0 1 105 237.5 H88.5 V281 H101 ' +
  'A70 70 0 0 0 171 211 V156 A69 69 0 0 1 240 87 H254 V128.5 H246 A31 31 0 0 0 215 159.5 ' +
  'V214.5 A110 110 0 0 1 105 324.5 H80';

/** alkuperäinen viivan paksuus */
export const S_STROKE = 19;

/** S-kirjaimen rajaus (viivan paksuus mukana) */
const BOX = { x: 70.5, y: 33, w: 201, h: 301 };

/** alkuperäisen sovelluskuvakkeen vihreä */
export const S_GREEN = '#00A344';

export function SLogo({
  size = 40,
  variant = 'tile',
  color = C.white,
  weight = S_STROKE,
}: {
  size?: number;
  /** tile = vihreä neliö + valkoinen S (sovelluskuvake), plain = pelkkä S värillä `color` */
  variant?: 'tile' | 'plain';
  color?: string;
  /** @deprecated ei käytössä – tunnus on yksi viiva, joten taustaväriä ei tarvita */
  bg?: string;
  /** viivan paksuus alkuperäisen kuvan pikseleinä (oletus 19) */
  weight?: number;
}) {
  if (variant === 'tile') {
    // neliö, jossa S on samassa suhteessa kuin alkuperäisessä kuvakkeessa (korkeus ≈ 80 % neliöstä)
    const side = 372;
    const cx = 171;
    const cy = 183.5;
    return (
      <Svg width={size} height={size} viewBox={`${cx - side / 2} ${cy - side / 2} ${side} ${side}`}>
        <Rect x={cx - side / 2} y={cy - side / 2} width={side} height={side} rx={side * 0.2} fill={S_GREEN} />
        <Path d={S_PATH} stroke={C.white} strokeWidth={S_STROKE} fill="none" strokeLinejoin="miter" strokeLinecap="butt" />
      </Svg>
    );
  }
  // plain: `size` = korkeus, leveys säilyttää alkuperäisen suhteen
  const pad = (weight - S_STROKE) / 2;
  const vb = `${BOX.x - pad} ${BOX.y - pad} ${BOX.w + pad * 2} ${BOX.h + pad * 2}`;
  const ratio = (BOX.w + pad * 2) / (BOX.h + pad * 2);
  return (
    <Svg width={size * ratio} height={size} viewBox={vb}>
      <Path d={S_PATH} stroke={color} strokeWidth={weight} fill="none" strokeLinejoin="miter" strokeLinecap="butt" />
    </Svg>
  );
}
