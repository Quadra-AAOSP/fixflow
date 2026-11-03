# Web form contract review

Reviewed against the current Java request DTOs and web builders on 2 November 2026.
Limits here describe submitted payloads; they do not replace server validation,
role/site authorization, uniqueness, stock checks or policy metadata.

| Form | Published constraints | Web boundary |
| --- | --- | --- |
| Login | Email 255, password 100 | Native field limits; API owns authentication |
| Registration/provisioning | Names 128, email 255, password 100, phone 64, address 512 | registration builder; minimum comes from /api/auth/policy |
| Report intake | Description 10000, address 512, category/specialty 128, reason 2000, urgency enum | reportIntakePayload for JSON and multipart; optional blanks omitted |
| Report reopen | Required reason 500 | reopenReport validation and input limit |
| Site create/edit | Name 255, address 512, image URL 1024; description has no DTO cap | sitePayload; optional blanks become null; UI supports HTTP/HTTPS images |
| Subsite create/edit | Label 64, name 255, description 2000 | maintenance service validation and native fields |
| Missing-building suggestion | Optional note 1000 | UI requests a useful nonblank description, service trims/bounds it |
| Contract request/decision | Optional note/reason 1000, positive site/request ID | optionalContractText and positive identifiers |
| Direct contract | Required technician/site IDs; permissions and terms checked by server | positive IDs and explicit agreement control |
| Technician skills | Category/specialty 128, proficiency 1–5 | technician service; optional specialty becomes null |
| Invitations | Required reason up to 1000 | technician service and native textarea |
| Product create/edit | ID 64, name 255, category/brand 128, HTTPS image 1024, nonnegative Java integers | productPayload and native limits; server controls currency |
| Site rules | Category 128, site type enum, Java integer weight/order | siteRules service and native number limits |
| Shop quote/checkout | Nonempty items, positive Java integer quantities; name 255, phone 64, address 512 | cartPayload and shippingPayload; backend prices and reserves stock |
| Assistant | At most 20 turns, each nonblank and at most 2000 characters | reportAssistant service; bounded in-memory history |
| Terms acceptance | Server version string | User reviews returned version; no locally invented version |

Backend-only policy remains authoritative. The client deliberately does not impose
a description cap where SiteRequest or product DTOs publish none. DTO validation
cannot establish field privacy or workflow acceptance; see VERIFICATION.md for
live observations and remaining gates. Numeric bounds mirror Java Integer, not
an invented price, stock or urgency policy. Unknown API errors remain visible.
