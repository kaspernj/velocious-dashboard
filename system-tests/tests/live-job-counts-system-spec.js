// @ts-check

import {createServer} from "node:http"
import {describe, expect, it} from "velocious/build/src/testing/test.js"
import SystemTest from "system-testing/build/system-test.js"
import {WebSocketServer} from "ws"

const connectionId = "live-counts-connection"
const replacementConnectionId = "replacement-live-counts-connection"

/** @param {number} revision @param {Record<string, number>} counts */
function stats(revision, counts) {
  return {
    capabilities: {backgroundJobCountDeltas: 1},
    counts,
    generatedAtMs: Date.now(),
    revision,
    total: counts.all
  }
}

/** @returns {Promise<{baseUrl: string, close: () => Promise<void>, publish: (body: object) => void, requests: string[], subscriptionParams: object | null, snapshots: object[]}>} */
async function startFixtureServer() {
  /** @type {string[]} */
  const requests = []
  const initialStats = stats(1, {all: 3, completed: 0, failed: 0, handed_off: 1, orphaned: 0, queued: 2})
  const snapshots = [initialStats, initialStats]
  const websocketServer = new WebSocketServer({noServer: true})
  /** @type {import("ws").WebSocket | null} */
  let subscriber = null
  let subscriptionId = ""
  let statsResponses = 0
  /** @type {(() => void) | null} */
  let acknowledgePendingSubscription = null
  /** @type {object | null} */
  let subscriptionParams = null
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.setHeader("Access-Control-Allow-Origin", "*")

    if (request.method === "OPTIONS") {
      response.writeHead(204).end()
      return
    }

    requests.push(request.url || "")

    if (request.url === "/dashboard/api/stats") {
      const snapshot = snapshots.shift()

      if (!snapshot) {
        response.writeHead(500).end()
        return
      }

      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify(snapshot))
      statsResponses += 1
      acknowledgePendingSubscription?.()
      acknowledgePendingSubscription = null
      return
    }

    if (request.url === "/dashboard/api/jobs?page=1&perPage=25") {
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({jobs: [], pagination: {page: 1, perPage: 25, total: 0, totalPages: 0}}))
      return
    }

    response.writeHead(404).end()
  })

  server.on("upgrade", (request, socket, head) => {
    if (request.url !== "/websocket") {
      socket.destroy()
      return
    }

    websocketServer.handleUpgrade(request, socket, head, (websocket) => websocketServer.emit("connection", websocket, request))
  })
  websocketServer.on("connection", (websocket) => {
    websocket.send(JSON.stringify({sessionId: "live-counts-session", type: "session-established"}))
    websocket.on("message", (data) => {
      const message = JSON.parse(String(data))

      if (message.type !== "channel-subscribe") return

      subscriber = websocket
      subscriptionId = message.subscriptionId
      subscriptionParams = message.params
      const acknowledge = () => websocket.send(JSON.stringify({subscriptionId: message.subscriptionId, type: "channel-subscribed"}))

      if (statsResponses > 0) {
        acknowledge()
      } else {
        acknowledgePendingSubscription = acknowledge
      }
    })
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen({host: "0.0.0.0", port: 0}, () => resolve(undefined))
  })
  const address = server.address()

  if (!address || typeof address === "string") throw new Error("Fixture server did not expose a TCP port.")

  return {
    baseUrl: `http://localhost:${address.port}`,
    close: async () => {
      for (const websocket of websocketServer.clients) websocket.terminate()
      await new Promise((resolve) => websocketServer.close(() => resolve(undefined)))
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(undefined)))
    },
    publish: (body) => {
      if (!subscriber) throw new Error("Count subscriber is not connected.")

      subscriber.send(JSON.stringify({body, subscriptionId, type: "channel-message"}))
    },
    requests,
    get subscriptionParams() {
      return subscriptionParams
    },
    snapshots
  }
}

