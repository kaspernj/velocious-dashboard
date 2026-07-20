const {mkdtempSync, readFileSync, readdirSync, rmSync, statSync} = require("node:fs")
const {tmpdir} = require("node:os")
const path = require("node:path")
const {spawnSync} = require("node:child_process")

const outputDir = mkdtempSync(path.join(tmpdir(), "velocious-production-export-"))

/** @param {string} directory @returns {string[]} */
function filesBelow(directory) {
  return readdirSync(directory).flatMap((name) => {
    const filename = path.join(directory, name)

    return statSync(filename).isDirectory() ? filesBelow(filename) : [filename]
  })
}

try {
  const env = {...process.env}
  delete env.VELOCIOUS_SYSTEM_TEST_BUILD
  delete env.EXPO_PUBLIC_SYSTEM_TEST
  delete env.EXPO_PUBLIC_SYSTEM_TEST_HOST

  const result = spawnSync("npx", ["expo", "export", "--platform", "web", "--output-dir", outputDir], {
    env,
    stdio: "inherit"
  })

  if (result.status !== 0) process.exit(result.status || 1)

  const forbidden = [
    "connections-hydration-controller",
    "scoundrel-remote-eval",
    "system-testing",
    "velocious-system-test-runtime",
    "VelociousDashboardConnectionsHydration",
    "systemTestScoundrelPort",
    "systemTestingComponent"
  ]
  const emittedText = filesBelow(outputDir)
    .filter((filename) => /\.(?:html|js|json|map)$/.test(filename))
    .map((filename) => readFileSync(filename, "utf8"))
    .join("\n")
  const found = forbidden.filter((marker) => emittedText.includes(marker))

  if (found.length) throw new Error(`Production export contains system-test markers: ${found.join(", ")}`)

  console.log("Production export contains no system-test bridge or hydration-controller markers.")
} finally {
  rmSync(outputDir, {force: true, recursive: true})
}
