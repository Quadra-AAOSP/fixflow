Hi team,

The web updates are ready, and we need these backend changes to finish the requested behaviour. The route names below are proposals; please confirm the final DTOs and paths before implementation.

1. **Reporter missing-building suggestions**
   - `SubsiteService.requestAddition` currently rejects a second pending suggestion for the same reporter/site. Please allow multiple distinct pending suggestions; prevent exact duplicate retries using an idempotency key rather than blocking all pending requests.
   - Add an authenticated own-history endpoint (proposed `GET /api/me/subsite-requests`) returning only the current user's requests, including site ID/name, note, request ID, pending/resolved status and submitted/resolved timestamps. Include pagination and optional site/status filters. Keep the existing admin inbox restricted to administrators.
   - Keep POST `/api/sites/{siteId}/subsite-requests` and return the saved request. The web now has `/building-suggestions`; it can submit through POST, but it cannot retrieve full history or override the existing pending-request restriction.

2. **Technician hiring marketplace**
   - Add an authenticated technician-accessible listing endpoint (proposed `GET /api/marketplace/sites`) for sites explicitly accepting technicians. Include site ID, name, safe location description, required trades/specialties, opportunity description and whether applications are open; support search/pagination.
   - Provide authorized site-admin controls for opening/closing hiring and editing listing requirements. Do not infer hiring availability from a site's maintenance contract status.
   - Existing technician contract requests should continue through `/api/technician-contract-requests`, with duplicates/current terms/site eligibility enforced by the server.
   - Web route `/technician/marketplace` is available. Until a listing contract is published, it shows the integration notice and the existing functional contract-request/tracking panel, without fabricated hiring listings.

3. **Persisted technician trade profile**
   - Skill submission exists, but there is no own-skills read endpoint. Please add a read API (proposed `GET /api/technicians/me/skills`) with IDs, category, specialty and proficiency, plus an update contract if editing is supported. The web no longer prompts for trade details on every home visit; editing is under Profile.

4. **Approved technician agreement**
   - The team has approved the document. The web publishes version `2026-11-03` at `/agreements/technician/2026-11-03`; the old draft URL redirects there.
   - Please configure `TECHNICIAN_TERMS_VERSION=2026-11-03` and `TECHNICIAN_TERMS_DOCUMENT_URL` to that page's full deployed HTTPS URL. Confirm when `TECHNICIAN_TERMS_REQUIRED` should be enabled. Existing acceptance must remain explicit and recorded by the server; team approval is not acceptance on behalf of each technician.

5. **Shop roles and simulated payments**
   - Shop managers now land on `/shop/manage`, with products displayed as a list/table. Customer catalogue/order routes are redirected away from that role in the web.
   - Please also reject shop-manager quote/create-order/development-payment actions server-side so direct API calls cannot bypass web restrictions. Preserve authorized catalogue management.
   - The development checkout now waits at an explicit simulation screen before calling the existing dev-complete endpoint. Please keep dev completion restricted to the current user's pending development-provider order and disabled for real payment-provider orders. No production payment is simulated in the web.

Please reply with the final endpoint shapes, authorization rules and error codes. We can then replace the integration notices with live hiring listings and full reporter request history and run the complete acceptance flows.
