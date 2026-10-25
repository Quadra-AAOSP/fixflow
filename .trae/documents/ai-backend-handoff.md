# AI Features — Backend Handoff (Phases A2–A4)

Phase A1 (Report Assistant) is already implemented and landed. This document
covers everything the backend still needs to do for the remaining three AI
features. All model calls stay server-side — keys are env vars, never in the
APK.

## Shared conventions

- Provider access: reuse `ai/ChatProvider` + `OpenRouterChatProvider` and the
  `ObjectProvider<T>` optional-bean pattern. A missing provider bean returns
  `503`, it must never crash startup.
- Errors: always throw `ApiException(httpStatus, message)` so the mobile's
  `ApiError` handler gets a clean status + message. Never 500 on a bad model
  response — drop invalid fields instead.
- Rate limiting: reuse the helper already in
  `ReportAssistantService` (20 req/min/user), or extract it into a shared
  component.
- Validation: every AI-extracted category must be checked against
  `SiteRuleRepository.existsBySiteTypeAndCategory(...)`; unknown values are
  dropped, not rejected. Reuse the `ReportClassificationService`
  `applyValidatedClassification` / `applyFallback` pattern.

---

## Phase A2 — Triage Bot (pre-filing assistant)

**Endpoint:** `POST /api/assistant/triage`

**Auth:** authenticated reporters + staff/admin, scoped to a site.
`super_admin` must pass `siteId`. 401 anonymous, 403 if the actor has no site
scope.

**Request body:**

```json
{
  "siteId": 12,
  "messages": [
    { "role": "user", "content": "The sink is leaking water" },
    { "role": "assistant", "content": "How bad is the leak?" }
  ]
}
```

- `messages` is the client-side chat history. Only `user`/`assistant` roles
  are accepted (server builds the system message).
- Caps: max 20 turns, max 2000 chars/turn, the last message must be from the
  user (same as A1).
- Stateless — no new DB table.

**Response:**

```json
{
  "reply": "Based on what you said, this looks like a plumbing issue with high urgency.",
  "fallback": false,
  "suggestedFields": {
    "category": "plumbing",
    "urgency": "high",
    "descriptionDraft": "Sink leaking water under the cabinet."
  }
}
```

- `suggestedFields` is `null` when the model is not yet confident — the mobile
  keeps the conversation going.
- Every value in `suggestedFields` is validated against the site's taxonomy
  (`category` via `SiteRuleRepository`, `urgency` against the `Urgency` enum).
  Invalid values are dropped, never cause a 500.

**Behavior:**

1. Resolve the site from `siteId` (or the actor's scoped site).
2. Build a system prompt with: site type, the site's allowed categories, the
   allowed urgencies (`low|medium|high|critical`), and an instruction to ask
   1–2 clarifying questions and only return `suggestedFields` once confident.
3. Ask the chat provider for a reply. The model is instructed to return an
   embedded JSON block for the suggestions.
4. Parse the JSON: if parsing fails, set `suggestedFields: null` and use the
   raw text as `reply`. Never 500.
5. Apply the same 20 req/min/user rate limit as A1.

**Config:** reuse `openrouter.chat.*` — no new keys.

**Tests:**

- Auth: 401 anonymous, 403 actor with no site, 403 wrong-site reporter
- Happy path: returns valid `suggestedFields` matching the site taxonomy
- Unknown category from the model → `category` dropped, `reply` still present,
  response is 200
- Provider failure → `fallback: true`, `suggestedFields: null`
- Caps: 21 messages → 400, `system` role → 400, last-message-not-user → 400

---

## Phase A3 — Smart Search (natural-language → filters)

**Endpoint:** `POST /api/reports/search/nl`

**Auth:** same as `GET /api/reports` — `super_admin` requires `siteId`, all
other actors are scoped to their site. 401/403 as in
`ReportService.resolveSiteForList`.

**Request body:**

```json
{ "siteId": 12, "query": "show me open high-urgency plumbing reports from last week" }
```

**Response:**

```json
{
  "rawQuery": "show me open high-urgency plumbing reports from last week",
  "filters": {
    "status": "open",
    "category": "plumbing",
    "urgency": "high",
    "from": "2026-10-18",
    "to": null,
    "text": null
  },
  "interpretation": "open plumbing reports with high urgency created after 2026-10-18"
}
```

- Every `filters` field is optional/null — only what the model extracted.
- `status` must be a valid `ReportStatus`, `urgency` a valid `Urgency`,
  `category` validated against the site taxonomy. Invalid values → `null`.
- Dates are ISO `yyyy-MM-dd`.

**Behavior:**

1. Resolve the site, then build a system prompt listing the allowed statuses,
   categories, and urgencies; instruct the model to return strict JSON only.
2. Parse the response. On parse failure, return `filters: {}` and
   `interpretation: null` — never 500.
3. No new list endpoint is needed — the mobile applies these filters to its
   existing list plus client-side narrowing.

**Config:** reuse `openrouter.chat.*` (or `openrouter.model`).

**Tests:**

- Auth matrix (same as the reports list)
- Happy path: a query yields valid status/category/urgency
- Unknown category extracted → dropped, response still 200
- Model JSON parse failure → `filters: {}`, no 500
- Empty query → 400

---

## Phase A4 — Voice-to-Report (transcription)

**Endpoint:** `POST /api/assistant/transcribe`

**Auth:** authenticated, same-site. 401/403 as above.

**Request:** `multipart/form-data` with a single field `audio`.
Max size 10 MB, supported formats: `m4a`, `mp3`, `wav`, `webm`.

**Response:**

```json
{ "text": "The kitchen sink is leaking badly." }
```

**Behavior:**

1. If `openrouter.audio.enabled` is false, return **503** with
   `"Transcription is not configured"`.
2. Validate the upload: audio present, within size limit, supported format —
   else 400.
3. Transcribe server-side using an OpenRouter audio-capable model (e.g.
   `openai/whisper-3` against the `/audio/transcriptions` endpoint). The audio
   never reaches the mobile's model key.
4. On provider failure, return 503 `"Transcription failed"`.

**Config (application.yaml):**

```yaml
openrouter:
  audio:
    enabled: ${OPENROUTER_AUDIO_ENABLED:false}
    model: ${OPENROUTER_AUDIO_MODEL:openai/whisper-3}
    base-url: ${OPENROUTER_AUDIO_BASE_URL:https://openrouter.ai/api/v1/audio/transcriptions}
```

**Tests:**

- 503 when `openrouter.audio.enabled=false`
- Happy path: audio in → text out (mock the provider)
- Missing audio → 400
- Oversized audio → 400
- Unsupported format → 400
- Provider failure → 503

---

## Reference (A1, already done)

- `ai/ChatProvider`, `ai/ChatMessage`, `ai/OpenRouterChatProvider`
- `service/ReportAssistantService` — auth audience, caps, rate limit, fallback
- `web/ReportAssistantController` — `POST /api/reports/{id}/assistant`
- `ReportAssistantIntegrationTest` — auth matrix, caps, fallback, rate limit
