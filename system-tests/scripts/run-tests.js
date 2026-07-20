// @ts-check

import {spawnSync} from "node:child_process"
import path from "node:path"
import {fileURLToPath} from "node:url"

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const result = spawnSync("npx", ["velocious", "test", "--", ...(args.length ? args : ["tests"])], {
  env: {
    ...process.env,
    SYSTEM_TEST_APP_DIR: process.env.SYSTEM_TEST_APP_DIR || path.resolve(currentDir, "../.."),
    SYSTEM_TEST_HOST: process.env.SYSTEM_TEST_HOST || "expo-dev-server"
  },
  stdio: "inherit"
})

process.exit(result.status === null ? 1 : result.status)
