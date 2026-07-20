// @ts-check

import {createServer} from "node:http"
import {describe, expect, it} from "velocious/build/src/testing/test.js"
import SystemTest from "system-testing/build/system-test.js"

const connectionId = "persisted-connection"

/** @returns {Promise<{baseUrl: string, close: () => Promise<void>, requests: string[]}>} */
async function startFixtureServer() {
  /** @type {string[]} */
  const requests = []
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.setHeader("Access-Control-Allow-Origin", "*")

    if (request.method === "OPTIONS") {
      response.writeHead(204).end()
      return
    }

    requests.push(request.url || "")

    if (request.url === "/dashboard/api/jobs?page=1&perPage=25&status=queued") {
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({jobs: [], pagination: {page: 1, perPage: 25, total: 0, totalPages: 0}}))
      return
    }

    response.writeHead(404).end()
  })

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen({host: "0.0.0.0", port: 0}, () => resolve(undefined))
  })

  const address = server.address()

  if (!address || typeof address === "string") throw new Error("Fixture server did not expose a TCP port.")

  return {
    baseUrl: `http://localhost:${address.port}`,
    close: async () => await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    requests
  }
}

describe("connection hydration boundary", () => {
  it("holds a direct jobs route until its persisted connection is loaded", async () => {
    await SystemTest.run(async (systemTest) => {
      const fixtureServer = await startFixtureServer()
      const connection = {
        baseUrl: fixtureServer.baseUrl,
        id: connectionId,
        mountPath: "/dashboard",
        name: "Persisted dashboard",
        token: "test-token"
      }
      try {
        const scoundrel = await systemTest.getScoundrelClient()
        const hydration = await scoundrel.getObject("VelociousDashboardConnectionsHydration")

        await hydration.arm(JSON.stringify([connection]))
        const reloadableSystemTest = /** @type {typeof systemTest & {initializeBrowserContext: () => Promise<void>, visitPathWithDriverAndReconnect: (path: string) => Promise<void>}} */ (systemTest)

        await reloadableSystemTest.visitPathWithDriverAndReconnect(`/connections/${connectionId}/jobs?status=queued`)
        await reloadableSystemTest.initializeBrowserContext()

        await systemTest.waitForTestIDText("hydrationLoadingLabel", "Loading connections…")
        expect(fixtureServer.requests).toEqual([])
        expect(await systemTest.hasTestID("jobsScreen", {timeout: 0})).toEqual(false)

        const reloadedScoundrel = await systemTest.getScoundrelClient()
        const reloadedHydration = await reloadedScoundrel.getObject("VelociousDashboardConnectionsHydration")
        await reloadedHydration.release()

        await systemTest.findByTestID("jobsScreen")
        await systemTest.waitForTestIDText("jobsEmpty", "No jobs match this filter.")
        const currentUrl = new URL(await systemTest.getCurrentUrl())
        currentUrl.searchParams.delete("systemTest")
        currentUrl.searchParams.delete("systemTestClientWsPort")
        currentUrl.searchParams.delete("systemTestScoundrelPort")
        expect(`${currentUrl.pathname}${currentUrl.search}`).toEqual(`/connections/${connectionId}/jobs?status=queued`)
        expect(fixtureServer.requests).toEqual(["/dashboard/api/jobs?page=1&perPage=25&status=queued"])
        expect(fixtureServer.requests.some((url) => url.includes("undefined") || url.includes("missing"))).toEqual(false)
      } finally {
        try {
          const cleanupScoundrel = await systemTest.getScoundrelClient()
          const cleanupHydration = await cleanupScoundrel.getObject("VelociousDashboardConnectionsHydration")

          await cleanupHydration.reset()
        } finally {
          await fixtureServer.close()
        }
      }
    })
  })

  it("releases a missing persisted connection to the not-found state without an API request", async () => {
    await SystemTest.run(async (systemTest) => {
      const fixtureServer = await startFixtureServer()
      try {
        const scoundrel = await systemTest.getScoundrelClient()
        const hydration = await scoundrel.getObject("VelociousDashboardConnectionsHydration")

        await hydration.arm(JSON.stringify([{
          baseUrl: fixtureServer.baseUrl,
          id: "other-connection",
          mountPath: "/dashboard",
          name: "Other connection",
          token: "other-token"
        }]))
        const reloadableSystemTest = /** @type {typeof systemTest & {initializeBrowserContext: () => Promise<void>, visitPathWithDriverAndReconnect: (path: string) => Promise<void>}} */ (systemTest)

        await reloadableSystemTest.visitPathWithDriverAndReconnect("/connections/missing/jobs")
        await reloadableSystemTest.initializeBrowserContext()
        await systemTest.waitForTestIDText("hydrationLoadingLabel", "Loading connections…")
        expect(fixtureServer.requests).toEqual([])

        const reloadedScoundrel = await systemTest.getScoundrelClient()
        const reloadedHydration = await reloadedScoundrel.getObject("VelociousDashboardConnectionsHydration")
        await reloadedHydration.release()

        await systemTest.waitForTestIDText("jobsNotFound", "Connection not found.")
        expect(fixtureServer.requests).toEqual([])
      } finally {
        try {
          const cleanupScoundrel = await systemTest.getScoundrelClient()
          const cleanupHydration = await cleanupScoundrel.getObject("VelociousDashboardConnectionsHydration")

          await cleanupHydration.reset()
        } finally {
          await fixtureServer.close()
        }
      }
    })
  })
})
