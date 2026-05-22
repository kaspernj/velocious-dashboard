// @ts-check

import AsyncStorage from "@react-native-async-storage/async-storage"

const STORAGE_KEY = "velocious-dashboard.connections"

/**
 * @typedef {object} Connection
 * @property {string} id - Stable local id.
 * @property {string} name - Human-readable label.
 * @property {string} baseUrl - Backend base URL.
 * @property {string} token - Bearer access token (may be empty for loopback/dev).
 * @property {string} mountPath - Prefix the jobs API is mounted at.
 */

/**
 * @param {unknown} value - Parsed storage value.
 * @returns {Connection[]} - Validated connections.
 */
function normalizeConnections(value) {
  if (!Array.isArray(value)) return []

  return value
    .filter((entry) => entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.baseUrl === "string")
    .map((entry) => ({
      baseUrl: String(entry.baseUrl),
      id: String(entry.id),
      mountPath: typeof entry.mountPath === "string" && entry.mountPath.length > 0 ? entry.mountPath : "/velocious/jobs",
      name: typeof entry.name === "string" && entry.name.length > 0 ? entry.name : String(entry.baseUrl),
      token: typeof entry.token === "string" ? entry.token : ""
    }))
}

/** @returns {Promise<Connection[]>} - Persisted connections (empty when none). */
export async function loadConnections() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)

  if (!raw) return []

  try {
    return normalizeConnections(JSON.parse(raw))
  } catch {
    return []
  }
}

/**
 * @param {Connection[]} connections - Connections to persist.
 * @returns {Promise<void>} - Resolves when written.
 */
export async function saveConnections(connections) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
}

/**
 * @param {Omit<Connection, "id">} connection - Connection without an id.
 * @returns {Promise<Connection[]>} - The updated connection list.
 */
export async function addConnection(connection) {
  const connections = await loadConnections()
  const id = `conn-${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const next = [...connections, {...connection, id}]

  await saveConnections(next)

  return next
}

/**
 * @param {string} id - Connection id to remove.
 * @returns {Promise<Connection[]>} - The updated connection list.
 */
export async function removeConnection(id) {
  const connections = await loadConnections()
  const next = connections.filter((connection) => connection.id !== id)

  await saveConnections(next)

  return next
}
