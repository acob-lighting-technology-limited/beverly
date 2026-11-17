/**
 * Who may change Beverly PUE data and act on batteries. Reading needs only the PUE portal.
 * Used by: routes/pue-yunhe.ts (hardware commands) and routes/pue-registry.ts (registry writes).
 */
export const PUE_OPERATOR_ROLES: ReadonlySet<string> = new Set(['super-admin', 'operations-manager', 'operations-officer']);
