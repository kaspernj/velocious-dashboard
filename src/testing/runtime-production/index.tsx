import React, {type ReactNode} from "react"

/** Production runtime: intentionally contains no system-testing imports or activation path. */
export default function SystemTestRuntime({children}: {children: ReactNode}) {
  return <>{children}</>
}
