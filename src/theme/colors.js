// @ts-check

/** Shared color palette for the dashboard. */
const colors = {
  background: "#0f172a",
  surface: "#1e293b",
  surfaceMuted: "#334155",
  border: "#334155",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  primary: "#38bdf8",
  danger: "#f87171",
  white: "#ffffff"
}

/**
 * Color used to represent each job status in badges and overview cards.
 * @type {Record<string, string>}
 */
export const statusColors = {
  queued: "#38bdf8",
  handed_off: "#a78bfa",
  completed: "#34d399",
  failed: "#f87171",
  orphaned: "#fbbf24"
}

/**
 * @param {string} status - Job status.
 * @returns {string} - Color for the status, falling back to muted text.
 */
export function colorForStatus(status) {
  return statusColors[status] || colors.textMuted
}

export default colors
