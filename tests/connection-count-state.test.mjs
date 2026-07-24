// @ts-check

import assert from "node:assert/strict"
import {describe, it} from "node:test"
import {jobsCountsLoadingState, overviewCountsLoadingState} from "../src/background-jobs/connection-count-state.mjs"

describe("connection count loading state", () => {
  it("clears overview stats and restores first-load state for a replacement connection", () => {
    assert.deepEqual(overviewCountsLoadingState(), {
      errorMessage: null,
      loading: true,
      refreshing: false,
      stats: null
    })
  })

  it("clears job-filter badges and their prior connection error", () => {
    assert.deepEqual(jobsCountsLoadingState(), {
      countErrorMessage: null,
      counts: null
    })
  })
})
