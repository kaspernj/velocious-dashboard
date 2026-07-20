// @ts-check

import {ActivityIndicator, Text, View} from "react-native"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import _ from "gettext-universal/build/src/translate.js"
import colors from "../theme/colors.js"
import {memo} from "react"
import useLocale from "gettext-universal/build/src/use-locale-expo.js"
import {useConnections} from "../connections/use-connections.jsx"

/**
 * @import {NamedExoticComponent, ReactNode} from "react"
 * @typedef {import("../connections/use-connections.jsx").ConnectionsContextValue} ConnectionsContextValue
 */

/**
 * @typedef {object} HydrationGateProps
 * @property {ReactNode} children - Route content to reveal once hydration resolves.
 */

/** @typedef {Record<string, never>} HydrationGateState */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Holds route content back until persisted connections have hydrated
 * from AsyncStorage. A direct deep link (e.g. `/connections/<id>/jobs`) keeps
 * its URL and shows a loading screen instead of mounting a route that would
 * decide "connection not found", redirect, or fire an API request against the
 * still-empty connection list. Once hydration resolves the stack renders and
 * expo-router resolves the preserved URL to the correct screen.
 * @extends {ShapeComponent<HydrationGateProps, HydrationGateState>}
 */
class HydrationGate extends ShapeComponent {
  /** @type {ConnectionsContextValue} */
  connections

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
  }

  /** @returns {React.JSX.Element} - Loading screen or the gated route content. */
  render() {
    if (this.connections.loading) {
      return (
        <View
          style={styles.loading ||= {alignItems: "center", backgroundColor: colors.background, flex: 1, gap: 12, justifyContent: "center"}}
          testID="hydrationLoading"
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingLabel ||= {color: colors.textMuted, fontSize: 15}} testID="hydrationLoadingLabel">
            {_("Loading connections…")}
          </Text>
        </View>
      )
    }

    return <>{this.p.children}</>
  }
}

/** @type {NamedExoticComponent<HydrationGateProps>} */
const HydrationGateComponent = memo(shapeComponent(HydrationGate))

export default HydrationGateComponent
