LOCAL DEVELOPMENT ONLY

Import fixflow-demo.sql with MySQL Workbench: open the file and execute all.
It creates fixflow_demo with the full domain schema and sample rows. It does not
change fixflow, drop tables, or reset existing passwords. Re-import is additive.
Spring Boot creates its JDBC session tables when you start the backend.

Set DB_NAME=fixflow_demo in the SAME run configuration/env file your backend uses.
Keep your existing DB_HOST, DB_PORT, DB_USER and DB_PASSWORD.
Restart the backend after changing configuration.

Demo accounts (all share password FixflowDemo!2026):
  superadmin@fixflow.test  super_admin, no site
  admin@fixflow.test       admin, site 1
  staff@fixflow.test       staff, site 1
  reporter@fixflow.test    reporter, site 1
  technician@fixflow.test  technician, no site; contracted to site 1
  hoteladmin@fixflow.test  admin, site 2
School site 1 has E5 and A1 subsites. A sample plumbing report is included.
Passwords are stored as BCrypt hashes, not plaintext. These are PUBLIC TEST
PASSWORDS; never use these accounts or import this database in production.

HTTP development:
  Leave SESSION_COOKIE_SECURE unset/blank, or explicitly set false.
  An existing SESSION_COOKIE_SECURE=true still forces HTTPS-only cookies.
  Production: set SESSION_COOKIE_SECURE=true and serve HTTPS.
  For an HTTPS reverse proxy, configure trusted forwarded headers appropriately.

Web: use the Vite /api proxy (leave VITE_API_URL blank).
Expo: leave EXPO_PUBLIC_API_URL blank; start with npx expo start --lan --clear.
PC and phone must share a network; allow backend TCP 8080 on a PRIVATE firewall
network. Do not expose the development backend publicly.
Expo web opened via a LAN IP additionally needs its exact browser origin:
  CORS_ALLOWED_ORIGIN_PATTERNS=http://localhost:*,http://127.0.0.1:*,http://YOUR_PC_IP:8081
Replace YOUR_PC_IP and 8081 with the browser's actual address and port.
Native Expo requests do not require browser CORS permission.
Do not mix localhost and 127.0.0.1 between browser and API.
Explicit EXPO_PUBLIC_API_URL overrides LAN detection; tunnels need an explicit
reachable backend URL. Clear Expo's cache after changing public env variables.

Invalid credentials means the email/password was rejected; it is different
from a successful login followed by /api/auth/me returning 401 (cookie loss).
The demo database makes the backend database and credentials deterministic.
