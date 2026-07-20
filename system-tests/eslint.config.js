import js from "@eslint/js"
import globals from "globals"

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: {...globals.browser, ...globals.node},
      sourceType: "module"
    }
  }
]
