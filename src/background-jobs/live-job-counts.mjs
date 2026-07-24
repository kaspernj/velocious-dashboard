// @ts-check

const COUNT_BUCKETS = ["all", "queued", "handed_off", "completed", "failed", "orphaned"]
const DEFAULT_MAX_BUFFERED_DELTAS = 100

/**
 * @typedef {object} CountState
 * @property {Record<string, number>} counts
 * @property {number} revision
 * @property {number} total
 */

/**
 * Owns the durable snapshot/revision state machine independently from the
 * WebSocket transport and the screen lifecycle.
 */
export default class LiveJobCounts {
  /**
   * @param {object} args - State owner dependencies.
   * @param {() => Promise<any>} args.loadSnapshot - Loads the authoritative snapshot.
   * @param {(state: CountState) => void} args.onChange - Publishes installed state.
   * @param {(error: Error) => void} [args.onError] - Surfaces asynchronous recovery failures.
   * @param {number} [args.maxBufferedDeltas] - Maximum events retained while uncertain.
   */
  constructor({loadSnapshot, maxBufferedDeltas = DEFAULT_MAX_BUFFERED_DELTAS, onChange, onError = () => {}}) {
    this.loadSnapshot = loadSnapshot
    this.maxBufferedDeltas = maxBufferedDeltas
    this.onChange = onChange
    this.onError = onError
  }

  /** @type {Array<{deltas: Record<string, number>, revision: number, type: string}>} */
  bufferedDeltas = []
  disposed = false
  generation = 0
  pendingRecovery = false
  /** @type {Promise<void> | null} */
  recoveryPromise = null
  /** @type {CountState | null} */
  state = null
  uncertain = true

  /** @returns {Promise<void>} - Loads the first authoritative baseline. */
  async start() {
    await this._recover()
  }

  /** @returns {CountState | null} - Current installed state. */
  current() {
    return this.state
  }

  /** @returns {number} - Buffered event count, exposed for bounded-state verification. */
  bufferedCount() {
    return this.bufferedDeltas.length
  }

  /**
   * Applies or buffers a count delta.
   * @param {any} message - Untrusted channel message.
   * @returns {void}
   */
  receive(message) {
    if (this.disposed) return

    const delta = this._normalizeDelta(message)

    if (!delta) {
      this.pendingRecovery = true
      this._requestRecovery()
      return
    }

    if (!this.state || this.uncertain) {
      this._buffer(delta)
      return
    }

    if (delta.revision <= this.state.revision) return

    if (delta.revision !== this.state.revision + 1) {
      this.uncertain = true
      this._buffer(delta)
      this._requestRecovery()
      return
    }

    if (this._wouldUnderflow(delta)) {
      this.uncertain = true
      this._requestRecovery()
      return
    }

    this._apply(delta)
  }

  /** @returns {void} - Marks count state uncertain after transport reconnection. */
  reconnect() {
    if (this.disposed) return

    this.uncertain = true
    this.pendingRecovery = true
    this._requestRecovery()
  }

  /** @returns {Promise<void>} - Waits for current and coalesced recovery work. */
  async whenIdle() {
    while (this.recoveryPromise) {
      await this.recoveryPromise
    }
  }

  /** @returns {void} - Invalidates pending work and releases bounded state. */
  dispose() {
    this.disposed = true
    this.generation += 1
    this.pendingRecovery = false
    this.bufferedDeltas = []
  }

  /** @returns {void} - Starts recovery without leaking a rejected background promise. */
  _requestRecovery() {
    void this._recover().catch((error) => {
      if (!this.disposed) this.onError(error instanceof Error ? error : new Error(String(error)))
    })
  }

  /** @param {{deltas: Record<string, number>, revision: number, type: string}} delta */
  _apply(delta) {
    if (!this.state) return

    const nextCounts = {...this.state.counts}

    for (const [bucket, amount] of Object.entries(delta.deltas)) {
      nextCounts[bucket] += amount
    }

    this.state = {...this.state, counts: nextCounts, revision: delta.revision}
    this.onChange(this.state)
  }

