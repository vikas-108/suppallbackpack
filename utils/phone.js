import { ApiError } from "./apiError.js";

export const supportedCountryCodes = ["+91", "+1", "+44", "+61", "+65", "+971"];

export function normalizePhone(countryCode, rawPhone) {
  if (!supportedCountryCodes.includes(countryCode)) {
    throw new ApiError(400, "Choose a supported country code.", "INVALID_COUNTRY_CODE");
  }
  const value = String(rawPhone || "").trim();
  if (!/^[\d\s()+-]+$/.test(value)) {
    throw new ApiError(400, "Enter a phone number using digits and standard separators only.", "INVALID_PHONE");
  }
  const digits = value.replace(/\D/g, "");
  const valid = countryCode === "+91"
    ? /^[6-9]\d{9}$/.test(digits)
    : /^\d{7,15}$/.test(digits);
  if (!valid) {
    const message = countryCode === "+91"
      ? "Enter a valid 10-digit Indian mobile number starting with 6–9."
      : "Enter a valid phone number with 7–15 digits.";
    throw new ApiError(400, message, "INVALID_PHONE");
  }
  return digits;
}

export function parseInternationalPhone(rawPhone, fallbackCountryCode = "+91") {
  const value = String(rawPhone || "").trim();
  if (value.startsWith("+")) {
    const countryCode = [...supportedCountryCodes]
      .sort((left, right) => right.length - left.length)
      .find(code => value.startsWith(code));
    if (!countryCode) throw new ApiError(400, "This country code is not supported.", "INVALID_COUNTRY_CODE");
    return { countryCode, phone: normalizePhone(countryCode, value.slice(countryCode.length)) };
  }
  return { countryCode: fallbackCountryCode, phone: normalizePhone(fallbackCountryCode, value) };
}

export function formatInternationalPhone(countryCode, phone) {
  return `${countryCode} ${phone}`;
}
