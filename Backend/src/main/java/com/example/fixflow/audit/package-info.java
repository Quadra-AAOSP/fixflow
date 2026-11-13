/**
 * Append-only audit trails for FixFlow decisions and lifecycle changes.
 *
 * <p>These records are written when something important happens and are not
 * updated afterward. Current state lives on the domain entity; history lives
 * here so reviewers can answer "who did what, when, and what did it look like?"
 *
 * <ul>
 *   <li>{@link StatusHistory} — report status / urgency notes over time</li>
 *   <li>{@link TechnicianVerificationAudit} — platform verification submissions and reviews</li>
 *   <li>{@link SiteApplicationAudit} — site onboarding submissions and admin decisions</li>
 *   <li>{@link MarketplaceAudit} — marketplace listing and application actions</li>
 *   <li>{@link TechnicianRankingAudit} — technician ranking / AI ranking requests</li>
 * </ul>
 */
package com.example.fixflow.audit;
