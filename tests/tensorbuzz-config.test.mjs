// @ts-check

import assert from "node:assert/strict"
import {readFile} from "node:fs/promises"
import {describe, it} from "node:test"

const CONFIG_PATH = new URL("../tensorbuzz.yml", import.meta.url)

/**
 * Read the top-level ordered path rules from the repository TensorBuzz config.
 * This intentionally keeps the test independent of a YAML package because the
 * project config has no runtime YAML dependency.
 *
 * @returns {Promise<string[]>}
 */
async function readPathRules() {
  const config = await readFile(CONFIG_PATH, "utf8")
  const lines = config.split("\n")
  const pathsIndex = lines.findIndex((line) => line === "paths:")
  assert.notEqual(pathsIndex, -1, "tensorbuzz.yml must define top-level paths")

  return lines.slice(pathsIndex + 1).flatMap((line) => {
    const match = line.match(/^  - "(.+)"$/)
    return match ? [match[1]] : []
  })
}

/**
 * Exercise the ordered glob contract for the small rule set in this config.
 * `**` is the only positive recursive rule needed here; the test focuses on
 * the ordering and re-inclusion semantics that TensorBuzz applies.
 *
 * @param {string[]} rules
 * @param {string} path
 */
function includedByRules(rules, path) {
  let included = false

  for (const rule of rules) {
    const negated = rule.startsWith("!")
    const pattern = negated ? rule.slice(1) : rule
    const matches = pattern === "**"
      || (pattern.endsWith("/**") && path.startsWith(pattern.slice(0, -2)))
      || pattern === path

    if (matches) included = !negated
  }

  return included
}

describe("TensorBuzz path filtering", () => {
  it("keeps the build broad for source and root configuration changes", async () => {
    const rules = await readPathRules()

    assert.deepEqual(rules, [
      "**",
      "!docs/**",
      "!README.md",
      "!system-tests/**",
      "system-tests/package.json",
      "system-tests/package-lock.json"
    ])
    assert.equal(includedByRules(rules, "src/api/jobs-client.js"), true)
    assert.equal(includedByRules(rules, "package-lock.json"), true)
    assert.equal(includedByRules(rules, "tensorbuzz.yml"), true)
  })

  it("skips unrelated documentation while re-including system-test manifests", async () => {
    const rules = await readPathRules()

    assert.equal(includedByRules(rules, "docs/deployment.md"), false)
    assert.equal(includedByRules(rules, "README.md"), false)
    assert.equal(includedByRules(rules, "system-tests/tests/live-job-counts-system-spec.js"), false)
    assert.equal(includedByRules(rules, "system-tests/package.json"), true)
    assert.equal(includedByRules(rules, "system-tests/package-lock.json"), true)
  })
})
