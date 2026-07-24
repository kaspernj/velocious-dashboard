// @ts-check

import LiveJobCounts from "./live-job-counts.mjs"
import SnapReqWebSocketClient from "snapreq/websocket"

const COUNTS_CHANNEL = "velocious-background-job-counts"
const LEGACY_POLL_INTERVAL_MS = 4000

/**
 * @typedef {{close: () => void, ready: Promise<void>}} CountsSubscription
 * @typedef {{connect: () => Promise<void>, disconnectAndStopReconnect: () => Promise<void>, subscribeChannel: (channelType: string, options: {onMessage: (message: any) => void, onResume: () => void, params: Record<string, string>}) => CountsSubscription}} CountsWebsocketClient
 * @typedef {new (args: {url: string}) => CountsWebsocketClient} CountsWebsocketClientClass
 */

/** @param {string} baseUrl @returns {string} */
function websocketUrl(baseUrl) {
  const url = new URL("/websocket", baseUrl)

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"

  return url.toString().replace(/\/$/, "")
}

/** @param {string | undefined} mountPath @returns {string} */
function normalizeMountPath(mountPath) {
  const normalized = String(mountPath || "/velocious/jobs")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")

  return normalized ? `/${normalized}` : "/"
}

/**
 * Couples the revision state owner to the framework's reconnecting channel
 * client. A screen owns one session and disposes it on mount changes/unmount.
 */
export default class JobCountsSession {
  /**
   * @param {object} args - Session dependencies.
   * @param {{baseUrl: string, mountPath?: string, token?: string}} args.connection - Dashboard connection.
   * @param {() => Promise<any>} args.loadSnapshot - Authoritative stats loader.
   * @param {(state: {counts: Record<string, number>, revision: number, total: number}) => void} args.onChange - State callback.
   * @param {(error: Error) => void} [args.onError] - Recovery error callback.
   * @param {CountsWebsocketClientClass} [args.WebsocketClient] - Test override.
   */
  constructor({connection, loadSnapshot, onChange, onError, WebsocketClient = SnapReqWebSocketClient}) {
    this.connection = connection
    this.loadSnapshot = loadSnapshot
    this.liveCounts = new LiveJobCounts({loadSnapshot: this._loadSnapshot, onChange, onError})
    this.websocketClient = new WebsocketClient({url: websocketUrl(connection.baseUrl)})
  }

  /** @type {CountsSubscription | null} */
  subscription = null
  disposed = false
  legacyRevision = 0
  legacyStats = false
  /** @type {ReturnType<typeof setInterval> | null} */
  pollTimer = null

  /** @returns {Promise<void>} - Subscribes first, then installs the snapshot baseline. */
  async start() {
    if (this.disposed) return

    this.subscription = this.websocketClient.subscribeChannel(COUNTS_CHANNEL, {
      onMessage: (message) => this.liveCounts.receive(message),
      onResume: () => this.liveCounts.reconnect(),
      params: {
        authenticationToken: this.connection.token || "",
        mountAt: normalizeMountPath(this.connection.mountPath)
      }
    })

    await this.websocketClient.connect()
    await this.subscription.ready

    if (!this.disposed) await this.liveCounts.start()

    if (!this.disposed && this.legacyStats) {
      this.subscription.close()
      this.subscription = null
      await this.websocketClient.disconnectAndStopReconnect()
      this.pollTimer = setInterval(() => this.liveCounts.reconnect(), LEGACY_POLL_INTERVAL_MS)
    }
  }

  /** @returns {Promise<void>} - Requests one coalesced authoritative snapshot. */
  async refresh() {
    this.liveCounts.reconnect()
    await this.liveCounts.whenIdle()
  }

  /** @returns {Promise<void>} - Waits for coalesced snapshot recovery. */
  async whenIdle() {
    await this.liveCounts.whenIdle()
  }

  /** @returns {Promise<void>} - Stops subscription, state, socket, and retries. */
  async dispose() {
    if (this.disposed) return

    this.disposed = true
    this.liveCounts.dispose()
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.subscription?.close()
    this.subscription = null
    await this.websocketClient.disconnectAndStopReconnect()
  }

  /** @returns {Promise<any>} - Normalizes legacy snapshots into a local polling revision. */
  _loadSnapshot = async () => {
    const snapshot = await this.loadSnapshot()

    if (snapshot?.capabilities?.backgroundJobCountDeltas === 1) return snapshot

    this.legacyStats = true
    this.legacyRevision += 1

    return {...snapshot, revision: this.legacyRevision}
  }
}

export {COUNTS_CHANNEL, normalizeMountPath, websocketUrl}
