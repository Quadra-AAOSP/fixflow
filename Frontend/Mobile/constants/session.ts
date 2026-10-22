/** Backend session idle timeout. Keep the client heartbeat well under this. */
export const BACKEND_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Background session heartbeat interval. Must stay below BACKEND_IDLE_TIMEOUT_MS. */
export const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;
