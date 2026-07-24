// @ts-check

/** @returns {{errorMessage: null, loading: true, refreshing: false, stats: null}} */
export function overviewCountsLoadingState() {
  return {
    errorMessage: null,
    loading: true,
    refreshing: false,
    stats: null
  }
}

/** @returns {{countErrorMessage: null, counts: null}} */
export function jobsCountsLoadingState() {
  return {
    countErrorMessage: null,
    counts: null
  }
}
