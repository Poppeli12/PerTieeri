"""
Asuntolainahakemukset (Junction 2026 S-Pankki) → Per Tieerin asiakasdataan.

Ajo (build-data.py:n jälkeen):  python scripts/build-mortgage.py [polku-repoon]

- mtg_tx_customer_link_and_final_mtg_infio.csv: 200 hakemusta, linkki customer_id:hen + lopputulos
- mtg_negotiation_history.csv: hakemusten tapahtumahistoria
Tuottaa:
  data/customers/<ID>.json   lisää kentän "mortgage" (lopputulos + aikajana) hakemuksen tehneille
  data/index.json            asiakkaalle "mortgage": "approved" | "rejected"
  data/mortgage.json         kaikkien hakemusten tunnusluvut vertailuun (mediaanit, hylkäyssyyt)
"""
import json
import sys
from datetime import datetime

import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else 'C:/Users/HP/junction-data/repo'
OUT = 'data'

link = pd.read_csv(f'{SRC}/mtg_tx_customer_link_and_final_mtg_infio.csv', encoding='utf-8-sig')
hist = pd.read_csv(f'{SRC}/mtg_negotiation_history.csv', encoding='utf-8-sig')
hist['ts'] = hist.timestamp.apply(lambda s: datetime.strptime(s, '%d%b%y:%H:%M:%S').isoformat())
hist = hist.sort_values(['mortgage_customer_id', 'ts'])


def clean(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


by_mc = {}
for mc, g in hist.groupby('mortgage_customer_id'):
    events = []
    for r in g.itertuples(index=False):
        e = {'ts': r.ts, 'event': r.event_type}
        for k in ['property_id', 'property_type', 'property_price_estimate', 'loan_amount', 'equity_amount', 'collateral_type', 'collateral_value', 'collateral_status', 'decision', 'rejection_reason', 'expense_type', 'expense_amount', 'note']:
            v = clean(getattr(r, k))
            if v is not None:
                e[k] = v
        events.append(e)
    by_mc[mc] = events

idx = json.load(open(f'{OUT}/index.json', encoding='utf-8'))
status = {}
for r in link.itertuples(index=False):
    final = {
        'mortgage_customer_id': r.mortgage_customer_id,
        'decision': r.final_decision,
        'rejection_reason': clean(r.rejection_reason),
        'property_price_eur': int(r.final_property_price_eur),
        'requested_loan_eur': int(r.final_requested_loan_eur),
        'equity_eur': int(r.final_equity_amount_eur),
        'collateral_value_eur': int(r.final_collateral_value_eur),
        'required_monthly_income_eur': round(float(r.required_monthly_income_eur), 2),
        'loan_to_value': round(float(r.lfinal_loan_to_value), 4),
    }
    path = f'{OUT}/customers/{r.customer_id}.json'
    d = json.load(open(path, encoding='utf-8'))
    d['mortgage'] = {'final': final, 'events': by_mc.get(r.mortgage_customer_id, [])}
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    status[r.customer_id] = r.final_decision

for c in idx['customers']:
    if c['id'] in status:
        c['mortgage'] = status[c['id']]
json.dump(idx, open(f'{OUT}/index.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))


def q(s):
    s = s.dropna()
    return {'median': round(float(s.median()), 2), 'p25': round(float(s.quantile(0.25)), 2), 'p75': round(float(s.quantile(0.75)), 2), 'n': int(len(s))}


stats = {
    'source': 'Junction 2026 – S-Pankin synteettiset asuntolainahakemukset (200 kpl)',
    'n': int(len(link)),
    'decisions': link.final_decision.value_counts().to_dict(),
    'rejection_reasons': link.rejection_reason.value_counts().to_dict(),
    'all': {k: q(link[c]) for k, c in [('property_price_eur', 'final_property_price_eur'), ('requested_loan_eur', 'final_requested_loan_eur'), ('equity_eur', 'final_equity_amount_eur'), ('loan_to_value', 'lfinal_loan_to_value'), ('required_monthly_income_eur', 'required_monthly_income_eur')]},
    'by_decision': {
        dec: {k: q(g[c]) for k, c in [('loan_to_value', 'lfinal_loan_to_value'), ('equity_eur', 'final_equity_amount_eur'), ('required_monthly_income_eur', 'required_monthly_income_eur')]}
        for dec, g in link.groupby('final_decision')
    },
}
json.dump(stats, open(f'{OUT}/mortgage.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('lainahakemuksia', len(link), '->', len(status), 'asiakasta; paatokset', stats['decisions'])
