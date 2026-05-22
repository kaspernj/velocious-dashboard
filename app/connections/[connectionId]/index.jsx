// @ts-check

import {ActivityIndicator, Pressable, Text, View} from "react-native"
import {Link, Stack, useLocalSearchParams, useRouter} from "expo-router"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import colors, {colorForStatus} from "@/src/theme/colors"
import _ from "gettext-universal/build/src/translate.js"
import JobsClient from "@/src/api/jobs-client"
import {memo} from "react"
import propTypesExact from "prop-types-exact"
import Screen from "@/src/components/screen"
import {stringParam} from "@/src/utils/params"
import useLocale from "gettext-universal/build/src/use-locale-expo.js"
import {useConnections} from "@/src/connections/use-connections"

/**
 * @import {NamedExoticComponent} from "react"
 * @typedef {import("@/src/connections/use-connections").ConnectionsContextValue} ConnectionsContextValue
 * @typedef {import("@/src/connections/connections-store.js").Connection} Connection
 */

/** @typedef {Record<string, never>} OverviewScreenProps */

/**
 * @typedef {object} OverviewScreenState
 * @property {{counts: Record<string, number>, total: number} | null} stats - Latest stats payload.
 * @property {string | null} errorMessage - Last fetch error.
 * @property {boolean} loading - Whether the first load is in progress.
 * @property {boolean} refreshing - Whether a pull-to-refresh is running.
 */

/** @type {Record<string, string>} */
const STATUS_LABELS = {
  completed: "Completed",
  failed: "Failed",
  handed_off: "Running",
  orphaned: "Orphaned",
  queued: "Queued"
}
const POLL_INTERVAL_MS = 4000

/** @type {Record<string, object>} */
const styles = {}

/**
 * Overview of a single backend's job counts. Polls `/api/stats`.
 * @extends {ShapeComponent<OverviewScreenProps, OverviewScreenState>}
 */
class OverviewScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  mounted = true
  requestId = 0

  /** @type {ReturnType<typeof setInterval> | undefined} */
  pollTimer

  /** @type {ConnectionsContextValue} */
  connections

  /** @type {Record<string, string | string[] | undefined>} */
  params

  /** @type {import("expo-router").Router} */
  router

  /** @type {OverviewScreenState} */
  state = {
    errorMessage: null,
    loading: true,
    refreshing: false,
    stats: null
  }

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
    this.params = useLocalSearchParams()
    this.router = useRouter()
  }

  /** @returns {void} */
  componentDidMount() {
    if (!this.tt.connection()) return

    void this.tt.loadStats()
    this.pollTimer = setInterval(() => void this.tt.loadStats(), POLL_INTERVAL_MS)
  }

  /** @returns {void} */
  componentWillUnmount() {
    this.mounted = false

    if (this.pollTimer) clearInterval(this.pollTimer)
  }

  /** @returns {React.JSX.Element} - Rendered overview. */
  render() {
    const connection = this.tt.connection()
    const {errorMessage, loading, refreshing, stats} = this.s

    if (!connection) {
      return (
        <Screen testID="overviewScreen">
          <Stack.Screen options={{title: _("Overview")}} />
          <Text style={styles.notFound ||= {color: colors.textMuted, fontSize: 15}} testID="overviewNotFound">
            {_("Connection not found.")}
          </Text>
          <Link href="/" style={styles.backLink ||= {color: colors.primary, fontSize: 15}} testID="overviewBackLink">
            {_("Back to connections")}
          </Link>
        </Screen>
      )
    }

    const connectionId = connection.id

    return (
      <Screen onRefresh={this.tt.onRefreshPress} refreshing={refreshing} testID="overviewScreen">
        <Stack.Screen options={{title: connection.name}} />
        <Text style={styles.url ||= {color: colors.textMuted, fontSize: 13}}>
          {connection.baseUrl}
        </Text>
        {loading &&
          <ActivityIndicator color={colors.primary} testID="overviewLoading" />
        }
        {errorMessage &&
          <Text style={styles.error ||= {color: colors.danger, fontSize: 14}} testID="overviewError">
            {errorMessage}
          </Text>
        }
        {stats &&
          <View style={styles.cards ||= {flexDirection: "row", flexWrap: "wrap", gap: 12}}>
            {Object.keys(STATUS_LABELS).map((status) =>
              <Link
                asChild
                href={`/connections/${connectionId}/jobs?status=${status}`}
                key={status}
              >
                <Pressable
                  style={styles[`statCard-${status}`] ||= {
                    backgroundColor: colors.surface,
                    borderColor: colorForStatus(status),
                    borderLeftWidth: 4,
                    borderRadius: 12,
                    flexGrow: 1,
                    gap: 4,
                    minWidth: 140,
                    padding: 16
                  }}
                  testID={`statCard-${status}`}
                >
                  <Text style={styles.statCount ||= {color: colors.text, fontSize: 26, fontWeight: "700"}}>
                    {stats.counts[status] ?? 0}
                  </Text>
                  <Text style={styles.statLabel ||= {color: colors.textMuted, fontSize: 13}}>
                    {_(STATUS_LABELS[status])}
                  </Text>
                </Pressable>
              </Link>
            )}
          </View>
        }
        {stats &&
          <Text style={styles.total ||= {color: colors.textMuted, fontSize: 14}} testID="overviewTotal">
            {_("Total jobs")}: {stats.total}
          </Text>
        }
        <Link
          asChild
          href={`/connections/${connectionId}/jobs`}
        >
          <Pressable style={styles.allJobs ||= {alignItems: "center", borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginTop: 4, padding: 14}} testID="overviewAllJobsButton">
            <Text style={styles.allJobsText ||= {color: colors.primary, fontSize: 15, fontWeight: "600"}}>
              {_("View all jobs")}
            </Text>
          </Pressable>
        </Link>
        {!this.connections.embedded &&
          <Pressable onPress={this.tt.onRemovePress} style={styles.remove ||= {alignItems: "center", marginTop: 4, padding: 12}} testID="overviewRemoveButton">
            <Text style={styles.removeText ||= {color: colors.danger, fontSize: 14}}>
              {_("Remove connection")}
            </Text>
          </Pressable>
        }
      </Screen>
    )
  }

  /** @returns {Connection | undefined} - The connection for this route. */
  connection() {
    const connectionId = stringParam(this.params.connectionId)

    return connectionId ? this.connections.getConnection(connectionId) : undefined
  }

  /** @returns {Promise<void>} - Loads the latest stats. */
  async loadStats() {
    const connection = this.tt.connection()

    // Expected when the connection was removed while this screen is open; the
    // render path shows a "not found" state.
    if (!connection) return

    const requestId = ++this.requestId
    const client = new JobsClient(connection)

    try {
      const stats = await client.stats()

      if (!this.mounted || requestId !== this.requestId) return

      this.setState({errorMessage: null, loading: false, stats})
    } catch (error) {
      if (!this.mounted || requestId !== this.requestId) return

      this.setState({errorMessage: error instanceof Error ? error.message : String(error), loading: false})
    }
  }

  /** @returns {Promise<void>} - Manual pull-to-refresh. */
  async onRefreshPress() {
    this.setState({refreshing: true})

    try {
      await this.tt.loadStats()
    } finally {
      if (this.mounted) this.setState({refreshing: false})
    }
  }

  /** @returns {Promise<void>} - Removes this connection and returns to the list. */
  async onRemovePress() {
    const connection = this.tt.connection()

    if (!connection) return

    await this.connections.removeConnection(connection.id)
    this.router.replace("/")
  }
}

/** @type {NamedExoticComponent<OverviewScreenProps>} */
const OverviewScreenComponent = memo(shapeComponent(OverviewScreen))

export default OverviewScreenComponent
