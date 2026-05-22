// @ts-check

import {memo} from "react"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import {Text, View} from "react-native"
import {colorForStatus} from "../theme/colors.js"
import PropTypes from "prop-types"
import propTypesExact from "prop-types-exact"

/** @import {NamedExoticComponent} from "react" */

/**
 * @typedef {object} StatusBadgeProps
 * @property {string} status - Job status to render.
 */

/** @typedef {Record<string, never>} StatusBadgeState */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Colored pill showing a single job status.
 * @extends {ShapeComponent<StatusBadgeProps, StatusBadgeState>}
 */
class StatusBadge extends ShapeComponent {
  static propTypes = propTypesExact({
    status: PropTypes.string.isRequired
  })

  /** @returns {React.JSX.Element} - Rendered badge. */
  render() {
    const status = this.p.status
    const color = colorForStatus(status)

    return (
      <View
        style={styles[`badge-${status}`] ||= {
          alignSelf: "flex-start",
          backgroundColor: `${color}22`,
          borderColor: color,
          borderRadius: 999,
          borderWidth: 1,
          paddingHorizontal: 10,
          paddingVertical: 3
        }}
        testID={`statusBadge-${status}`}
      >
        <Text style={styles[`badgeText-${status}`] ||= {color, fontSize: 12, fontWeight: "600"}}>
          {status}
        </Text>
      </View>
    )
  }
}

/** @type {NamedExoticComponent<StatusBadgeProps>} */
const StatusBadgeComponent = memo(shapeComponent(StatusBadge))

export default StatusBadgeComponent
