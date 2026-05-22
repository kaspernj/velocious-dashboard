// @ts-check

/**
 * Formats a millisecond timestamp as a locale string, or "—" when absent.
 * @param {number | null | undefined} ms - Milliseconds since epoch.
 * @returns {string} - Formatted timestamp.
 */
export function formatTimestamp(ms) {
  if (ms === null || ms === undefined) return "—"

  const date = new Date(ms)

  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleString()
}

/**
 * Formats a millisecond timestamp as a short relative duration from now.
 * @param {number | null | undefined} ms - Milliseconds since epoch.
 * @returns {string} - Relative description like "3m ago" / "in 5s".
 */
export function formatRelative(ms) {
  if (ms === null || ms === undefined) return "—"

  const deltaSeconds = Math.round((ms - Date.now()) / 1000)
  const past = deltaSeconds <= 0
  const seconds = Math.abs(deltaSeconds)

  /** @type {string} */
  let value

  if (seconds < 60) {
    value = `${seconds}s`
  } else if (seconds < 3600) {
    value = `${Math.round(seconds / 60)}m`
  } else if (seconds < 86400) {
    value = `${Math.round(seconds / 3600)}h`
  } else {
    value = `${Math.round(seconds / 86400)}d`
  }

  return past ? `${value} ago` : `in ${value}`
}
