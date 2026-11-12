from pathlib import Path
import json,subprocess,os,re
record=json.loads(Path('/tmp/fixflow-hci-live/customer-order-test-record.json').read_text());oid=record['orderId'];assert re.fullmatch(r'[a-f0-9-]{36}',oid)
values={}
for line in Path('Backend/.env').read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);values[k]=v.strip().strip('"').strip("'")
env=os.environ.copy();env['MYSQL_PWD']=values.get('DB_PASSWORD','');base=['mysql','--protocol=TCP','-h',values.get('DB_HOST','127.0.0.1'),'-P',values.get('DB_PORT','3306'),'-u',values.get('DB_USER','fixflow'),'-D',values.get('DB_NAME','fixflow'),'-N','-B']
def query(sql):
 r=subprocess.run(base+['-e',sql],env=env,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Order fixture query failed; details suppressed.')
 return r.stdout.strip()
match=query(f"SELECT o.id FROM shop_orders o JOIN shop_payments p ON p.order_id=o.id WHERE o.public_id='{oid}' AND o.shipping_name='HCI LOCAL TEST — CANCEL AFTER REVIEW' AND o.idempotency_key LIKE 'hci-live-audit-%' AND o.status='cancelled' AND p.provider='dev' AND p.status='cancelled'")
assert match.isdigit(),'Fixture identity/state mismatch: nothing removed.'
internal=int(match);before=int(query(f"SELECT COUNT(*) FROM shop_orders WHERE public_id<>'{oid}'"))
product=record['productId'];assert re.fullmatch('[a-zA-Z0-9_-]+',product)
stockBefore=query(f"SELECT stock FROM shop_products WHERE id='{product}'")
query(f"START TRANSACTION; DELETE FROM shop_notifications WHERE order_id='{oid}'; DELETE FROM shop_orders WHERE id={internal} AND public_id='{oid}' AND status='cancelled'; COMMIT;")
assert query(f"SELECT COUNT(*) FROM shop_orders WHERE public_id='{oid}'")=='0'
assert int(query('SELECT COUNT(*) FROM shop_orders'))==before
assert query(f"SELECT stock FROM shop_products WHERE id='{product}'")==stockBefore
Path('/tmp/fixflow-hci-live/customer-order-cleanup.json').write_text(json.dumps({'ownedOrderRemoved':True,'otherOrdersUnchanged':True,'stockUnchanged':True}))
print('Labelled cancelled audit order removed. Other order count and stock unchanged.')