  /** @param {{deltas: Record<string, number>}} delta @returns {boolean} - Whether applying this delta would make a bucket negative. */
  _wouldUnderflow(delta) {
    const state = this.state

    if (!state) return false

    return Object.entries(delta.deltas).some(([bucket, amount]) => state.counts[bucket] + amount < 0)
  }

  /** @param {{deltas: Record<string, number>, revision: number, type: string}} delta */
  _buffer(delta) {
    if (this.bufferedDeltas.some((buffered) => buffered.revision === delta.revision)) return

    this.bufferedDeltas.push(delta)
    this.bufferedDeltas.sort((left, right) => left.revision - right.revision)

    if (this.bufferedDeltas.length > this.maxBufferedDeltas) {
      this.bufferedDeltas.splice(0, this.bufferedDeltas.length - this.maxBufferedDeltas)
    }
  }

  /** @param {any} message @returns {{deltas: Record<string, number>, revision: number, type: string} | null} */
  _normalizeDelta(message) {
    if (!message || typeof message !== "object" || Array.isArray(message)) return null
    if (message.type !== "background-job-count-delta") return null
    if (!Number.isSafeInteger(message.revision) || message.revision < 1) return null
    if (!message.deltas || typeof message.deltas !== "object" || Array.isArray(message.deltas)) return null

    /** @type {Record<string, number>} */
    const deltas = {}

    for (const [bucket, amount] of Object.entries(message.deltas)) {
      if (!COUNT_BUCKETS.includes(bucket)) return null
      if (!Number.isSafeInteger(amount) || amount === 0) return null
      deltas[bucket] = amount
    }

    if (Object.keys(deltas).length === 0) return null

    return {deltas, revision: message.revision, type: message.type}
  }

  /** @param {any} snapshot @returns {CountState | null} */
  _normalizeSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null
    if (!Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) return null
    if (!Number.isSafeInteger(snapshot.total) || snapshot.total < 0) return null
    if (!snapshot.counts || typeof snapshot.counts !== "object" || Array.isArray(snapshot.counts)) return null

    /** @type {Record<string, number>} */
    const counts = {}

    for (const bucket of COUNT_BUCKETS) {
      const count = snapshot.counts[bucket]

      if (!Number.isSafeInteger(count) || count < 0) return null
      counts[bucket] = count
    }

    return {counts, revision: snapshot.revision, total: snapshot.total}
  }

  /** @returns {Promise<void>} */
  async _recover() {
    if (this.disposed) return
    if (this.recoveryPromise) return await this.recoveryPromise

    const generation = this.generation
    this.pendingRecovery = false
    const recovery = this._loadAndInstall(generation)
    this.recoveryPromise = recovery

    try {
      await recovery
    } finally {
      if (this.recoveryPromise === recovery) this.recoveryPromise = null
    }

    if (!this.disposed && this.pendingRecovery) {
      await this._recover()
    }
  }

  /** @param {number} generation @returns {Promise<void>} */
  async _loadAndInstall(generation) {
    const result = await this.loadSnapshot()

    if (this.disposed || generation !== this.generation) return

    const snapshot = this._normalizeSnapshot(result)

    if (!snapshot) {
      this.uncertain = true
      throw new Error("Background-job count snapshot was malformed.")
    }

    if (!this.state || snapshot.revision >= this.state.revision) {
      this.state = snapshot
    }

    this.uncertain = false
    const buffered = this.bufferedDeltas
    this.bufferedDeltas = []

    for (const delta of buffered) {
      if (!this.state || delta.revision <= this.state.revision) continue

      if (delta.revision !== this.state.revision + 1) {
        this.uncertain = true
        break
      }

      if (this._wouldUnderflow(delta)) {
        this.uncertain = true
        break
      }

      this._apply(delta)
    }

    if (this.uncertain) {
      this.pendingRecovery = true
    } else if (this.state) {
      this.onChange(this.state)
    }
  }
}

export {COUNT_BUCKETS}
