export const TERMS_VERSION = "2026-11-19";

export function hasAcceptedCurrentTerms(user) {
  return user.termsAcceptedAt instanceof Date && user.termsVersion === TERMS_VERSION;
}
