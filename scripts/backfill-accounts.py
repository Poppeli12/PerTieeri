"""Restore source account IDs without rebuilding or removing mortgage data."""
import json
from pathlib import Path
import pandas as pd

source = Path('C:/Users/HP/junction-data/repo/tx_junction_transactions.csv')
rows = pd.read_csv(source, encoding='utf-8-sig', usecols=['customer_id', 'bank_account_id']).drop_duplicates()
assert rows.groupby('customer_id').size().max() == 1, 'Multiple accounts require a transaction-level join'
accounts = dict(zip(rows.customer_id, rows.bank_account_id))
files = list(Path('data/customers').glob('*.json')) + [Path('src/data/customer.json')]
for file in files:
    data = json.loads(file.read_text(encoding='utf-8'))
    account = accounts[data['customer']['id']]
    for tx in data['transactions']:
        tx['account'] = account
    file.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'Restored original account IDs in {len(files)} files; mortgage data preserved.')
