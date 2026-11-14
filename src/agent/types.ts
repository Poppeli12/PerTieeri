import type { LeverKey } from '../finance/categories';
import type { SimResult } from '../finance/forecast';
import type { Plan, Prefs } from '../finance/optimizer';

export type Tone = 'good' | 'warn' | 'bad' | 'demo' | undefined;

export type Card =
  | { kind: 'baskets'; months?: number }
  | { kind: 'blocks' }
  | { kind: 'whatif'; preset?: Partial<Record<LeverKey, number>>; scenarioName?: string }
  | { kind: 'goalPlans'; goal: ReturnType<typeof import('../finance/insights').goalPlans> }
  | { kind: 'forecast'; title: string; sim: SimResult; compare?: SimResult; compareLabel?: string; baseLabel?: string }
  | { kind: 'list'; title: string; icon?: string; items: { label: string; value: string; sub?: string; tone?: Tone; icon?: string }[]; art?: string }
  | { kind: 'stat'; label: string; value: string; sub?: string; tone?: Tone; icon?: string; art?: string }
  | { kind: 'plan'; title: string; plan: Plan }
  | { kind: 'quiz'; id: string; q: string; options: string[]; correct: number; why: string }
  | { kind: 'question'; id: string; title: string; detail: string; question: string; options: string[] }
  | { kind: 'lesson'; title: string; body: string }
  | {
      kind: 'compare';
      title: string;
      /** 'peers' = synteettinen S-Pankin aineisto, 'statfin' = Tilastokeskus */
      origin: 'peers' | 'statfin';
      source: string;
      group: string;
      statistic: string;
      period: string;
      rows: { key?: string; label: string; user: number; ref: number | null; p25?: number | null; p75?: number | null; note?: string }[];
      unit: string;
      note?: string;
    }
  | { kind: 'game'; title: string; ym: string; questions: import('../finance/insights').GameQ[] }
  | { kind: 'chart'; title: string; chart: 'bar' | 'line' | 'pie'; unit: string; labels: string[]; series: { name: string; values: number[] }[]; note?: string; icon?: string; art?: string }
  | { kind: 'waterfall'; title: string; start: { label: string; value: number }; steps: { label: string; value: number; icon?: string }[]; end: { label: string; value: number }; note?: string }
  | { kind: 'bars'; title: string; rows: { label: string; value: number; peer?: number; key?: string }[]; note?: string };

export type Msg = {
  id: string;
  from: 'user' | 'bot';
  text?: string;
  cards?: Card[];
  chips?: string[];
  /** Per Tieerin tunnereaktio tähän viestiin (perTieeriEmotions) */
  mood?: string;
  ts: number;
};

export type BotMsg = Omit<Msg, 'id' | 'ts' | 'from'>;

export type Profile = {
  age: number;
  situation: string;
  living: string;
  goal: string;
  /** kotitalous: 'yksin' | 'pari' | 'lapsiperhe' | 'yksinhuoltaja' | 'muu' | 'ei tiedossa' (ei koskaan arvata) */
  household?: string;
  /** Asiakkaan nimenomaisesti vahvistama tilin kattavuus; puuttuva arvo ei ole vahvistus. */
  expensesComplete?: boolean;
  incomeComplete?: boolean;
  partnerAge?: number;
  dependentChildrenUnder25?: boolean;
  allMembers65Plus?: boolean;
  /** asiakkaan itse kertomia asioita, joita Per Tieeri muistaa */
  notes?: string[];
  protect: LeverKey[];
  style: 'short' | 'teach';
  rentDelta: number; // käyttäjän ilmoittamat elämänmuutokset
  incomeDelta: number;
  changes: { date: string; text: string }[];
};

export type AgentCtx = {
  history?: Msg[];
  profile: Profile;
  prefs: Prefs;
  answers: Record<string, string>;
};

export type AgentReply = {
  msgs: BotMsg[];
  prefs?: Prefs;
  answers?: Record<string, string>;
  profile?: Partial<Profile>;
};
