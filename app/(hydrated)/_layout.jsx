// @ts-check

import {Stack} from "expo-router"
import HydrationGate from "@/src/components/hydration-gate"
import colors from "@/src/theme/colors"

/** Keeps route content behind hydration while the root navigator stays mounted. */
export default function HydratedLayout() {
  return (
    <HydrationGate>
      <Stack
        screenOptions={{
          contentStyle: {backgroundColor: colors.background},
          headerStyle: {backgroundColor: colors.surface},
          headerTintColor: colors.text
        }}
      />
    </HydrationGate>
  )
}
