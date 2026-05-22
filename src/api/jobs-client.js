// @ts-check

const DEFAULT_MOUNT_PATH = "/velocious/jobs"

/** Error thrown when a jobs API request fails. Carries the HTTP status. */
export class JobsClientError extends Error {
  /**
   * @param {string} message - Error message.
   * @param {object} [args] - Options.
   * @param {number} [args.status] - HTTP status code.
   */
  constructor(message, {status} = {}) {
    super(message)
    this.name = "JobsClientError"
    this.status = status
  }
}

/**
 * @typedef {object} JobsClientConfig
 * @property {string} baseUrl - Backend base URL, e.g. "https://api.example.com".
 * @property {string} [token] - Bearer token sent as `Authorization: Bearer <token>`.
 * @property {string} [mountPath] - Prefix the API is mounted at (default "/velocious/jobs").
 */

/**
 * @typedef {object} JobsListParams
 * @property {string} [status] - Filter by status.
 * @property {string} [jobName] - Filter by job name.
 * @property {number} [page] - Page number (1-based).
 * @property {number} [perPage] - Page size.
 * @property {string} [sort] - Sort key, optionally prefixed with "-" for descending.
 */

/** Thin REST client for a backend's mounted Velocious background-jobs API. */
export default class JobsClient {
  /** @param {JobsClientConfig} config - Connection configuration. */
  constructor({baseUrl, token, mountPath}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "")
    this.token = token
    this.mountPath = (mountPath || DEFAULT_MOUNT_PATH).replace(/\/+$/, "")
  }

  /** @returns {Promise<{ok: boolean}>} - Health check result. */
  async health() {
    return await this._get("/api/health")
  }

  /** @returns {Promise<{counts: Record<string, number>, total: number, generatedAtMs: number}>} - Status counts. */
  async stats() {
    return await this._get("/api/stats")
  }

  /**
   * @param {JobsListParams} [params] - List filters.
   * @returns {Promise<{jobs: Array<Record<string, any>>, pagination: {page: number, perPage: number, total: number, totalPages: number}}>} - Paginated jobs.
   */
  async jobs(params = {}) {
    return await this._get(`/api/jobs${this._query(params)}`)
  }

  /**
   * @param {string} id - Job id.
   * @returns {Promise<{job: Record<string, any>}>} - The job.
   */
  async job(id) {
    return await this._get(`/api/jobs/${encodeURIComponent(id)}`)
  }

  /** @returns {Promise<{schedule: Array<Record<string, any>>}>} - Recurring jobs. */
  async schedule() {
    return await this._get("/api/schedule")
  }

  /**
   * @param {Record<string, any>} params - Query params.
   * @returns {string} - Encoded query string (with leading "?") or empty string.
   */
  _query(params) {
    const search = new URLSearchParams()

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        search.set(key, String(value))
      }
    }

    const queryString = search.toString()

    return queryString ? `?${queryString}` : ""
  }

  /**
   * @param {string} path - Path under the mount prefix.
   * @returns {Promise<any>} - Parsed JSON response.
   */
  async _get(path) {
    /** @type {Record<string, string>} */
    const headers = {Accept: "application/json"}

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    let response

    try {
      response = await fetch(`${this.baseUrl}${this.mountPath}${path}`, {headers})
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      throw new JobsClientError(`Could not reach ${this.baseUrl}: ${reason}`)
    }

    if (response.status === 401) {
      throw new JobsClientError("Unauthorized — check the access token for this connection.", {status: 401})
    }

    if (!response.ok) {
      throw new JobsClientError(`Request failed with status ${response.status}.`, {status: response.status})
    }

    return await response.json()
  }
}
