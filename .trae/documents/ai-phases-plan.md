# AI Features — Phased Plan (FixFlow)

All four AI features, phased by dependency. Mobile-heavy per user's role; backend created only where the feature physically requires it (AI keys must never ship in the APK — all model calls stay server-side behind new endpoints).

## Existing infrastructure to reuse (verified)

- `ai/AIProvider` interface + `ai/OpenRouterProvider` (blocking HTTP to OpenRouter, key in env) — `Backend/src/main/java/com/example/fixflow/ai/`
- `ai/VisionProvider` + `OpenRouterVisionProvider` — image classification precedent
- `ReportClassificationService` — taxonomy validation + fallback pattern (`applyValidatedClassification` / `applyFallback`)
- `ReportVisionController` — async job pattern on `/api/reports/{reportId}/vision`
- `ReportVisibility` access rules in `ReportService` (`assertCanSeeVisibility`, `canSeeSensitive`) — reuse for chat authorization
- Mobile: design tokens, i18n catalogs (single-brace `{var}`, en/zh parity enforced by tests), `ModalSheet`, catalog test suite

## Phase A1 — Report Assistant (contextual chat on report detail)

First: the analysis badge placeholder on `reports/[id].tsx` finally gets real content behind it.

- Backend:
  - `ai/ChatProvider` interface: `chat(messages, systemContext) -> reply` + OpenRouter chat implementation (reuses existing key/base-url config; non-streaming v1, blocking call)
  - `POST /api/reports/{reportId}/assistant` — body: client-sent message history (stateless, no new DB table); server builds system prompt with report context (description, category/urgency AI+final, status, status history tail, AI analysis) and enforces `canSeeSensitive` audience
  - Response caps: max ~20 messages/request, max tokens out, simple per-user rate limit
  - Integration tests: auth matrix (401/403/private-report-404), happy path, provider-failure fallback message
- Mobile:
  - `services/assistant.ts` + `lib/endpoints.ts` entry
  - `components/chat/` — message list, bubbles, typing indicator, error state (reuses design tokens)
  - `reports/[id].tsx` — replaces the "Analysis not yet available" placeholder with an "Ask about this report" chat section
  - i18n keys (en/zh), commit split: backend → tests → mobile service → mobile UI → i18n/docs

## Phase A2 — Triage bot (pre-filing assistant)

- Backend: `POST /api/assistant/triage` — same chat protocol, but system prompt asks clarifying questions and, once confident, returns `suggestedFields: {category, urgency, descriptionDraft}` validated against the site's taxonomy (reuse `SiteRuleRepository` checks)
- Mobile: entry on `reports/new.tsx` ("Describe with assistant"), chat modal, "Use these details" applies `suggestedFields` to the form (respecting reporter-entered values — never overwrite silently)

## Phase A3 — Smart search (natural-language report search)

- Backend: `POST /api/reports/search/nl` — `{query}` → parsed structured filters `{status?, category?, urgency?, from?, to?, text?}`; every parsed value validated against taxonomy (unknown → dropped, never 500)
- Mobile: "Ask" mode toggle in the reports list search field; interpreted filters render as removable chips and apply to the existing client filter path (no new list endpoint needed — filters ride the existing list + client-side narrowing)

## Phase A4 — Voice-to-report

- Backend: `POST /api/assistant/transcribe` — audio upload → text via an OpenRouter audio-capable model (config-gated; 503 with clear error if unset)
- Mobile: mic button in the triage chat and the report description field (`expo-av` recording, permission handling, size cap); transcribed text flows into A2's triage flow
- Risk called out up front: accent/local-language accuracy — treat as best-effort draft input, user always reviews before submit

## Sequencing & commits

Order: A1 → A2 → A3 → A4 (A4 depends on A2's flow; A3 is independent but cheapest last).
Each phase ≈ 4–6 real commits (backend provider/service, controller+tests, mobile service/types, mobile UI, i18n, docs). No filler commits.

## Verification per phase

- Backend: full `mvnw test` green (140 existing + new)
- Mobile: `npx tsc --noEmit` clean, `npm test` green, new i18n keys parity-checked by existing catalog tests
- On-device: chat rendering + provider latency need a running backend with `OPENROUTER_API_KEY` set
