// https://docs.expo.dev/guides/using-eslint/
const {defineConfig} = require("eslint/config")
// @ts-ignore
const expoConfig = require("eslint-config-expo/flat")

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"]
  },
  {
    files: ["app/**/*.{js,jsx,ts,tsx}", "src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off"
    }
  }
])
