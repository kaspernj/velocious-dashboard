# Production deployment with Rampway

This project deploys its static Expo web export with Rampway 0.5.4. It does not
use Capistrano or Ruby. Rampway connects to `server3.diestoeckels.de` as `root` over SSH port 22
and uses a remote Git checkout from the `master` branch of
`https://github.com/kaspernj/velocious-dashboard.git`.

The host deployment root is
`/root/docker/velocious-dashboard-production/homedev/velocious-dashboard`.
Each immutable release is stored below `releases/<timestamp>-<sha>`. On normal
deploy and rollback, Rampway atomically publishes `current` as a relative
symlink to `releases/<release-id>`. The relative target remains valid when the
deployment tree is exposed to the static-site container through its existing
bind mount. The Expo export is deliberately written to `app/dist` inside the
release, so the published host path is `current/app/dist`. Production Nginx
continues to serve the corresponding in-container path
`/home/dev/velocious-dashboard/current/app/dist` through that mount.

Rampway uses the existing local SSH agent and SSH configuration. The project
configuration contains only the SSH host, user, and port; it contains no keys,
tokens, passwords, or other secrets. Node 22 or newer is required by Rampway.

## Validate and review a release

Install exactly the locked dependencies and validate the configuration:

```bash
npm ci
npm run deploy:validate
```

A production release must be a full 40-character Git SHA that is already on
`origin/master`. First review Rampway's non-mutating structural plan for that
exact revision:

```bash
REVISION=<approved-full-40-character-git-sha>
npm run deploy:plan -- "$REVISION"
```

Rampway 0.5.4 supports one positional revision for `plan`. npm's `--` forwards
the full SHA to that structural command; `deploy:plan` never invokes `deploy`
and makes no remote or filesystem changes. The plan must report the full SHA
and show the `remote-git` checkout, locked `npm ci`, all checks, unit tests,
production test-boundary validation, Expo web export to `app/dist`, the Rampway
Expo artifact check, the static entrypoint health check, and no runtime handoff.
None of these build checks is change-gated.

## First rollout

Before the first rollout, confirm all prerequisites with read-only checks:

- `server3.diestoeckels.de` resolves and accepts the existing SSH-agent/config credentials for
  `root` on port 22.
- Remote `node --version` is at least 22, and `npm --version` and
  `git --version` succeed.
- The deployment root exists and is writable by the SSH user.
- The server can run `git ls-remote` against the configured HTTPS repository.
- The structural plan names the approved full SHA and the expected host
  deployment root.

Deploy only with the guarded script and npm's explicit `--` argument
forwarding:

```bash
REVISION=<approved-full-40-character-git-sha>
npm run deploy:production -- "$REVISION"
```

The guard fetches `origin/master`, rejects anything except one full Git SHA,
verifies the commit exists locally and is an ancestor of the fetched approved
branch, and only then passes that SHA as the positional revision supported by
Rampway's actual `deploy` command over SSH. It never deploys uncommitted files
or an arbitrary local `HEAD`. This guarded operation is separate from
`deploy:plan`; it is an actual deployment and has no dry-run mode in this
project wrapper.

Do not make any Nginx, Docker, mount, or server release-tree configuration
changes during rollout. The existing legacy releases coexist in the same
`releases` directory. Rampway can report and target safe retained legacy
releases, but its cleanup only removes releases carrying matching Rampway
ownership metadata.

## Smoke checks and reports

After Rampway succeeds, confirm the release before considering the rollout
complete:

```bash
npm run deploy:status
npm run deploy:releases
ssh root@server3.diestoeckels.de 'readlink /root/docker/velocious-dashboard-production/homedev/velocious-dashboard/current'
curl --fail --silent --show-error "$PRODUCTION_DASHBOARD_URL" >/dev/null
```

Also load the production dashboard in a browser, confirm its static assets load
without 404 responses, add or open a connection, and verify that the overview
and job list render. Use the actual production dashboard URL if it differs from
the example above.

Rampway appends successful deploy and rollback reports on the server at
`shared/log/rampway-deployments.jsonl`. Its local deploy transcript path is
printed when deployment begins. `deploy:status` shows the current release and
deployment paths; `deploy:releases` lists retained releases.

## Recovery and rollback

If deployment fails before publishing `current`, leave the existing symlink in
place, inspect the emitted error and deploy transcript, correct the cause, and
rerun the same approved SHA. If smoke checks fail after publication, inspect
status and retained releases before rolling back:

```bash
npm run deploy:status
npm run deploy:releases
npm run deploy:rollback
```

To choose an exact retained release instead of the previous one:

```bash
npm run deploy:rollback -- --to <exact-release-id>
```

Rollback uses Rampway's deployment lock and atomically republishes `current`;
with `runtime: none`, it performs no process handoff. After rollback, repeat the
status, symlink, HTTP, asset, and browser smoke checks. Never repair a failed
rollout by manually rewriting `current` or deleting legacy releases unless a
separately reviewed recovery procedure explicitly requires it.
