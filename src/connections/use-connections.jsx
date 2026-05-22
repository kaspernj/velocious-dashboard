// @ts-check

import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react"
import {addConnection as addConnectionToStore, loadConnections, removeConnection as removeConnectionFromStore} from "./connections-store.js"
import {embeddedConnection} from "../config/runtime.js"
import PropTypes from "prop-types"

/**
 * @import {ReactNode} from "react"
 * @typedef {import("./connections-store.js").Connection} Connection
 */

/**
 * @typedef {object} ConnectionsContextValue
 * @property {Connection[]} connections - All known connections.
 * @property {boolean} loading - Whether the initial load is in progress.
 * @property {boolean} embedded - Whether running embedded against a single backend.
 * @property {(connection: Omit<Connection, "id">) => Promise<void>} addConnection - Persist a new connection.
 * @property {(id: string) => Promise<void>} removeConnection - Remove a connection.
 * @property {(id: string) => Connection | undefined} getConnection - Look up a connection by id.
 */

const ConnectionsContext = createContext(/** @type {ConnectionsContextValue | null} */ (null))

/**
 * Provides the list of backend connections, persisted in AsyncStorage. In
 * embedded mode the list is a single fixed same-origin connection.
 * @param {object} props - Props.
 * @param {ReactNode} props.children - Children.
 * @returns {React.JSX.Element} - Provider element.
 */
export function ConnectionsProvider({children}) {
  const embedded = useMemo(() => embeddedConnection(), [])
  const [connections, setConnections] = useState(/** @type {Connection[]} */ (embedded ? [embedded] : []))
  const [loading, setLoading] = useState(!embedded)

  useEffect(() => {
    if (embedded) return

    let cancelled = false

    const load = async () => {
      try {
        const loaded = await loadConnections()

        if (!cancelled) setConnections(loaded)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [embedded])

  const addConnection = useCallback(async (/** @type {Omit<Connection, "id">} */ connection) => {
    const next = await addConnectionToStore(connection)

    setConnections(next)
  }, [])

  const removeConnection = useCallback(async (/** @type {string} */ id) => {
    const next = await removeConnectionFromStore(id)

    setConnections(next)
  }, [])

  const getConnection = useCallback(
    (/** @type {string} */ id) => connections.find((connection) => connection.id === id),
    [connections]
  )

  const value = useMemo(
    () => ({addConnection, connections, embedded: Boolean(embedded), getConnection, loading, removeConnection}),
    [addConnection, connections, embedded, getConnection, loading, removeConnection]
  )

  return <ConnectionsContext.Provider value={value}>{children}</ConnectionsContext.Provider>
}

ConnectionsProvider.propTypes = {
  children: PropTypes.node
}

/** @returns {ConnectionsContextValue} - The connections context. */
export function useConnections() {
  const context = useContext(ConnectionsContext)

  if (!context) {
    throw new Error("useConnections must be used within a ConnectionsProvider")
  }

  return context
}
