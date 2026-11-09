/**
 * Connectivity is owned by `ConnectivityProvider` (mounted in the root layout)
 * so the offline banner, screens and the report queue share one state.
 * This module keeps the original hook import path working.
 */
export { useConnectivity } from '@/stores/connectivity';
