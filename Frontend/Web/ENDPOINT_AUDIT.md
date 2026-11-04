# Web endpoint integration audit

Reviewed 4 November 2026 against every mapping in Backend/src/main/java/com/example/fixflow/web/*Controller.java and the web service/view sources. This is source wiring evidence, not proof of live acceptance for every endpoint. Backend files were not modified.

## Current role policy

Reporter: own/participating report home, site report browse/detail/create, site/building information, own application when present, profile and shop. Staff: operational dashboard, reports, assignments and site information. Site/super admins add team access and contracts. Technician: own workspace, invitations, contracts and authorized report details; no report creation or management dashboard. Shop manager: product administration home and profile; customer shop/order routes redirect to management. Route guards accompany menu filtering; the server still authorizes each request.

## Controller mapping inventory

| Controller | Method and path | Integration |
| --- | --- | --- |
| AdminShopProductController | `GET /api/admin/shop/products` | Connected: /shop/manage list/detail/create/update/deactivate screen for shop_manager and super_admin; browser CRUD checked with a disposable product. |
| AdminShopProductController | `GET /api/admin/shop/products/{id}` | Connected: /shop/manage list/detail/create/update/deactivate screen for shop_manager and super_admin; browser CRUD checked with a disposable product. |
| AdminShopProductController | `POST /api/admin/shop/products` | Connected: /shop/manage list/detail/create/update/deactivate screen for shop_manager and super_admin; browser CRUD checked with a disposable product. |
| AdminShopProductController | `PUT /api/admin/shop/products/{id}` | Connected: /shop/manage list/detail/create/update/deactivate screen for shop_manager and super_admin; browser CRUD checked with a disposable product. |
| AdminShopProductController | `DELETE /api/admin/shop/products/{id}` | Connected: /shop/manage list/detail/create/update/deactivate screen for shop_manager and super_admin; browser CRUD checked with a disposable product. |
| AdminUserController | `POST /api/admin/users` | Connected: Team access (site admin/super admin). |
| AuthController | `GET /api/auth/csrf` | Connected: api/auth/accountPolicy services; login, registration and session flows. |
| AuthController | `POST /api/auth/register` | Connected: api/auth/accountPolicy services; login, registration and session flows. |
| AuthController | `GET /api/auth/policy` | Connected: api/auth/accountPolicy services; login, registration and session flows. |
| AuthController | `POST /api/auth/login` | Connected: api/auth/accountPolicy services; login, registration and session flows. |
| AuthController | `POST /api/auth/logout` | Connected: api/auth/accountPolicy services; login, registration and session flows. |
| AuthController | `GET /api/auth/me` | Connected: api/auth/accountPolicy services; login, registration and session flows. |
| ContractApplicationController | `POST /api/technician-contract-requests` | Connected: Contracts request tracking and site-admin decisions. |
| ContractApplicationController | `GET /api/technician-contract-requests` | Connected: Contracts request tracking and site-admin decisions. |
| ContractApplicationController | `POST /api/technician-contract-requests/{id}/decision` | Connected: Contracts request tracking and site-admin decisions. |
| ReportAssistantController | `POST /api/reports/{reportId}/assistant` | Connected: role-scoped ReportAssistantPanel with opt-in, stateless history, fallback/error handling and access-change cleanup. Live provider answers remain unverified. |
| ReportController | `POST /api/reports` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `POST /api/reports` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `GET /api/reports` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `GET /api/reports/{id}` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `POST /api/reports/{id}/classify` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `POST /api/reports/{id}/join` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `GET /api/reports/{id}/reporters` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `POST /api/reports/{id}/assign` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `POST /api/reports/{id}/confirm` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportController | `POST /api/reports/{id}/reopen` | Connected: report intake, browse/detail, classification, join, assignment and repair review. |
| ReportPhotoController | `GET /api/reports/{id}/photos` | Connected: ReportPhotosPanel; live storage acceptance remains open. |
| ReportPhotoController | `POST /api/reports/{id}/photos` | Connected: ReportPhotosPanel; live storage acceptance remains open. |
| ReportPhotoController | `DELETE /api/reports/{id}/photos/{photoId}` | Connected: ReportPhotosPanel; live storage acceptance remains open. |
| ReportPhotoController | `GET /api/reports/{id}/photos/{photoId}` | Connected: ReportPhotosPanel; live storage acceptance remains open. |
| ReportVisionController | `POST /api/reports/{reportId}/vision` | Connected: ReportVisionPanel consent/upload/status; live provider acceptance remains open. |
| ReportVisionController | `GET /api/reports/{reportId}/vision/{jobId}` | Connected: ReportVisionPanel consent/upload/status; live provider acceptance remains open. |
| ShopCatalogController | `GET /api/shop/catalog` | Connected: Shop defaults to /api/shop/catalog; VITE_SHOP_CATALOG_PATH is an optional API-path override. |
| ShopOrderController | `POST /api/shop/checkout/quote` | Connected: Shop quote/create/history plus /shop/orders/:orderId detail, refresh and confirmed pending-order cancellation. Return links perform reads, not automatic development payment completion. |
| ShopOrderController | `POST /api/shop/orders` | Connected: Shop quote/create/history plus /shop/orders/:orderId detail, refresh and confirmed pending-order cancellation. Return links perform reads, not automatic development payment completion. |
| ShopOrderController | `GET /api/shop/orders` | Connected: Shop quote/create/history plus /shop/orders/:orderId detail, refresh and confirmed pending-order cancellation. Return links perform reads, not automatic development payment completion. |
| ShopOrderController | `GET /api/shop/orders/{publicId}` | Connected: Shop quote/create/history plus /shop/orders/:orderId detail, refresh and confirmed pending-order cancellation. Return links perform reads, not automatic development payment completion. |
| ShopOrderController | `POST /api/shop/orders/{publicId}/cancel` | Connected: Shop quote/create/history plus /shop/orders/:orderId detail, refresh and confirmed pending-order cancellation. Return links perform reads, not automatic development payment completion. |
| ShopPaymentWebhookController | `POST /api/shop/payments/webhook` | Webhook is provider-to-server, never a browser action. Dev completion is development-only checkout. |
| ShopPaymentWebhookController | `POST /api/shop/payments/dev/complete/{publicId}` | Webhook is provider-to-server, never a browser action. Dev completion is development-only checkout. |
| SiteAdminApplicationController | `GET /api/auth/site-admin-application` | Connected: applicant status and super-admin Team access decisions. |
| SiteAdminApplicationController | `GET /api/admin/site-admin-applications` | Connected: applicant status and super-admin Team access decisions. |
| SiteAdminApplicationController | `POST /api/admin/site-admin-applications/{id}/approve` | Connected: applicant status and super-admin Team access decisions. |
| SiteAdminApplicationController | `POST /api/admin/site-admin-applications/{id}/reject` | Connected: applicant status and super-admin Team access decisions. |
| SiteController | `GET /api/sites` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteController | `GET /api/sites/{id}` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteController | `GET /api/sites/{id}/taxonomy` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteController | `GET /api/sites/{id}/technician-pool` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteController | `POST /api/sites` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteController | `PUT /api/sites/{id}` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteController | `DELETE /api/sites/{id}` | List/create/update connected in Sites. /sites/:siteId connects detail, taxonomy and authorized technician-pool reads plus super-admin permanent deletion review. |
| SiteRuleController | `GET /api/site-rules` | GET connected for taxonomy and rule listing. POST/PUT/DELETE connected in /site-rules for admin/super_admin with explicit type-wide scope and delete confirmation. |
| SiteRuleController | `POST /api/site-rules` | GET connected for taxonomy and rule listing. POST/PUT/DELETE connected in /site-rules for admin/super_admin with explicit type-wide scope and delete confirmation. |
| SiteRuleController | `PUT /api/site-rules/{id}` | GET connected for taxonomy and rule listing. POST/PUT/DELETE connected in /site-rules for admin/super_admin with explicit type-wide scope and delete confirmation. |
| SiteRuleController | `DELETE /api/site-rules/{id}` | GET connected for taxonomy and rule listing. POST/PUT/DELETE connected in /site-rules for admin/super_admin with explicit type-wide scope and delete confirmation. |
| SubsiteController | `GET /api/sites/{siteId}/reporting-setup` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `GET /api/sites/{siteId}/subsites` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsites` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsite-requests` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `PUT /api/sites/{siteId}/subsites/{id}` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsites/{id}/archive` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `GET /api/sites/{siteId}/subsite-requests` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsite-requests/{id}/resolve` | Subsite CRUD/archive and suggestion/list/resolve connected. Dedicated reporting-setup read is connected in Site details; auth onboarding metadata also drives initial guidance. |
| TechnicianAvailabilityController | `GET /api/technicians/me/availability` | Connected: technician workspace availability. |
| TechnicianAvailabilityController | `PUT /api/technicians/me/availability` | Connected: technician workspace availability. |
| TechnicianContractController | `GET /api/technician-contracts` | GET/POST/DELETE connected in Contracts. Removal is explicitly a permanent database relationship removal, not legal termination or an audited lifecycle. |
| TechnicianContractController | `POST /api/technician-contracts` | GET/POST/DELETE connected in Contracts. Removal is explicitly a permanent database relationship removal, not legal termination or an audited lifecycle. |
| TechnicianContractController | `DELETE /api/technician-contracts/{id}` | GET/POST/DELETE connected in Contracts. Removal is explicitly a permanent database relationship removal, not legal termination or an audited lifecycle. |
| TechnicianController | `GET /api/technicians` | Connected: assignment directory. |
| TechnicianInvitationController | `POST /api/reports/{id}/technician-invitations` | Connected: technician inbox and administrative invitation panel. |
| TechnicianInvitationController | `GET /api/technician-invitations` | Connected: technician inbox and administrative invitation panel. |
| TechnicianRankingController | `POST /api/reports/{id}/technician-ranking` | Connected: eligible candidates and ranking panel. |
| TechnicianSkillController | `POST /api/technician-skills` | Connected: technician skill profile. |
| TechnicianTermsController | `GET /api/technician-terms/me` | Own terms/acceptance and administrative technician-specific terms read are connected; administrators do not accept terms on behalf of technicians. |
| TechnicianTermsController | `GET /api/technician-terms/{technicianId}` | Own terms/acceptance and administrative technician-specific terms read are connected; administrators do not accept terms on behalf of technicians. |
| TechnicianTermsController | `POST /api/technician-terms/accept` | Own terms/acceptance and administrative technician-specific terms read are connected; administrators do not accept terms on behalf of technicians. |

| ReportWorkflowController | `POST /api/reports/{id}/claim` | ClaimReportPanel in technician workspace; exact report ID, server contract/terms checks. |
| ReportWorkflowController | `POST /api/reports/{id}/start` | ReportWorkflowPanel; assigned technician and allowed status. |
| ReportWorkflowController | `POST /api/reports/{id}/resolve` | ReportWorkflowPanel; in-progress assigned technician, description up to 10,000 characters. |
| ReportWorkflowController | `POST /api/reports/{id}/escalate` | ReportWorkflowPanel; assigned technician or site operator, reason up to 2,000 characters. |
| ReportWorkflowController | `PATCH /api/reports/{id}/urgency` | ReportWorkflowPanel; operator only, final urgency and reason. |
| ReportWorkflowController | `GET /api/reports/{id}/history` | ReportWorkflowPanel; server-masked note/identity retained as returned. |
| ReportWorkflowController | `GET /api/reports/{id}/resolutions` | ReportWorkflowPanel; saved repair descriptions and IDs. |
| ReportWorkflowController | `POST /api/reports/{id}/ratings` | ReportWorkflowPanel; confirmed repair, participant/operator, returned resolution ID. |
| ReportWorkflowController | `GET /api/reports/{id}/ratings` | ReportWorkflowPanel; saved score and feedback. |
| ReportWorkflowController | `POST /api/reports/{id}/links` | ReportWorkflowPanel; operator only, target ID and reason, server authorization. |
| ReportWorkflowController | `GET /api/reports/{id}/links` | ReportWorkflowPanel; server-filtered related report links. |

## Remaining integration work

- Product administration is connected; wider role and production acceptance remain separate.
- Site detail/setup/taxonomy/pool reads are connected; verify wider live role acceptance and production behavior.
- Site, rule and contract removal controls are connected with explicit permanent-delete confirmation and role/scope guards. Destructive live acceptance remains unexecuted.
- Verify role flows and mutations in the live browser against disposable fixtures. Unit coverage alone is insufficient.
- Dedicated assigned-to-me/claimable queues, triage and admin-review APIs remain absent. Claim/start/resolve/escalation/urgency/history/resolutions/ratings/links were published in 0fabdd5 and are now connected below. Technician report GET still requires the technician to be assigned, so claim is exposed by ID rather than a fabricated browsing queue.

## 3 November follow-up: agreement and photo deployment

Rechecked the current backend controller mapping inventory against this table. No new controller family was found. Browser-relevant mappings retain the destinations above; provider webhooks are intentionally not browser buttons. Missing lifecycle mappings listed above remain backend gaps, not client-side successes.

The public `/agreements/technician/draft-2026-11-03` route contains the authored English/Chinese participation agreement for review. Technician terms links to it separately from the API-configured active document. Opening the draft performs no acceptance request. Publishing requires owner review of the named unresolved commercial/legal details, then configuration of the backend version and document URL; do not activate a URL labelled draft. Existing GET status/history and POST acceptance still use only the server's active version.

See `PHOTO_STORAGE.md` for native MinIO and Docker MinIO configuration, exact web endpoints and the outstanding live persistence checks. Backend source and storage configuration have not been changed by this web batch.
