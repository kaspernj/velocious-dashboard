import "react-native-reanimated"
import "@/src/translations/setup"
import {Stack} from "expo-router"
import {StatusBar} from "expo-status-bar"
import React from "react"
import {SafeAreaProvider} from "react-native-safe-area-context"
import {ConnectionsProvider} from "@/src/connections/use-connections"
import colors from "@/src/theme/colors"
import HydrationGate from "@/src/components/hydration-gate"
// Resolved by Metro to a production or explicitly test-only implementation.
// eslint-disable-next-line import/no-unresolved
import SystemTestRuntime from "velocious-system-test-runtime"

/** Root layout: connections provider + a dark-themed native stack. */
export default function RootLayout() {
  return (
    <SystemTestRuntime>
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
    </SystemTestRuntime>
  )
}
