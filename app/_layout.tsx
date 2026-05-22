import "react-native-reanimated"
import "@/src/translations/setup"
import {Stack} from "expo-router"
import {StatusBar} from "expo-status-bar"
import React from "react"
import {SafeAreaProvider} from "react-native-safe-area-context"
import {ConnectionsProvider} from "@/src/connections/use-connections"
import colors from "@/src/theme/colors"

/** Root layout: connections provider + a dark-themed native stack. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConnectionsProvider>
        <Stack
          screenOptions={{
            contentStyle: {backgroundColor: colors.background},
            headerStyle: {backgroundColor: colors.surface},
            headerTintColor: colors.text
          }}
        />
        <StatusBar style="light" />
      </ConnectionsProvider>
    </SafeAreaProvider>
  )
}
