import "react-native-reanimated"
import "@/src/translations/setup"
import {Stack} from "expo-router"
import {StatusBar} from "expo-status-bar"
import React from "react"
import {View} from "react-native"
import {SafeAreaProvider} from "react-native-safe-area-context"
import useSystemTestExpo from "system-testing/build/use-system-test-expo.js"
import "@/src/testing/connections-hydration-controller"
import {ConnectionsProvider} from "@/src/connections/use-connections"
import colors from "@/src/theme/colors"
import HydrationGate from "@/src/components/hydration-gate"

/** Root layout: connections provider + a dark-themed native stack. */
export default function RootLayout() {
  useSystemTestExpo()
  const systemTestingProps = {dataSet: {focussed: "true"}, testID: "systemTestingComponent"} as unknown as React.ComponentProps<typeof View>

  return (
    <View
      {...systemTestingProps}
      style={{flex: 1}}
    >
      <SafeAreaProvider>
        <ConnectionsProvider>
          <HydrationGate>
            <Stack
              screenOptions={{
                contentStyle: {backgroundColor: colors.background},
                headerStyle: {backgroundColor: colors.surface},
                headerTintColor: colors.text
              }}
            />
          </HydrationGate>
          <StatusBar style="light" />
        </ConnectionsProvider>
      </SafeAreaProvider>
    </View>
  )
}
