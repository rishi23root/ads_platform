/**
 * Validation limits for admin POST /api/end-users (mirrors `createSchema` in that route).
 * Keeps client-side checks aligned with server Zod without importing server-only modules in the dialog.
 */
export const END_USER_IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]+$/;

export const END_USER_COUNTRY_REGEX = /^[a-zA-Z]{2}$/;

export const endUserAdminCreateLimits = {
  emailMax: 255,
  nameMax: 255,
  identifierMin: 8,
  identifierMax: 255,
  passwordMin: 8,
  passwordMax: 128,
  countryLength: 2,
} as const;
