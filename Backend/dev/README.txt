LOCAL DEVELOPMENT ONLY

Two ways to load the data (no profiles):

1. Automatic startup: use an isolated development database, set SEED_DEMO_DATA=true
   in the backend env file, then start the backend. The normal schema initializer
   creates tables; SqlDataSeeder reads db/reference-data.sql and db/demo-data.sql.
   Leave SEED_DEMO_DATA=false in production. Known-password demo accounts are unsafe.

2. MySQL Workbench: execute fixflow-demo.sql in full. This standalone snapshot
   creates/selects fixflow_demo and includes the current schema plus both SQL data
   resources. Set DB_NAME=fixflow_demo in your backend env file and restart.
   Keep DB_HOST, DB_PORT, DB_USER and DB_PASSWORD appropriate to your machine.

With SEED_DEMO_DATA unset or false, the original SiteRulesSeeder,
ShopCatalogSeeder and BootstrapSuperAdminRunner run normally; SqlDataSeeder is inactive.
With SEED_DEMO_DATA=true, those original seeders are inactive and only SqlDataSeeder
runs. All classes are retained. Set the flag only in your ignored local Backend/.env.

The local SQL seeder reads these seed rows:
  src/main/resources/db/reference-data.sql: fixed taxonomy and initial shop catalogue.
  src/main/resources/db/demo-data.sql: optional development fixtures.
  dev/fixflow-demo.sql: combined standalone MySQL snapshot.
Keep the snapshot in sync when changing the resources or schema.

All NEW sample accounts use PASSWORD = THEIR FULL EMAIL, exactly as below.
Each has a separate BCrypt hash; passwords are never stored as plaintext.

  superadmin@fixflow.test       super_admin   no site
  admin@fixflow.test            admin         Demo School
  staff@fixflow.test            staff         Demo School
  reporter@fixflow.test         reporter      Demo School
  technician@fixflow.test       technician    no site
  hoteladmin@fixflow.test       admin         Demo Hotel
  shopmanager@fixflow.test      shop_manager  no site
  hosteladmin@fixflow.test      admin         Demo Hostel
  hotelreporter@fixflow.test    reporter      Demo Hotel
  independent@fixflow.test      technician    no site
  pendingadmin@fixflow.test     reporter      Demo Setup Campus
  rejectedadmin@fixflow.test    reporter      Demo School

Example: email admin@fixflow.test / password admin@fixflow.test.
Existing accounts are NOT reset, including earlier demo accounts with older passwords.
If an account already existed, use its existing password. This import never changes it.
Do not expect re-importing to promote an existing user or overwrite their edits.

Fixture coverage:
  School, hotel, hostel and a campus without buildings for onboarding tests.
  Active labelled buildings plus an archived annex; missing-building alerts.
  Staff/reporters/site admins, super admin, shop manager and independent technician.
  Contracted technician with null site; pending/approved/rejected contract requests.
  Pending and rejected site-admin applications (applicants remain reporters).
  Open, assigned, in-progress, pending-confirmation, confirmed, reopened and escalated reports.
  Separate reporter/AI urgency, null-AI fallback and sensitive room addresses.
  Report membership and historical status audit rows.
  Shop products plus a historical paid dev order with matching lines/payment.
  Demo stock is the current opening balance; importing history does not reserve stock again.
  No fake terms acceptance, uploaded documents, active sessions or live provider calls.

Re-imports add missing fixtures only. They never delete data or reset passwords,
stock, report edits, contract decisions or application decisions. Stop concurrent
writers while importing. The dump is intended for an isolated development database,
not for merging into arbitrary production data. Back up any existing database first.
The bootstrap super-admin runner remains environment-configured for the normal
seed path. It is inactive while SQL demo seeding is enabled.

HTTP local development: SESSION_COOKIE_SECURE=false. Production requires HTTPS and
SESSION_COOKIE_SECURE=true. PC and phone must share a network and backend TCP 8080
must be reachable. Browser frontend/backend hostnames must match for session cookies.
Release mobile builds require an explicit EXPO_PUBLIC_API_URL. No frontend changes
are included in this SQL-seeding task.
