// @ts-check

import assert from "node:assert/strict"
import {describe, it} from "node:test"
import JobCountsSession from "../src/background-jobs/job-counts-session.mjs"

class FakeSubscription {
  closed = false
  ready = Promise.resolve()

  close() {
    this.closed = true
  }
}

class FakeWebsocketClient {
  /** @type {FakeWebsocketClient} */
  static instance

  /** @param {{url: string}} options */
  constructor(options) {
    this.options = options
    FakeWebsocketClient.instance = this
  }

  connected = false
  disconnected = false
  subscription = new FakeSubscription()

  /** @param {string} channelType @param {any} options */
  subscribeChannel(channelType, options) {
    this.channelType = channelType
    this.subscriptionOptions = options
    return this.subscription
  }

  async connect() {
    this.connected = true
  }

  async disconnectAndStopReconnect() {
    this.disconnected = true
  }
}

describe("JobCountsSession", () => {
  it("uses the framework channel name and mount-token authorization contract before snapshotting", async () => {
    /** @type {string[]} */
    const order = []
    class OrderedClient extends FakeWebsocketClient {
      /** @param {string} channelType @param {any} options */
      subscribeChannel(channelType, options) {
        order.push("subscribe")
        return super.subscribeChannel(channelType, options)
      }

      async connect() {
        order.push("connect")
        await super.connect()
      }
    }
    const session = new JobCountsSession({
      connection: {
        baseUrl: "https://jobs.example.test/",
        mountPath: "/velocious/jobs/",
        token: "secret"
      },
      loadSnapshot: async () => {
        order.push("snapshot")
        return {
          capabilities: {backgroundJobCountDeltas: 1},
          counts: {all: 0, completed: 0, failed: 0, handed_off: 0, orphaned: 0, queued: 0},
          revision: 7,
          total: 0
        }
      },
      onChange: () => {},
      WebsocketClient: OrderedClient
    })

    await session.start()

    const client = FakeWebsocketClient.instance
    assert.deepEqual(order, ["subscribe", "connect", "snapshot"])
    assert.equal(client.options.url, "wss://jobs.example.test/websocket")
    assert.equal(client.channelType, "velocious-background-job-counts")
    assert.deepEqual(client.subscriptionOptions.params, {
      authenticationToken: "secret",
      mountAt: "/velocious/jobs"
    })
  })

  it("recovers on resume and closes the subscription and reconnect loop on disposal", async () => {
    let loads = 0
    const session = new JobCountsSession({
      connection: {baseUrl: "http://localhost:3000", mountPath: "/jobs"},
      loadSnapshot: async () => {
        loads += 1
        return {
          capabilities: {backgroundJobCountDeltas: 1},
          counts: {all: 0, completed: 0, failed: 0, handed_off: 0, orphaned: 0, queued: 0},
          revision: loads,
          total: 0
        }
      },
      onChange: () => {},
      WebsocketClient: FakeWebsocketClient
    })

    await session.start()
    FakeWebsocketClient.instance.subscriptionOptions.onResume()
    await session.whenIdle()
    assert.equal(loads, 2)

    await session.dispose()
    assert.equal(FakeWebsocketClient.instance.subscription.closed, true)
    assert.equal(FakeWebsocketClient.instance.disconnected, true)
  })
})
