// @ts-check

import {memo} from "react"
import {RefreshControl, ScrollView, View} from "react-native"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import {SafeAreaView} from "react-native-safe-area-context"
import colors from "../theme/colors.js"
import PropTypes from "prop-types"
import propTypesExact from "prop-types-exact"

/**
 * @import {NamedExoticComponent, ReactNode} from "react"
 */

/**
 * @typedef {object} ScreenProps
 * @property {ReactNode} children - Screen content.
 * @property {boolean} [refreshing] - Whether a pull-to-refresh is in progress.
 * @property {() => void} [onRefresh] - Pull-to-refresh handler. Enables the control when set.
 * @property {string} [testID] - Test id for the scroll container.
 */

/** @typedef {Record<string, never>} ScreenState */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Standard screen layout: safe-area background plus a centered, max-width
 * scroll container with consistent padding.
 * @extends {ShapeComponent<ScreenProps, ScreenState>}
 */
class Screen extends ShapeComponent {
  static defaultProps = {
    refreshing: false
  }

  static propTypes = propTypesExact({
    children: PropTypes.node,
    onRefresh: PropTypes.func,
    refreshing: PropTypes.bool,
    testID: PropTypes.string
  })

  /** @returns {React.JSX.Element} - Rendered screen. */
  render() {
    const {children, onRefresh, refreshing, testID} = this.p

    return (
      <SafeAreaView style={styles.safeArea ||= {backgroundColor: colors.background, flex: 1}}>
        <ScrollView
          contentContainerStyle={styles.scrollContent ||= {padding: 16}}
          refreshControl={onRefresh ?
            <RefreshControl onRefresh={onRefresh} refreshing={Boolean(refreshing)} tintColor={colors.primary} />
            :
            undefined
          }
          style={styles.scroll ||= {flex: 1}}
          testID={testID}
        >
          <View style={styles.inner ||= {alignSelf: "center", gap: 14, maxWidth: 900, width: "100%"}}>
            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }
}

/** @type {NamedExoticComponent<ScreenProps>} */
const ScreenComponent = memo(shapeComponent(Screen))

export default ScreenComponent
