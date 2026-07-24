// @ts-check

import {ActivityIndicator, Pressable, Text, View} from "react-native"
import {Link, Stack, useLocalSearchParams, useRouter} from "expo-router"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import colors, {colorForStatus} from "@/src/theme/colors"
import _ from "gettext-universal/build/src/translate.js"
import JobsClient from "@/src/api/jobs-client"
import JobCountsSession from "@/src/background-jobs/job-counts-session.mjs"
import {overviewCountsLoadingState} from "@/src/background-jobs/connection-count-state.mjs"
import {memo, useEffect} from "react"
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
 * @property {{counts: Record<string, number>, revision: number, total: number} | null} stats - Latest stats payload.
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
/** @type {Record<string, object>} */
const styles = {}

/**
 * Overview of a single backend's revisioned job counts.
 * @extends {ShapeComponent<OverviewScreenProps, OverviewScreenState>}
 */
class OverviewScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  mounted = true

  /** @type {JobCountsSession | null} */
  countsSession = null
  sessionGeneration = 0

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

    const connection = this.tt.connection()

    useEffect(() => {
      if (!connection) return

      const session = this.tt.startCountsSession(connection)

      return () => void this.tt.stopCountsSession(session)
    }, [connection])
  }

  /** @returns {void} */
  componentWillUnmount() {
    this.mounted = false
    this.sessionGeneration += 1
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
        <Link
          asChild
          href={`/connections/${connectionId}/jobs?status=handed_off`}
        >
          <Pressable style={styles.runningJobs ||= {alignItems: "center", borderColor: colors.border, borderRadius: 12, borderWidth: 1, marginTop: 4, padding: 14}} testID="overviewRunningJobsButton">
            <Text style={styles.runningJobsText ||= {color: colors.primary, fontSize: 15, fontWeight: "600"}}>
              {_("Running jobs")}
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

  /** @param {Connection} connection @returns {JobCountsSession} - Starts this mount's live count session. */
  startCountsSession(connection) {
    const generation = ++this.sessionGeneration
    const client = new JobsClient(connection)

    this.setState(overviewCountsLoadingState())
    const session = new JobCountsSession({
      connection,
      loadSnapshot: async () => await client.stats(),
      onChange: (stats) => {
        if (!this.mounted || generation !== this.sessionGeneration) return

        this.setState({errorMessage: null, loading: false, stats})
      },
      onError: (error) => {
        if (!this.mounted || generation !== this.sessionGeneration) return

        this.setState({errorMessage: error.message, loading: false})
      }
    })

    this.countsSession = session
    void session.start().catch((error) => {
      if (!this.mounted || generation !== this.sessionGeneration) return
      this.setState({errorMessage: error instanceof Error ? error.message : String(error), loading: false})
    })

    return session
  }

  /** @param {JobCountsSession} session @returns {Promise<void>} - Stops a superseded mount session. */
  async stopCountsSession(session) {
    if (this.countsSession === session) {
      this.sessionGeneration += 1
      this.countsSession = null
    }

    await session.dispose()
  }

  /** @type {() => Promise<void>} - Manual pull-to-refresh. */
  onRefreshPress = async () => {
    this.setState({refreshing: true})

    try {
      await this.countsSession?.refresh()
    } finally {
      if (this.mounted) this.setState({refreshing: false})
    }
  }

  /** @type {() => Promise<void>} - Removes this connection and returns to the list. */
  onRemovePress = async () => {
    const connection = this.tt.connection()

    if (!connection) return

    await this.connections.removeConnection(connection.id)
    this.router.replace("/")
  }
}

/** @type {NamedExoticComponent<OverviewScreenProps>} */
const OverviewScreenComponent = memo(shapeComponent(OverviewScreen))

export default OverviewScreenComponent
