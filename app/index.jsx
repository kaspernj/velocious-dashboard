// @ts-check

import {ActivityIndicator, Pressable, Text} from "react-native"
import {Link, Stack} from "expo-router"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import _ from "gettext-universal/build/src/translate.js"
import colors from "@/src/theme/colors"
import {memo} from "react"
import propTypesExact from "prop-types-exact"
import Screen from "@/src/components/screen"
import useLocale from "gettext-universal/build/src/use-locale-expo.js"
import {useConnections} from "@/src/connections/use-connections"

/**
 * @import {NamedExoticComponent} from "react"
 * @typedef {import("@/src/connections/use-connections").ConnectionsContextValue} ConnectionsContextValue
 */

/** @typedef {Record<string, never>} ConnectionsScreenProps */
/** @typedef {Record<string, never>} ConnectionsScreenState */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Lists the configured backend connections and links into each one.
 * @extends {ShapeComponent<ConnectionsScreenProps, ConnectionsScreenState>}
 */
class ConnectionsScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  /** @type {ConnectionsContextValue} */
  connections

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
  }

  /** @returns {React.JSX.Element} - Rendered screen. */
  render() {
    const {connections, embedded, loading} = this.connections

    return (
      <Screen testID="connectionsScreen">
        <Stack.Screen options={{title: _("Connections")}} />
        <Text style={styles.heading ||= {color: colors.text, fontSize: 22, fontWeight: "700"}}>
          {_("Velocious dashboard")}
        </Text>
        <Text style={styles.subheading ||= {color: colors.textMuted, fontSize: 14}}>
          {_("Connect to a backend that mounts the background-jobs API.")}
        </Text>
        {loading &&
          <ActivityIndicator color={colors.primary} testID="connectionsLoading" />
        }
        {!loading && connections.length === 0 &&
          <Text style={styles.empty ||= {color: colors.textMuted, fontSize: 15, marginTop: 8}} testID="connectionsEmpty">
            {_("No connections yet. Add one to inspect a backend's jobs.")}
          </Text>
        }
        {connections.map((connection) =>
          <Link asChild href={`/connections/${connection.id}`} key={connection.id}>
            <Pressable
              style={styles.card ||= {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                gap: 4,
                padding: 16
              }}
              testID={`connectionCard-${connection.id}`}
            >
              <Text style={styles.cardTitle ||= {color: colors.text, fontSize: 16, fontWeight: "600"}}>
                {connection.name}
              </Text>
              <Text style={styles.cardSubtitle ||= {color: colors.textMuted, fontSize: 13}}>
                {connection.baseUrl}
              </Text>
            </Pressable>
          </Link>
        )}
        {!embedded &&
          <Link asChild href="/connections/new">
            <Pressable
              style={styles.addButton ||= {
                alignItems: "center",
                backgroundColor: colors.primary,
                borderRadius: 12,
                marginTop: 8,
                padding: 14
              }}
              testID="addConnectionButton"
            >
              <Text style={styles.addButtonText ||= {color: colors.background, fontSize: 15, fontWeight: "700"}}>
                {_("Add connection")}
              </Text>
            </Pressable>
          </Link>
        }
      </Screen>
    )
  }
}

/** @type {NamedExoticComponent<ConnectionsScreenProps>} */
const ConnectionsScreenComponent = memo(shapeComponent(ConnectionsScreen))

export default ConnectionsScreenComponent
