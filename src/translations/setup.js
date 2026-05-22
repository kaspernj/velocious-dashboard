// @ts-check

import config from "gettext-universal/build/src/config.js"

// No translation catalogs are bundled yet — source strings are English. Setting
// a locale and fallback keeps gettext-universal from throwing when translate()
// runs (including during static web prerendering).
config.setLocale("en")
config.setFallbacks(["en"])
