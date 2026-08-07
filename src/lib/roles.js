// Normalizes role comparisons so a whitespace/casing slip in profiles.role
// (e.g. 'Admin' or ' admin ' from a hand-run SQL update) doesn't silently
// lock an actual admin out of admin-only routes and nav links.
export function isAdminRole(role) {
  return role?.trim().toLowerCase() === 'admin';
}
