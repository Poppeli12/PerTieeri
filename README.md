# Per Tieeri – your personal economic trainer inside S-mobiili

> *An old-fashioned banker who teaches you your own money – with your own numbers.*

Junction 2026 · **S-Pankki challenge: Personal Economic Trainer**

**Live demo:** https://per-tieeri.expo.app (opens in a phone frame on desktop, full screen on mobile – no install or login needed)

---

## The problem

Banking apps show balances and transaction lists, but they rarely help people understand *why* money runs out, what is safe to spend, or how small habits add up. Generic financial advice doesn't stick, because it isn't about *your* life.

## The solution

Per Tieeri is an AI finance coach built into an S-mobiili lookalike app. He is a dignified, slightly old-fashioned banker with dry humour who speaks formally ("Te"), explains things simply, and **uses the customer's own transactions as the teaching material**.

The agent is a real LLM conversation (OpenAI Responses API with tool calling), not a decision tree. It decides which tools to use, fetches the customer's real data, computes, visualises and explains – and it says so honestly when something is uncertain.

### What it can do

| Feature | What the customer gets |
|---|---|
| **Three money buckets** | Every expense is sorted into *mandatory regular*, *mandatory irregular* and *everyday slippage*. Per Tieeri animates the sorting with real receipts from the customer's data. |
| **Safe to spend** | Balance → upcoming rent, bills, groceries and buffer → what is really free until payday, shown as a step-by-step cashflow card. |
| **Forecasts with honest uncertainty** | Monte Carlo balance forecast from the customer's own rhythm (detected salary and rent days). Answers such as "how much will I have at the end of December?" come as a range, together with the reasons it is uncertain and a clarifying question. |
| **What-if & goals** | Persistent scenarios ("cut restaurants 30 %", "buy a 700 € laptop in March"), savings and balance goals with alternative plans, budget planner. |
| **Change detective, runway, subscriptions** | Why there was less money this month, how long savings would last without income, and which payments are recurring. Recurring vs. one-off is decided from payment metadata (type, MCC, merchant ID, timing), not price alone. |
| **Comparisons with sources** | (1) other S-Pankki customers in the dataset – same age band, same 12-month window, median and quartiles; (2) Statistics Finland (StatFin PxWeb API, live) – mean vs. median labelled, year and table shown, household vs. person caveats. |
| **Mortgage explanation** | The customer's own application timeline and decision, compared with the other 200 applications in the dataset. |
| **Pedagogy** | Short, structured answers (numbered steps, headings, bullet points, icons), plain-language explanations, one concept at a time, occasional understanding checks, monthly quiz game. |
| **Visualisations** | Bar (with values on bars and a y-axis), line, pie (drawn clockwise, total in the centre), 100-square "where did 1 000 € go", bucket cards. |
| **Memory** | Each customer has their own conversation history, profile, goals and scenarios, saved locally and in Supabase. |

All 5 100 customers of the official dataset can be selected (**Minä → Vaihda asiakasta**), and every view switches to that customer's data.

---

## Architecture

```
Expo app (React Native + React Native Web)
 ├─ UI: S-mobiili lookalike, Figtree font, custom SVG icons and illustrations
 ├─ Agent loop (src/agent/llm.ts): OpenAI Responses API + tool calls
 │    └─ tools run on-device on the customer's data (src/agent/tools.ts, coach.ts, compare.ts, finland.ts)
 └─ Memory: AsyncStorage + Supabase (anonymous session, RLS per user)

Supabase
 ├─ Edge Function "api" (supabase/functions/api)
 │    ├─ POST /api/agent  → OpenAI (key is a server-side secret; session required; rate limits and daily quotas)
 │    └─ GET  /api/customer(s), /api/peers, /api/mortgage-stats, /api/statfin/*
 ├─ Storage bucket "pt-data": the dataset as JSON (all 5 100 customers, peer metrics, StatFin cache)
 └─ Postgres: pt_customer_memory (RLS: owner only), pt_ai_usage (quota, service role only)

Web hosting: EAS Hosting (https://per-tieeri.expo.app)
```

During development the same API runs inside the Metro dev server (`metro.config.js` → `server/api.js`). Both environments use one shared core, `supabase/functions/_shared/pt-core.mjs`.

## Tech stack

- **Expo SDK 58**, React Native 0.88, React Native Web, react-native-svg, TypeScript
- **OpenAI Responses API** with function calling (model configured server-side)
- **Supabase**: Edge Functions (Deno), Storage, Postgres with Row Level Security, anonymous auth
- **Statistics Finland** StatFin PxWeb API (json-stat2)
- **EAS Hosting** for the web build, **EAS Build** for the Android APK
- Python (pandas) for dataset preparation

## Data sources

