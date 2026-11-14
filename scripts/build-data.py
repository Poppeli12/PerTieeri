"""
S-Pankin Junction 2026 -aineisto → Per Tieerin tietojärjestelmä.

Ajo:  python scripts/build-data.py [polku/Junction-2026-S-pankki]
      (oletus C:/Users/HP/junction-data/repo, ks. https://github.com/hackjunction/Junction-2026-S-pankki)

Tuottaa (data/, ei gittiin – koko ~300 Mt):
  data/customers/<ID>.json   jokaisen asiakkaan KAIKKI tapahtumat sovelluksen muodossa
  data/index.json            asiakaslista (ikä, postinumero, havaintojakso, tapahtumamäärä, tulot)
  data/metrics.json          vertailumittarit jokaiselle asiakkaalle SAMALTA 12 kk ikkunalta
                             (asiakkaiden väliseen vertailuun: mediaanit, kvartiilit, ryhmän koko lasketaan palvelimella)

Vertailumittarit lasketaan kaikille samalta jaksolta (VIIMEISET 12 KK = 2025-10-01 … 2026-09-30),
koska kaikkien asiakkaiden havaintojakso kattaa sen kokonaan (tarkistettu). Näin kenenkään yhden kuukauden
menoja ei verrata toisten koko vuoteen.
"""
import json
import os
import sys

import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else 'C:/Users/HP/junction-data/repo'
OUT = 'data'
WIN_FROM, WIN_TO = '2025-10-01', '2026-09-30'
MONTHS = 12

os.makedirs(f'{OUT}/customers', exist_ok=True)
tx = pd.read_csv(f'{SRC}/tx_junction_transactions.csv', encoding='utf-8-sig', dtype={'merchant_id': 'string', 'mcc_code': 'Int64'})
cu = pd.read_csv(f'{SRC}/tx_customers_junction.csv', encoding='utf-8-sig')
print('tapahtumia', len(tx), 'asiakkaita', len(cu))

tx['t'] = tx.tx_timestamp.str[-8:]
tx = tx.sort_values(['customer_id', 'tx_date', 't'])
cu['postal'] = cu.customer_postal_code.astype(int).astype(str).str.zfill(5)

SPEND_TYPES = {'purchase', 'utilities_payment', 'housing_payment'}
SAVE_TYPES = {'investment_deposit', 'salary_sweep'}
CATS = ['Groceries', 'Restaurants', 'Transportation', 'Utilities', 'Housing', 'Entertainment', 'Health', 'Home & Tech', 'Lifestyle', 'Travel']

index, metrics = [], {}
ages = dict(zip(cu.customer_id, cu.customer_age))
postals = dict(zip(cu.customer_id, cu.postal))

for cid, g in tx.groupby('customer_id', sort=True):
    recs = []
    for r in g.itertuples(index=False):
        recs.append({
            'account': str(r.bank_account_id),
            'd': r.tx_date, 't': r.t, 'c': r.category, 'a': round(float(r.tx_amount_eur), 2), 'b': round(float(r.balance_after_eur), 2),
            'ty': r.transaction_type, 'm': None if pd.isna(r.merchant_id) else str(r.merchant_id),
            'mcc': None if pd.isna(r.mcc_code) else int(r.mcc_code),
        })
    with open(f'{OUT}/customers/{cid}.json', 'w', encoding='utf-8') as f:
        json.dump({'customer': {'id': cid, 'age': int(ages[cid]), 'postal': postals[cid]}, 'transactions': recs}, f, ensure_ascii=False, separators=(',', ':'))

    w = g[(g.tx_date >= WIN_FROM) & (g.tx_date <= WIN_TO)]
    out = w[w.tx_amount_eur < 0]
    spend = out[out.transaction_type.isin(SPEND_TYPES)]
    income = w[w.transaction_type.isin({'salary', 'other_income'})].tx_amount_eur.sum() / MONTHS
    salary = w[w.transaction_type == 'salary'].tx_amount_eur.sum() / MONTHS
    saved = -out[out.transaction_type.isin(SAVE_TYPES)].tx_amount_eur.sum() / MONTHS - w[w.transaction_type == 'investment_withdrawal'].tx_amount_eur.sum() / MONTHS
    spend_total = -spend.tx_amount_eur.sum() / MONTHS
    by_cat = (-spend.groupby('category').tx_amount_eur.sum() / MONTHS).to_dict()
    taxi = -spend[spend.mcc_code == 4121].tx_amount_eur.sum() / MONTHS
    bal_start = float(g[g.tx_date < WIN_FROM].balance_after_eur.iloc[-1]) if (g.tx_date < WIN_FROM).any() else float(w.balance_after_eur.iloc[0])
    bal_end = float(g.balance_after_eur.iloc[-1])
    m = {
        'income': round(income, 2),
        'salary': round(salary, 2),
        'spend_total': round(spend_total, 2),
        'saved': round(saved, 2),
        'savings_rate': round((income - spend_total) / income, 4) if income > 0 else None,
        'balance_end': round(bal_end, 2),
        'balance_change': round(bal_end - bal_start, 2),
        'taxi': round(taxi, 2),
        'tx_per_month': round(len(w) / MONTHS, 1),
    }
    for c in CATS:
        m['cat:' + c] = round(by_cat.get(c, 0.0), 2)
    metrics[cid] = m
    index.append({
        'id': cid, 'age': int(ages[cid]), 'postal': postals[cid], 'n': len(g), 'first': g.tx_date.iloc[0], 'last': g.tx_date.iloc[-1],
        'income': round(income), 'balance': round(bal_end),
    })

meta = {
    'source': 'Junction 2026 – S-Pankki synteettinen aineisto (github.com/hackjunction/Junction-2026-S-pankki)',
    'window': {'from': WIN_FROM, 'to': WIN_TO, 'months': MONTHS},
    'definitions': {
        'income': 'palkka + muut tulot tilille, €/kk keskimäärin ikkunassa',
        'spend_total': 'ostot + laskut + asumismaksut (ei sijoituksia/säästösiirtoja), €/kk',
        'saved': 'sijoitukset + säästösiirrot − sijoitusten nostot, €/kk',
        'savings_rate': '(tulot − kulutus) / tulot',
        'cat:*': 'kategorian menot €/kk (pankkiaineiston kategoriat)',
        'taxi': 'MCC 4121 (taksit ja kuljetuspalvelut) €/kk',
    },
}
with open(f'{OUT}/index.json', 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'customers': index}, f, ensure_ascii=False, separators=(',', ':'))
with open(f'{OUT}/metrics.json', 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'metrics': metrics}, f, ensure_ascii=False, separators=(',', ':'))
print('valmis:', len(index), 'asiakasta')
