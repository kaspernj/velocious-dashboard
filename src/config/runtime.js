// @ts-check

/**
 * @typedef {import("../connections/connections-store.js").Connection} Connection
 */

/**
 * When the dashboard's web bundle is served by a Velocious backend (the planned
 * `serveUi` mount option), that page injects `window.VELOCIOUS_DASHBOARD_CONFIG`
 * so the app runs in "embedded" mode against a single same-origin backend
 * instead of showing the multi-connection manager.
 *
 * @returns {Connection | null} - The embedded connection, or null in standalone mode.
 */
export function embeddedConnection() {
  if (typeof window === "undefined" || !window.location) return null

  const injected = /** @type {{apiBase?: string, mountPath?: string, token?: string} | undefined} */ (
    /** @type {any} */ (window).VELOCIOUS_DASHBOARD_CONFIG
  )

  if (!injected) return null

  const origin = window.location.origin

  return {
    baseUrl: origin,
    id: "embedded",
    mountPath: injected.mountPath || injected.apiBase || "/velocious/jobs",
    name: "This app",
    token: injected.token || ""
  }
}

/** @returns {boolean} - Whether the app is running embedded in a backend page. */
export function isEmbedded() {
  return embeddedConnection() !== null
}
