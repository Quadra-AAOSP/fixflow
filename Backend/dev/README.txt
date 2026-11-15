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
  reporter@fixflow.test       reporter   CNU School
  staff@fixflow.test          staff      CNU School
  admin@fixflow.test          admin      CNU School
  technician@fixflow.test     technician (site_id NULL; contracted to CNU School)
  superadmin@fixflow.test     super_admin
  shopmanager@fixflow.test    shop_manager

Per site (s=1 CNU School, s=2 CNU Hostel, s=3 CNU Hotel), n=1..5:
  reporter{n}.site{s}@fixflow.test
  staff{n}.site{s}@fixflow.test
  admin{n}.site{s}@fixflow.test
  technician{n}.site{s}@fixflow.test
Notes:
  - For site 1, n=1 uses the classic alias emails above (not reporter1.site1@…).
  - Technicians always have users.site_id NULL and a technician_contracts row
    for their site (with flat fee).
  - Each site has 5 reporters + 5 staff + 5 admins + 5 technicians.

Globals n=1..5:
  superadmin{n}@fixflow.test   (n=1 => superadmin@fixflow.test)
  shopmanager{n}@fixflow.test  (n=1 => shopmanager@fixflow.test)


Sites
-----
  CNU School  (school, contracted)  + MAIN subsite
  CNU Hostel  (hostel, contracted)  + MAIN subsite
  CNU Hotel   (hotel, contracted)   + MAIN subsite


Technician onboarding seed
--------------------------
Contracted technicians are seeded verified (all platform checks), with site
vetting approved, skills, availability=available, and terms acceptance for:

  TECHNICIAN_TERMS_VERSION=2026-11-03
  TECHNICIAN_TERMS_DOCUMENT_URL=/api/technician-terms/document
  (demo acceptances also record the absolute agreements HTML URL)

Skill proficiency is platform-owned: inserts omit proficiency so the column
DEFAULT 2.5 applies. It is not self-assessed; the service recalculates from
confirmed reporter ratings in batches of 5.


Sample demo content
-------------------
- Reports across open/routed/assigned/in_progress/resolved/confirmed/reopened/
  escalated, including multi-joiner reports for urgency tests
- Marketplace listing + applications (with pay amounts)
- Job offers table (paid contracted assignment path)
- Report notifications (report-scoped and account-level via reference_id)
- One paid shop order (items + succeeded payment, fulfillment_status=ordered)
  for shopmanager@fixflow.test fulfillment demos


Reload example
--------------
  mysql -u root -p < Backend/dev/fixflow-demo.sql

Re-running the SQL seed is safe: inserts use INSERT IGNORE / WHERE NOT EXISTS
and will not overwrite changed passwords or shop stock.
