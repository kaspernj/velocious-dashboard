// Ambient declarations for dependencies that ship without TypeScript types.
declare module "prop-types-exact"

declare module "velocious-system-test-runtime" {
  import type {ComponentType, ReactNode} from "react"

  const SystemTestRuntime: ComponentType<{children: ReactNode}>
  export default SystemTestRuntime
}
