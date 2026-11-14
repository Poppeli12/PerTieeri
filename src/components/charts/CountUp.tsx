import React, { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Iso avainluku laskee nollasta oikeaan arvoonsa kerran (esim. "123 päivää" → päivät kuluvat).
 * Teksti, jossa ei ole lukua, näytetään sellaisenaan. Liikkeen vähennys → suoraan lopputulos.
 */
export function CountUp({ text, duration = 1600 }: { text: string; duration?: number }) {
  const m = /^([^\d−-]*)([−-]?)(\d(?:[\d\s ]*\d)?)(.*)$/.exec(text);
  const target = m ? Number(m[3].replace(/[\s ]/g, '')) : NaN;
  const [v, setV] = useState(Number.isFinite(target) ? 0 : target);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    let raf = 0;
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) return setV(target);
        const t0 = Date.now();
        const tick = () => {
          const p = Math.min(1, (Date.now() - t0) / duration);
          setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [target, duration]);
  if (!m || !Number.isFinite(target)) return <>{text}</>;
  return <>{`${m[1]}${m[2]}${v.toLocaleString('fi-FI')}${m[4]}`}</>;
}
