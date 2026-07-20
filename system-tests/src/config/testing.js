// @ts-check

import {afterAll, beforeAll} from "velocious/build/src/testing/test.js"
import {spawn} from "node:child_process"
import SystemTest from "system-testing/build/system-test.js"
import waitFor from "awaitery/build/wait-for.js"

/** @type {import("node:child_process").ChildProcess | null} */
let appProcess = null

/** @returns {Promise<void>} */
async function startApp() {
  const appDir = process.env.SYSTEM_TEST_APP_DIR || process.cwd()

  appProcess = spawn("npx", ["expo", "start", "--port", "4593"], {
    cwd: appDir,
    env: process.env,
    stdio: "inherit"
  })

  await waitFor({timeout: 30_000}, async () => {
    const response = await fetch("http://localhost:4593")

    if (!response.ok) throw new Error(`Expo responded with ${response.status}.`)
  })
}

export default async () => {
  beforeAll(async () => {
    await startApp()

    SystemTest.rootPath = "/blank"
    const systemTest = SystemTest.current({
      clientWsPort: 22985,
      host: "localhost",
      port: 4593,
      scoundrelPort: 8191,
      urlArgs: {systemTest: "true"}
    })

    if (!systemTest.isStarted()) await systemTest.start()
  })

  afterAll(async () => {
    const systemTest = SystemTest.current()

    if (systemTest.isStarted()) await systemTest.stop()

    appProcess?.kill("SIGTERM")
    appProcess = null
  })
}
