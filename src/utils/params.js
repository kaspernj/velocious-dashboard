// @ts-check

/**
 * Extracts a single string from a route/query param that may be a string,
 * an array of strings, or undefined.
 * @param {unknown} value - Raw param value.
 * @returns {string | undefined} - First non-empty string value, or undefined.
 */
export function stringParam(value) {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" && value[0].length > 0 ? value[0] : undefined
  }

  if (typeof value === "string" && value.length > 0) {
    return value
  }

  return undefined
}
