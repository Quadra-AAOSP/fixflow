FixFlow demo SQL dump
=====================

File: fixflow-demo.sql

Loads a disposable MySQL database named fixflow_demo with schema + demo
accounts/reports/shop sample. Built by concatenating:

  src/main/resources/db/schema.sql
  src/main/resources/db/demo-data.sql

Enable in-app seeding instead with SEED_DEMO_DATA=true (loads demo-data.sql via
SqlDataSeeder; still requires schema.sql on startup).


Demo accounts (70 total @fixflow.test)
--------------------------------------
Password for every account is the email address itself.

Compatibility aliases (site 1 / globals n=1):
  reporter@fixflow.test       reporter   Demo School
  staff@fixflow.test          staff      Demo School
  admin@fixflow.test          admin      Demo School
  technician@fixflow.test     technician (site_id NULL; contracted to Demo School)
  superadmin@fixflow.test     super_admin
  shopmanager@fixflow.test    shop_manager

Per site (s=1 Demo School, s=2 Demo Hostel, s=3 Demo Hotel), n=1..5:
  reporter{n}.site{s}@fixflow.test
  staff{n}.site{s}@fixflow.test
  admin{n}.site{s}@fixflow.test
  technician{n}.site{s}@fixflow.test
Notes:
  - For site 1, n=1 uses the classic alias emails above (not reporter1.site1@…).
  - Technicians always have users.site_id NULL and a technician_contracts row
    for their site.
  - Each site has 5 reporters + 5 staff + 5 admins + 5 technicians.

Globals n=1..5:
  superadmin{n}@fixflow.test   (n=1 => superadmin@fixflow.test)
  shopmanager{n}@fixflow.test  (n=1 => shopmanager@fixflow.test)


Sites
-----
  Demo School  (school, contracted)  + MAIN subsite
  Demo Hostel  (hostel, contracted)  + MAIN subsite
  Demo Hotel   (hotel, contracted)   + MAIN subsite


Technician onboarding seed
--------------------------
Contracted technicians are seeded verified (all platform checks), with site
vetting approved, skills, availability=available, and terms acceptance for:

  TECHNICIAN_TERMS_VERSION=demo-v1
  TECHNICIAN_TERMS_DOCUMENT_URL=https://example.test/technician-terms/demo-v1

Set those env vars (see .env.example) when exercising terms-gated flows against
this dump.


Sample demo content
-------------------
- Reports across open/routed/assigned/in_progress/resolved/confirmed/reopened/
  escalated, including multi-joiner reports for urgency tests
- Marketplace listing + applications
- Report notifications (e.g. work completed)
- One paid shop order (items + succeeded payment, fulfillment_status=ordered)
  for shopmanager@fixflow.test fulfillment demos


Reload example
--------------
  mysql -u root -p < Backend/dev/fixflow-demo.sql

Re-running the SQL seed is safe: inserts use INSERT IGNORE / WHERE NOT EXISTS
and will not overwrite changed passwords or shop stock.
