import { Platform, useWindowDimensions } from 'react-native';

/** Referenssikuvakaappauksen leveys pikseleinä (S-mobiili, Android). */
export const REF_W = 591;

/** Tietokoneen selaimessa sovellus näytetään puhelinkehyksessä (ks. App.tsx PhoneFrame). */
export const FRAME_MIN_WINDOW = 700;
export const FRAME_W = 390;
export const FRAME_H = 844;
export function useFramed() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= FRAME_MIN_WINDOW;
}

/** Sovelluksen leveys: kehyksessä puhelimen leveys, puhelimen selaimessa koko näyttö (enintään 430 px). */
export function useAppWidth() {
  const { width } = useWindowDimensions();
  if (Platform.OS !== 'web') return width;
  return width >= FRAME_MIN_WINDOW ? FRAME_W : Math.min(width, 430);
}

/**
 * Kerroin, jolla referenssikuvan pikselimitat muutetaan tämän laitteen mitoiksi.
 * Näin elementtien keskinäiset suhteet pysyvät täsmälleen samoina kuin S-mobiilissa.
 */
export function useK() {
  return useAppWidth() / REF_W;
}
