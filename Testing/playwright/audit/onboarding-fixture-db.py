from pathlib import Path
import subprocess,os,json,sys
manifest=Path('/tmp/fixflow-hci-onboarding-private.json');data=json.loads(manifest.read_text())
values={}
for line in Path('Backend/.env').read_text().splitlines():
 if '=' in line and not line.lstrip().startswith('#'):
  k,v=line.split('=',1);values[k]=v.strip().strip('"').strip("'")
env=os.environ.copy();env['MYSQL_PWD']=values.get('DB_PASSWORD','')
base=['mysql','--protocol=TCP','-h',values.get('DB_HOST','127.0.0.1'),'-P',values.get('DB_PORT','3306'),'-u',values.get('DB_USER','fixflow'),'-D',values.get('DB_NAME','fixflow'),'-N','-B']
def run(q):
 r=subprocess.run(base+['-e',q],env=env,capture_output=True,text=True)
 if r.returncode:raise RuntimeError('Fixture database operation failed; details suppressed to protect test credentials.')
 return r.stdout.strip()
site=int(data['siteId']);admin=int(data['adminId']);reporter=int(data['reporterId'])
assert all(x>0 for x in [site,admin,reporter]);assert data['label'].startswith('HCI-AUDIT-')
owned=run(f"SELECT COUNT(*) FROM users WHERE id IN ({admin},{reporter}) AND email LIKE 'hci-audit-%@example.invalid' AND site_id={site}")
assert owned=='2','Fixture ownership did not match; no writes performed.'
if sys.argv[1]=='application-only':
 run(f"INSERT INTO site_admin_applications(user_id,site_id,status) SELECT {reporter},{site},'pending' WHERE NOT EXISTS(SELECT 1 FROM site_admin_applications WHERE user_id={reporter})")
 print('Temporary application-only fixture prepared.')
elif sys.argv[1]=='cleanup':
 app=int(data['applicationId']);assert run(f"SELECT COUNT(*) FROM site_applications WHERE id={app} AND site_id={site} AND admin_id={admin}")=='1'
 assert run(f"SELECT COUNT(*) FROM users WHERE site_id={site}")=='2','Other site users present; cleanup refused.'
 assert run(f"SELECT COUNT(*) FROM reports WHERE site_id={site}")=='0','Other site data present; cleanup refused.'
 run(f"START TRANSACTION; DELETE FROM site_admin_applications WHERE user_id={reporter} AND site_id={site}; DELETE FROM site_application_audit WHERE application_id={app}; DELETE FROM site_applications WHERE id={app} AND site_id={site} AND admin_id={admin}; DELETE FROM users WHERE id IN ({admin},{reporter}) AND site_id={site}; DELETE FROM sites WHERE id={site} AND name LIKE 'HCI-AUDIT-%'; COMMIT;")
 assert run(f"SELECT COUNT(*) FROM users WHERE id IN ({admin},{reporter})")=='0'
 assert run(f"SELECT COUNT(*) FROM sites WHERE id={site}")=='0'
 print('Owned onboarding fixtures removed; verification counts zero.')
