import {
  assignTechnician,
  confirmReport,
  listReports,
  reopenReport,
} from './reports';
import { listTechnicians } from './technicians';

export {
  assignTechnician as assignTechnicianToReport,
  confirmReport,
  listReports,
  listTechnicians,
  reopenReport,
};

/**
 * Staff role access helpers. Re-exported from `constants/access` so existing
 * imports from `@/services/staff` keep working. The canonical definitions
 * live in `constants/access.ts`.
 */
export {
  canAssignTechnician,
  canConfirmReport,
  canReopenReport,
} from '@/constants/access';
