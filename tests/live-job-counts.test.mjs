// @ts-check

import assert from "node:assert/strict"
import {describe, it} from "node:test"
import LiveJobCounts from "../src/background-jobs/live-job-counts.mjs"

/** @returns {{promise: Promise<any>, reject: (error: Error) => void, resolve: (value: any) => void}} */
function deferred() {
  /** @type {(value: any) => void} */
  let resolve = () => {}
  /** @type {(error: Error) => void} */
  let reject = () => {}
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {promise, reject, resolve}
}

/** @param {number} revision @param {Record<string, number>} [counts] */
function snapshot(revision, counts = {}) {
  return {
    capabilities: {backgroundJobCountDeltas: 1},
    counts: {
      all: 3,
      completed: 0,
      failed: 0,
      handed_off: 1,
      orphaned: 0,
      queued: 2,
      ...counts
    },
    generatedAtMs: 123,
    revision,
    total: 4
  }
}

describe("LiveJobCounts", () => {
  it("installs one revisioned snapshot and applies consecutive signed and bulk deltas locally", async () => {
    let loads = 0
    /** @type {object[]} */
    const states = []
    const counts = new LiveJobCounts({
      loadSnapshot: async () => {
        loads += 1
        return snapshot(10)
      },
      onChange: (state) => states.push(state)
    })

    await counts.start()
    counts.receive({deltas: {handed_off: 1, queued: -1}, revision: 11, type: "background-job-count-delta"})
    counts.receive({deltas: {all: -2, queued: -1, handed_off: -1}, revision: 12, type: "background-job-count-delta"})

    assert.equal(loads, 1)
    assert.deepEqual(states.at(-1), {
      counts: {all: 1, completed: 0, failed: 0, handed_off: 1, orphaned: 0, queued: 0},
      revision: 12,
      total: 4
    })
  })

  it("ignores duplicate and old revisions, then coalesces a gap burst into one recovery", async () => {
    const recovery = deferred()
    let loads = 0
    const counts = new LiveJobCounts({
      loadSnapshot: async () => {
        loads += 1
        return loads === 1 ? snapshot(20) : await recovery.promise
      },
      onChange: () => {}
    })

    await counts.start()
    counts.receive({deltas: {queued: -1}, revision: 20, type: "background-job-count-delta"})
    counts.receive({deltas: {queued: -1}, revision: 19, type: "background-job-count-delta"})
    counts.receive({deltas: {queued: -1}, revision: 23, type: "background-job-count-delta"})
    counts.receive({deltas: {queued: -1}, revision: 24, type: "background-job-count-delta"})
    counts.receive({deltas: {queued: -1}, revision: 25, type: "background-job-count-delta"})

    await Promise.resolve()
    assert.equal(loads, 2)
    recovery.resolve(snapshot(25, {queued: 0}))
    await counts.whenIdle()
    assert.equal(loads, 2)
    assert.equal(counts.current()?.revision, 25)
  })

  it("recovers on reconnect and malformed messages without allowing stale snapshots to win", async () => {
    const firstRecovery = deferred()
    const secondRecovery = deferred()
    let loads = 0
    const counts = new LiveJobCounts({
      loadSnapshot: async () => {
        loads += 1
        if (loads === 1) return snapshot(30)
        if (loads === 2) return await firstRecovery.promise
        return await secondRecovery.promise
      },
      onChange: () => {}
    })

    await counts.start()
    counts.reconnect()
    counts.receive({deltas: {queued: Number.NaN}, revision: 31, type: "background-job-count-delta"})
    firstRecovery.resolve(snapshot(31))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(loads, 3)
    secondRecovery.resolve(snapshot(32, {queued: 1}))
    await counts.whenIdle()
    assert.equal(counts.current()?.revision, 32)
  })

  it("bounds pre-snapshot buffering and ignores async completion after disposal", async () => {
    const initial = deferred()
    /** @type {object[]} */
    const states = []
    const counts = new LiveJobCounts({
      loadSnapshot: async () => await initial.promise,
      maxBufferedDeltas: 2,
      onChange: (state) => states.push(state)
    })

    const starting = counts.start()
    counts.receive({deltas: {queued: 1}, revision: 2, type: "background-job-count-delta"})
    counts.receive({deltas: {queued: 1}, revision: 3, type: "background-job-count-delta"})
    counts.receive({deltas: {queued: 1}, revision: 4, type: "background-job-count-delta"})
    counts.dispose()
    initial.resolve(snapshot(1))
    await starting

    assert.equal(counts.bufferedCount(), 0)
    assert.deepEqual(states, [])
  })
})