1. **Junction 2026 S-Pankki dataset** – https://github.com/hackjunction/Junction-2026-S-pankki
   - 5 100 synthetic customers, about 3.6 million transactions (10/2024–9/2026), and 200 mortgage applications with negotiation history.
   - All fields are used: account, date, time, category, amount, balance, transaction type, merchant ID, MCC, age, postal code, and the mortgage fields and events.
2. **Statistics Finland (StatFin)**:
   - `tjt/11py`: disposable income by age (median and mean)
   - `ktutk/14ph`, `14q4`, `14pg`: household consumption (mean)
   - `khi/11xt`: consumer price index.
3. **Food reference budgets 2025**: Takuusäätiö, Martat and Kuluttajatutkimuskeskus.

More detail: [docs/DATA.md](docs/DATA.md), [docs/COMPARISONS.md](docs/COMPARISONS.md).

## Security & cost control

- The OpenAI key exists only as a Supabase Edge Function secret (and in a local `.env.local` for development). It is never in the app bundle or in this repository.
- The agent endpoint requires a valid Supabase session. The public (publishable) key alone is rejected.
- Rate limits protect the agent: requests per minute, a per-user daily quota and a global daily cap (`pt_ai_usage`). The model and maximum output are fixed server-side.
- Row Level Security: a user can read and write only their own `pt_customer_memory` rows. The anonymous role has no table access.
- The dataset is public synthetic data, so the storage bucket is public read-only.
- A server-side switch, `DEMO_AI_ENABLED` (a Supabase secret), turns the agent off before any OpenAI call is made. Turn it on or off with `npm run ai:on` and `npm run ai:off`, and check it with `npm run ai:status`. No rebuild is needed; data and memories stay available.

## Run locally

Requirements: Node 20+, npm, and a clone of the dataset repository (Git LFS).

```bash
npm install

# 1) build the dataset JSON (writes data/customers/*.json, data/index.json, data/metrics.json)
python scripts/build-data.py /path/to/Junction-2026-S-pankki
python scripts/build-mortgage.py

# 2) secrets for the dev server (never commit this file)
cp .env.example .env.local
#   OPENAI_API_KEY=...            (server-side only, no EXPO_PUBLIC_ prefix)
#   OPENAI_MODEL=...
#   EXPO_PUBLIC_SUPABASE_URL=...  (optional, cloud memory)
#   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...

# 3) start
npx expo start            # press w for web, or scan the QR code with Expo Go
```

Checks: `npx tsc --noEmit` and `npx expo lint`.

The personal game is opened by **Aloita peli**, which sends a normal chat message (`Haluan kokeilla peliä`). The LLM chooses `monthly_game`; free-form requests work through the same tool selection. It creates three multiple-choice questions and two open euro estimates from the selected customer's transactions. Answers and position use the existing customer memory; revisiting a question does not award points twice. The score-based coupon is a clearly labelled demo reward, not a redeemable discount.

Game checks: `node scripts/test-game.js` (local customer datasets), `node scripts/test-sorting-motion.js`, and `node scripts/test-game-ui.js <web URL>` (mocked AI with real configured data/memory). Add `--live` only when an actual cloud AI test is intended; add `--paraphrase` to test free-form game intent. Live tests consume a small number of AI calls and create a fresh anonymous test session.

## Deploy

```bash
# Supabase (once): run the SQL files in supabase/migrations, enable anonymous sign-ins, then
node scripts/cloud-upload.mjs                      # dataset → Storage (needs SUPABASE_SERVICE_ROLE_KEY in .env.local)
npx supabase functions deploy api --no-verify-jwt
npx supabase secrets set --env-file <file with OPENAI_API_KEY, OPENAI_MODEL>

# Web
npx expo export --platform web && npx eas-cli deploy --prod

# Android APK
npx eas-cli build --profile preview --platform android
```

The production build reads `EXPO_PUBLIC_API_BASE` from `.env.production`, so it talks to the cloud API instead of a local machine.

## Project structure

```
App.tsx                      app shell, tabs, desktop phone frame
src/screens/                 Koti, S-Etukortti, Tuki (Per Tieeri chat), Pankki, Minä, customer picker
src/agent/                   persona, LLM loop, tools (coach, comparisons, Statistics Finland)
src/finance/                 analytics, buckets, forecasts, payment patterns, optimiser
src/components/              UI, charts, cards, Per Tieeri character and animations
supabase/functions/          Edge Function (cloud API) + shared core
supabase/migrations/         memory table + RLS, AI usage quota
scripts/                     dataset build, cloud upload, tests
docs/                        data sources, comparisons, memory, Supabase setup
```

## Notes

- This is a hackathon prototype. It uses a synthetic dataset and is **not investment advice**.
- The S-mobiili look is recreated for the S-Pankki challenge demo.
