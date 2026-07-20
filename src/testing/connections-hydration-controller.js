// @ts-check

import AsyncStorage from "@react-native-async-storage/async-storage"

const ARMED_KEY = "velocious-dashboard.system-tests.hold-connections-hydration"
const STORAGE_KEY = "velocious-dashboard.connections"

/** @typedef {Pick<typeof AsyncStorage, "getItem" | "setItem">} ConnectionsStorage */
/** @typedef {{arm: (serializedConnections: string) => Promise<void>, release: () => void, reset: () => Promise<void>}} HydrationController */

/** @type {(() => void) | null} */
let release = null

/** @type {HydrationController} */
const controller = {
  /** Arms the next page load with persisted connection data and a held storage read. */
  async arm(serializedConnections) {
    await AsyncStorage.setItem(STORAGE_KEY, serializedConnections)
    globalThis.sessionStorage.setItem(ARMED_KEY, "true")
  },

  /** Releases the pending persisted-connections read. */
  release() {
    if (!release) throw new Error("Connections hydration is not being held.")

    release()
    release = null
  },

  /** Clears persisted and armed hydration state after a system test. */
  async reset() {
    globalThis.sessionStorage.removeItem(ARMED_KEY)
    await AsyncStorage.removeItem(STORAGE_KEY)

    if (release) {
      release()
      release = null
    }
  }
}

const systemTestGlobal = /** @type {typeof globalThis & {VELOCIOUS_DASHBOARD_CONNECTIONS_STORAGE?: ConnectionsStorage, VelociousDashboardConnectionsHydration?: HydrationController}} */ (globalThis)

systemTestGlobal.VelociousDashboardConnectionsHydration = controller

if (globalThis.sessionStorage?.getItem(ARMED_KEY) === "true") {
  globalThis.sessionStorage.removeItem(ARMED_KEY)
  const hydrationReleased = new Promise((resolve) => {
    release = () => resolve(undefined)
  })

  systemTestGlobal.VELOCIOUS_DASHBOARD_CONNECTIONS_STORAGE = {
    getItem: async (/** @type {string} */ key) => {
      await hydrationReleased
      return await AsyncStorage.getItem(key)
    },
    setItem: async (/** @type {string} */ key, /** @type {string} */ value) => await AsyncStorage.setItem(key, value)
  }
}
