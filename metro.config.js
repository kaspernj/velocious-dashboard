const {getDefaultConfig} = require("expo/metro-config")
const path = require("node:path")

const config = getDefaultConfig(__dirname)
const runtimeVariant = process.env.VELOCIOUS_SYSTEM_TEST_BUILD === "true" ? "test-only" : "production"
const runtimeFile = path.resolve(__dirname, `src/testing/runtime-${runtimeVariant}/index.tsx`)

/** @param {string} filePath @returns {boolean} - Whether production must reject this resolved test-only source. */
function isProductionTestOnlyFile(filePath) {
  const normalizedPath = path.normalize(filePath)

  return [
    `${path.sep}node_modules${path.sep}system-testing${path.sep}`,
    `${path.sep}node_modules${path.sep}scoundrel-remote-eval${path.sep}`,
    `${path.sep}src${path.sep}testing${path.sep}runtime-test-only${path.sep}`,
    `${path.sep}src${path.sep}testing${path.sep}connections-hydration-controller.`
  ].some((segment) => normalizedPath.includes(segment))
}

// Select the remote-eval adapter while constructing a dedicated test bundle.
// This is deliberately not an EXPO_PUBLIC_* variable and cannot be set by a URL.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "velocious-system-test-runtime") {
    return {filePath: runtimeFile, type: "sourceFile"}
  }

  const resolution = context.resolveRequest(context, moduleName, platform)

  if (runtimeVariant === "production" && resolution.type === "sourceFile" && isProductionTestOnlyFile(resolution.filePath)) {
    throw new Error(`Production bundle attempted to resolve test-only module: ${moduleName}`)
  }

  return resolution
}

module.exports = config
