/**
 * Sub-site types. A subsite is a labelled building/block inside a site
 * (e.g. "Block A", "Cafeteria") used to pin reports to a precise location.
 */

/** Mirrors backend `SubsiteResponse`. */
export type Subsite = {
  id: number;
  siteId: number;
  label: string;
  name: string;
  description: string | null;
};

/** Mirrors backend `SubsiteRequest`. */
export type SubsitePayload = {
  label: string;
  name: string;
  description?: string;
};

/**
 * Mirrors backend `SubsiteAlertResponse` — a member flagging that a subsite
 * is missing/wrong, which an admin later resolves.
 */
export type SubsiteAlert = {
  id: number;
  siteId: number;
  requestedByUserId: number | null;
  note: string | null;
  /** Backend serialises this as a plain String, not an enum. */
  status: string;
  createdAt: string;
};
