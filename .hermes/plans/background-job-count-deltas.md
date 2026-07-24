# Live background-job count deltas

## Contract and scope

- Treat `/workspace/framework-reference` (`feat/background-job-count-deltas`,
  PR 957) as authoritative and never modify it.
- Use the mounted jobs API's `GET /api/stats` snapshot. Its payload contains
  `capabilities.backgroundJobCountDeltas === 1`, canonical `counts`, durable
  integer `revision`, legacy `total`, and `generatedAtMs`.
- Subscribe through the framework WebSocket protocol to channel type
  `velocious-background-job-counts`, passing the connection's normalized mount
  as `mountAt` and its bearer token as `authenticationToken`.
- Accept only `background-job-count-delta` bodies with a positive integer
  `revision` and finite, non-zero integer deltas for canonical buckets.
- Keep the existing jobs-list request behavior independent of count updates.

The task text names `/api/counts` and `/ws/counts`, but the supplied exact PR
checkout contains neither route. Its implementation, docs, and tests
consistently specify `/api/stats` plus the normal framework WebSocket channel,
so the dashboard will use that real contract rather than inventing endpoints.

## State machine

1. For a resolved connection, create one bounded reconnecting framework-channel
   client and subscribe before requesting the first snapshot.
2. Buffer only a bounded number of valid delta events until a snapshot lands.
3. Install a snapshot only when it belongs to the current mount/session and is
   not older than the current revision. Preserve its legacy `total`.
4. Discard buffered/live revisions at or below the baseline. Apply a delta only
   when `event.revision === currentRevision + 1`, updating signed canonical
   buckets immediately and clamping rendered counts at zero.
5. Ignore duplicate/old revisions. A forward gap, reconnect/readiness cycle, or
   malformed count payload marks the stream uncertain and requests one
   authoritative snapshot.
6. Coalesce recovery while one request is active. If another recovery reason
   arrives during that request, retain one pending recovery bit and perform at
   most one follow-up snapshot, preventing an event burst from creating
   unbounded requests.
7. Guard every asynchronous completion with a session generation and request
   identity so an old mount, connection, or unmounted screen cannot overwrite
   current state.
8. On teardown, close the subscription, stop reconnect behavior, clear timers
   and bounded buffers, and invalidate pending snapshot completions.

## UI and compatibility

- Show badges for `all`, `queued`, `handed_off`, `completed`, `failed`, and
  `orphaned` in the repository's existing filter order.
- Continue rendering overview cards and legacy `total` from the latest
  authoritative snapshot; deltas update only canonical `counts`.
- Keep manual pull-to-refresh as an explicit authoritative recovery snapshot.
- If the backend does not advertise count deltas, retain bounded legacy stats
  polling for compatibility. Never poll grouped counts after individual delta
  events.

## TDD and verification

1. Add focused coverage for initial snapshot/badges and the exact subscription
   authorization shape.
2. Add coverage for consecutive signed/bulk deltas without refetch, duplicate
   suppression, gap/reconnect coalescing, malformed payload recovery, stale
   snapshots after mount/session changes, bounded buffering/retry, and teardown.
3. Run the focused tests before production changes and record the expected RED.
4. Implement the client/state owner and screen integration, then rerun to GREEN.
5. Update README wording for snapshot-plus-delta behavior.
6. Run focused system coverage, `npm run lint`, `npm run typecheck`,
   `npm run verify:production-test-boundary`, the system-test lint/typecheck,
   and the production build/export gate used by this repository.
7. Review the complete diff, verify generated output is untouched, commit on
   `feat/background-job-count-deltas`, and do not push.
