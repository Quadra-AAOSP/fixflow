# Web endpoint integration audit

Reviewed 2 November 2026 against every mapping in Backend/src/main/java/com/example/fixflow/web/*Controller.java and the web service/view sources. This is source wiring evidence, not proof of live acceptance for every endpoint. Backend files were not modified.

## Current role policy

Reporter: own/participating report home, site report browse/detail/create, site/building information, own application when present, profile and shop. Staff: operational dashboard, reports, assignments and site information. Site/super admins add team access and contracts. Technician: own workspace, invitations, contracts and authorized report details; no report creation or management dashboard. Shop manager: shop and profile; product administration is a remaining integration gap. Route guards accompany menu filtering; the server still authorizes each request.

## Controller mapping inventory

| Controller | Method and path | Integration |
| --- | --- | --- |
| AdminShopProductController | `GET /api/admin/shop/products` | Not connected: role-restricted catalogue administration still needs its screen. |
| AdminShopProductController | `GET /api/admin/shop/products/{id}` | Not connected: role-restricted catalogue administration still needs its screen. |
| AdminShopProductController | `POST /api/admin/shop/products` | Not connected: role-restricted catalogue administration still needs its screen. |
| AdminShopProductController | `PUT /api/admin/shop/products/{id}` | Not connected: role-restricted catalogue administration still needs its screen. |
| AdminShopProductController | `DELETE /api/admin/shop/products/{id}` | Not connected: role-restricted catalogue administration still needs its screen. |
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
| ReportAssistantController | `POST /api/reports/{reportId}/assistant` | Not connected: report assistant chat still needs its screen. |
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
| ShopCatalogController | `GET /api/shop/catalog` | Connected: Shop via configured VITE_SHOP_CATALOG_PATH; configuration must be /api/shop/catalog. |
| ShopOrderController | `POST /api/shop/checkout/quote` | Connected: Shop quote/order/history/cancel; single-order service exists, history drives current UI. |
| ShopOrderController | `POST /api/shop/orders` | Connected: Shop quote/order/history/cancel; single-order service exists, history drives current UI. |
| ShopOrderController | `GET /api/shop/orders` | Connected: Shop quote/order/history/cancel; single-order service exists, history drives current UI. |
| ShopOrderController | `GET /api/shop/orders/{publicId}` | Connected: Shop quote/order/history/cancel; single-order service exists, history drives current UI. |
| ShopOrderController | `POST /api/shop/orders/{publicId}/cancel` | Connected: Shop quote/order/history/cancel; single-order service exists, history drives current UI. |
| ShopPaymentWebhookController | `POST /api/shop/payments/webhook` | Webhook is provider-to-server, never a browser action. Dev completion is development-only checkout. |
| ShopPaymentWebhookController | `POST /api/shop/payments/dev/complete/{publicId}` | Webhook is provider-to-server, never a browser action. Dev completion is development-only checkout. |
| SiteAdminApplicationController | `GET /api/auth/site-admin-application` | Connected: applicant status and super-admin Team access decisions. |
| SiteAdminApplicationController | `GET /api/admin/site-admin-applications` | Connected: applicant status and super-admin Team access decisions. |
| SiteAdminApplicationController | `POST /api/admin/site-admin-applications/{id}/approve` | Connected: applicant status and super-admin Team access decisions. |
| SiteAdminApplicationController | `POST /api/admin/site-admin-applications/{id}/reject` | Connected: applicant status and super-admin Team access decisions. |
| SiteController | `GET /api/sites` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteController | `GET /api/sites/{id}` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteController | `GET /api/sites/{id}/taxonomy` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteController | `GET /api/sites/{id}/technician-pool` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteController | `POST /api/sites` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteController | `PUT /api/sites/{id}` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteController | `DELETE /api/sites/{id}` | List/create/update connected in Sites. Detail and taxonomy have list/type-rule alternatives; technician-pool and DELETE not connected. |
| SiteRuleController | `GET /api/site-rules` | GET connected for taxonomy by site type. POST/PUT/DELETE administration is not connected. |
| SiteRuleController | `POST /api/site-rules` | GET connected for taxonomy by site type. POST/PUT/DELETE administration is not connected. |
| SiteRuleController | `PUT /api/site-rules/{id}` | GET connected for taxonomy by site type. POST/PUT/DELETE administration is not connected. |
| SiteRuleController | `DELETE /api/site-rules/{id}` | GET connected for taxonomy by site type. POST/PUT/DELETE administration is not connected. |
| SubsiteController | `GET /api/sites/{siteId}/reporting-setup` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `GET /api/sites/{siteId}/subsites` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsites` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsite-requests` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `PUT /api/sites/{siteId}/subsites/{id}` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsites/{id}/archive` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `GET /api/sites/{siteId}/subsite-requests` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| SubsiteController | `POST /api/sites/{siteId}/subsite-requests/{id}/resolve` | Subsite CRUD/archive and suggestion/list/resolve connected. reporting-setup read is not connected; auth onboarding metadata currently drives guidance. |
| TechnicianAvailabilityController | `GET /api/technicians/me/availability` | Connected: technician workspace availability. |
| TechnicianAvailabilityController | `PUT /api/technicians/me/availability` | Connected: technician workspace availability. |
| TechnicianContractController | `GET /api/technician-contracts` | GET/POST connected in Contracts. DELETE termination is not connected. |
| TechnicianContractController | `POST /api/technician-contracts` | GET/POST connected in Contracts. DELETE termination is not connected. |
| TechnicianContractController | `DELETE /api/technician-contracts/{id}` | GET/POST connected in Contracts. DELETE termination is not connected. |
| TechnicianController | `GET /api/technicians` | Connected: assignment directory. |
| TechnicianInvitationController | `POST /api/reports/{id}/technician-invitations` | Connected: technician inbox and administrative invitation panel. |
| TechnicianInvitationController | `GET /api/technician-invitations` | Connected: technician inbox and administrative invitation panel. |
| TechnicianRankingController | `POST /api/reports/{id}/technician-ranking` | Connected: eligible candidates and ranking panel. |
| TechnicianSkillController | `POST /api/technician-skills` | Connected: technician skill profile. |
| TechnicianTermsController | `GET /api/technician-terms/me` | Own terms and acceptance connected. Administrative technician-specific read is not connected. |
| TechnicianTermsController | `GET /api/technician-terms/{technicianId}` | Own terms and acceptance connected. Administrative technician-specific read is not connected. |
| TechnicianTermsController | `POST /api/technician-terms/accept` | Own terms and acceptance connected. Administrative technician-specific read is not connected. |

## Remaining integration work

- Implement super-admin/shop-manager product administration and authorized report assistant UI.
- Connect dedicated site reporting-setup/taxonomy/pool reads where they replace broad reads; retain schema/permission checks.
- Add intentional, reviewed site/rule/contract deletion workflows rather than exposing destructive buttons on every role’s screen.
- Verify role flows and mutations in the live browser against disposable fixtures. Unit coverage alone is insufficient.
- No lifecycle endpoints exist for assigned-to-me/claim/start/resolve/history/triage/escalation/urgency override/rating/linked reports/admin review; do not invent successful client states.
