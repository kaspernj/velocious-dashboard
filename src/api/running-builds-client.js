// @ts-check

const RUNNING_BUILDS_PATH = "/velocious/api/builds/running"

/** Error thrown when a running-builds API request fails. */
export class RunningBuildsClientError extends Error {
  /**
   * @param {string} message - Error message.
   * @param {object} [args] - Options.
   * @param {number} [args.status] - HTTP status code.
   */
  constructor(message, {status} = {}) {
    super(message)
    this.name = "RunningBuildsClientError"
    this.status = status
  }
}

/**
 * @typedef {object} RunningBuild
 * @property {string} buildId - Build id.
 * @property {string} buildGroupId - Build-group id.
 * @property {{id: string, name: string, slug: string} | null} project - Project summary.
 * @property {string} branchName - Source branch.
 * @property {"assigned" | "running"} status - Active build status.
 * @property {{id: string, name: string} | null} dockerServer - Assigned worker/server.
 * @property {string} priority - Queue priority.
 * @property {boolean} chainedBuild - Whether this is a chained build.
 * @property {number | null} estimatedMemoryUsage - Estimated memory when known.
 * @property {number | null} estimatedCpuUsage - Estimated CPU when known.
 * @property {number | null} createdAtMs - Creation timestamp.
 * @property {number | null} statusUpdatedAtMs - Latest status transition timestamp when known.
 * @property {string | null} detailPath - Relative TensorBuzz build path when the project is available.
 */

/** Thin client for TensorBuzz's protected operational API. */
export default class RunningBuildsClient {
  /** @param {{baseUrl: string, token?: string}} config - Connection configuration. */
  constructor({baseUrl, token}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "")
    this.token = token
  }

  /** @returns {Promise<{builds: RunningBuild[], generatedAtMs: number}>} - Active builds in API order. */
  async runningBuilds() {
    /** @type {Record<string, string>} */
    const headers = {Accept: "application/json"}

    if (this.token) headers.Authorization = `Bearer ${this.token}`

    let response

    try {
      response = await fetch(`${this.baseUrl}${RUNNING_BUILDS_PATH}`, {headers})
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      throw new RunningBuildsClientError(`Could not reach ${this.baseUrl}: ${reason}`)
    }

    if (response.status === 401) {
      throw new RunningBuildsClientError("Unauthorized — check the access token for this connection.", {status: 401})
    }

    if (!response.ok) {
      throw new RunningBuildsClientError(`Request failed with status ${response.status}${response.statusText ? ` (${response.statusText})` : ""}.`, {status: response.status})
    }

    let payload

    try {
      payload = await response.json()
    } catch {
      throw new RunningBuildsClientError("Running builds response was not valid JSON.")
    }

    if (!this._validPayload(payload)) {
      throw new RunningBuildsClientError("Running builds response was malformed.")
    }

    return payload
  }

  /**
   * @param {unknown} payload - Parsed response.
   * @returns {payload is {builds: RunningBuild[], generatedAtMs: number}} - Whether the response has the public contract.
   */
  _validPayload(payload) {
    if (!payload || typeof payload !== "object") return false

    const result = /** @type {Record<string, any>} */ (payload)

    return Number.isFinite(result.generatedAtMs) && Array.isArray(result.builds) && result.builds.every((build) => this._validBuild(build))
  }

  /** @param {unknown} value - Build candidate. @returns {value is RunningBuild} - Whether required fields are valid. */
  _validBuild(value) {
    if (!value || typeof value !== "object") return false

    const build = /** @type {Record<string, any>} */ (value)
    const nullableNumber = (/** @type {unknown} */ field) => field === null || Number.isFinite(field)
    const projectValid = build.project === null || (
      typeof build.project === "object" &&
      typeof build.project.id === "string" &&
      typeof build.project.name === "string" &&
      typeof build.project.slug === "string"
    )
    const serverValid = build.dockerServer === null || (
      typeof build.dockerServer === "object" &&
      typeof build.dockerServer.id === "string" &&
      typeof build.dockerServer.name === "string"
    )

    return typeof build.buildId === "string" &&
      typeof build.buildGroupId === "string" &&
      projectValid &&
      typeof build.branchName === "string" &&
      (build.status === "assigned" || build.status === "running") &&
      serverValid &&
      typeof build.priority === "string" &&
      typeof build.chainedBuild === "boolean" &&
      nullableNumber(build.estimatedMemoryUsage) &&
      nullableNumber(build.estimatedCpuUsage) &&
      nullableNumber(build.createdAtMs) &&
      nullableNumber(build.statusUpdatedAtMs) &&
      (build.detailPath === null || (
        typeof build.detailPath === "string" &&
        build.detailPath.startsWith("/") &&
        !build.detailPath.startsWith("//") &&
        !build.detailPath.includes("\\")
      ))
  }
}
