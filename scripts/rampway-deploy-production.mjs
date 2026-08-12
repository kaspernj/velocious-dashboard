#!/usr/bin/env node

import {spawnSync} from "node:child_process"
import {pathToFileURL} from "node:url"

const FULL_GIT_SHA = /^[0-9a-f]{40}$/i

/** @param {string | undefined} revision @returns {string} */
export function assertProductionRevision(revision) {
  if (!revision || !FULL_GIT_SHA.test(revision)) {
    throw new Error("Production deploy requires exactly one full 40-character Git SHA.")
  }

  return revision.toLowerCase()
}

/** @param {string} command @param {string[]} args @returns {void} */
function run(command, args) {
  const result = spawnSync(command, args, {stdio: "inherit"})
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function main() {
  if (process.argv.length !== 3) throw new Error("Usage: npm run deploy:production -- <full-git-sha>")
  const revision = assertProductionRevision(process.argv[2])

  run("git", ["fetch", "origin", "master"])
  run("git", ["cat-file", "-e", `${revision}^{commit}`])
  run("git", ["merge-base", "--is-ancestor", revision, "origin/master"])
  run("rampway", ["production", "deploy", revision, "--config", "rampway.config.mjs", "--transport", "ssh"])
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
