// @ts-check

import assert from "node:assert/strict"
import {describe, it} from "node:test"
import config from "../rampway.config.mjs"
import {assertProductionRevision} from "../scripts/rampway-deploy-production.mjs"

const FULL_SHA = "a56eef4823cec39df3e2840682f548777f3dcf7a"

describe("Rampway production deployment", () => {
  it("targets the host deployment root and publishes the nginx static layout", () => {
    const production = config.stages.production

    assert.equal(production.repo, "https://github.com/kaspernj/velocious-dashboard.git")
    assert.equal(production.branch, "master")
    assert.equal(production.deployTo, "/root/docker/velocious-dashboard-production/homedev/velocious-dashboard")
    assert.equal(production.strategy, "remote-git")
    assert.deepEqual(production.transport, {type: "ssh"})
    assert.deepEqual(production.hosts, [{host: "server3.diestoeckels.de", port: 22, user: "root"}])
    assert.deepEqual(production.runtime, {type: "none"})
    assert.deepEqual(production.linkedFiles, [])
    assert.deepEqual(production.linkedDirs, [])

    assert.deepEqual(production.tasks.install, [{command: "npm ci"}])
    assert.deepEqual(production.tasks.verify, [
      {command: "npm run all-checks"},
      {command: "npm run test:unit"},
      {command: "npm run verify:production-test-boundary"}
    ])
    assert.deepEqual(production.tasks.build, [
      {command: "npx expo export --platform web --output-dir app/dist"},
      {command: "test -f \"app/dist/index.html\""}
    ])
  })

  it("requires an explicit full Git SHA for production deploys", () => {
    assert.equal(assertProductionRevision(FULL_SHA), FULL_SHA)
    assert.throws(() => assertProductionRevision(), /full 40-character Git SHA/)
    assert.throws(() => assertProductionRevision("master"), /full 40-character Git SHA/)
    assert.throws(() => assertProductionRevision(FULL_SHA.slice(0, 12)), /full 40-character Git SHA/)
  })
})
