import React, {type ReactNode} from "react"
import {View} from "react-native"
import useSystemTestExpo from "system-testing/build/use-system-test-expo.js"
import "../connections-hydration-controller"

/** Test-build runtime: exposes the browser bridge and hydration controls to system-testing. */
export default function SystemTestRuntime({children}: {children: ReactNode}) {
  useSystemTestExpo({enabled: typeof window !== "undefined"})
  const systemTestingProps = {dataSet: {focussed: "true"}, testID: "systemTestingComponent"} as unknown as React.ComponentProps<typeof View>

  return <View {...systemTestingProps} style={{flex: 1}}>{children}</View>
}