describe("live background-job count badges", () => {
  it("applies consecutive deltas locally and fetches one recovery snapshot on a gap", async () => {
    await SystemTest.run(async (systemTest) => {
      const fixture = await startFixtureServer()
      const connection = {
        baseUrl: fixture.baseUrl,
        id: connectionId,
        mountPath: "/dashboard",
        name: "Live counts",
        token: "test-token"
      }

      try {
        const hydration = await (await systemTest.getScoundrelClient()).getObject("VelociousDashboardConnectionsHydration")

        await hydration.arm(JSON.stringify([connection]))
        const reloadableSystemTest = /** @type {typeof systemTest & {initializeBrowserContext: () => Promise<void>, visitPathWithDriverAndReconnect: (path: string) => Promise<void>}} */ (systemTest)

        await reloadableSystemTest.visitPathWithDriverAndReconnect("/")
        await reloadableSystemTest.initializeBrowserContext()
        await systemTest.waitForTestIDText("hydrationLoadingLabel", "Loading connections…")
        await systemTest.visit(`/connections/${connectionId}/jobs`)
        await systemTest.waitForTestIDText("hydrationLoadingLabel", "Loading connections…")
        expect(fixture.requests).toEqual([])

        const reloadedHydration = await (await systemTest.getScoundrelClient()).getObject("VelociousDashboardConnectionsHydration")

        await reloadedHydration.release()
        await systemTest.waitForTestIDText("jobsFilterCount-queued", "2")
        expect(fixture.subscriptionParams).toEqual({authenticationToken: "test-token", mountAt: "/dashboard"})

        fixture.publish({deltas: {handed_off: 1, queued: -1}, revision: 2, type: "background-job-count-delta"})
        await systemTest.waitForTestIDText("jobsFilterCount-queued", "1")
        await systemTest.waitForTestIDText("jobsFilterCount-handed_off", "2")
        fixture.publish({deltas: {queued: -1}, revision: 2, type: "background-job-count-delta"})
        expect(fixture.requests.filter((url) => url === "/dashboard/api/stats").length).toEqual(2)

        fixture.snapshots.push(stats(4, {all: 2, completed: 1, failed: 0, handed_off: 1, orphaned: 0, queued: 0}))
        fixture.publish({deltas: {all: -1, completed: 1, queued: -1}, revision: 4, type: "background-job-count-delta"})
        await systemTest.waitForTestIDText("jobsFilterCount-completed", "1")
        expect(fixture.requests.filter((url) => url === "/dashboard/api/stats").length).toEqual(3)
      } finally {
        try {
          const hydration = await (await systemTest.getScoundrelClient()).getObject("VelociousDashboardConnectionsHydration")

          await hydration.reset()
        } finally {
          await fixture.close()
        }
      }
    })
  })

  it("clears badges while a replacement connection loads", async () => {
    await SystemTest.run(async (systemTest) => {
      const fixture = await startFixtureServer()
      const connection = {
        baseUrl: fixture.baseUrl,
        id: connectionId,
        mountPath: "/dashboard",
        name: "Live counts",
        token: "test-token"
      }
      const replacementConnection = {...connection, id: replacementConnectionId, name: "Replacement counts"}

      try {
        const hydration = await (await systemTest.getScoundrelClient()).getObject("VelociousDashboardConnectionsHydration")

        await hydration.arm(JSON.stringify([connection, replacementConnection]))
        const reloadableSystemTest = /** @type {typeof systemTest & {initializeBrowserContext: () => Promise<void>, visitPathWithDriverAndReconnect: (path: string) => Promise<void>}} */ (systemTest)

        await reloadableSystemTest.visitPathWithDriverAndReconnect("/")
        await reloadableSystemTest.initializeBrowserContext()
        await systemTest.waitForTestIDText("hydrationLoadingLabel", "Loading connections…")
        await systemTest.visit(`/connections/${connectionId}/jobs`)
        const reloadedHydration = await (await systemTest.getScoundrelClient()).getObject("VelociousDashboardConnectionsHydration")

        await reloadedHydration.release()
        await systemTest.waitForTestIDText("jobsFilterCount-queued", "2")
        await systemTest.visit(`/connections/${replacementConnectionId}/jobs`)
        await systemTest.findByTestID("jobsCountsError")
        expect(await systemTest.hasTestID("jobsFilterCount-queued", {timeout: 0})).toEqual(false)
      } finally {
        try {
          const hydration = await (await systemTest.getScoundrelClient()).getObject("VelociousDashboardConnectionsHydration")

          await hydration.reset()
        } finally {
          await fixture.close()
        }
      }
    })
  })
})
