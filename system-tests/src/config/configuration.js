// @ts-check

import Configuration from "velocious/build/src/configuration.js"
import NodeEnvironmentHandler from "velocious/build/src/environment-handlers/node.js"

const configuration = new Configuration(/** @type {any} */ ({
  database: {
    development: {},
    test: {}
  },
  debug: false,
  environment: "test",
  environmentHandler: new NodeEnvironmentHandler(),
  initializeModels: async () => {},
  locale: () => "en",
  localeFallbacks: {en: ["en"]},
  locales: ["en"],
  testing: `${import.meta.dirname}/testing.js`
}))

configuration.setCurrent()

export default configuration
