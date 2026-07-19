// @ts-check

import {ActivityIndicator, Pressable, Text, View} from "react-native"
import {Link, Stack, useLocalSearchParams} from "expo-router"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import _ from "gettext-universal/build/src/translate.js"
import colors from "@/src/theme/colors"
import {formatRelative, formatTimestamp} from "@/src/utils/format-time"
import {memo, useEffect} from "react"
import propTypesExact from "prop-types-exact"
import RunningBuildsClient, {RunningBuildsClientError} from "@/src/api/running-builds-client"
import Screen from "@/src/components/screen"
import StatusBadge from "@/src/components/status-badge"
import {stringParam} from "@/src/utils/params"
import useLocale from "gettext-universal/build/src/use-locale-expo.js"
import {useConnections} from "@/src/connections/use-connections"

/**
 * @import {NamedExoticComponent} from "react"
 * @typedef {import("@/src/connections/use-connections").ConnectionsContextValue} ConnectionsContextValue
 * @typedef {import("@/src/connections/connections-store.js").Connection} Connection
 * @typedef {import("@/src/api/running-builds-client.js").RunningBuild} RunningBuild
 */

/** @typedef {Record<string, never>} RunningBuildsScreenProps */

/**
 * @typedef {object} RunningBuildsScreenState
 * @property {RunningBuild[]} builds - Active builds in backend order.
 * @property {string | null} errorMessage - Last fetch error.
 * @property {boolean} loading - Whether the initial request is running.
 * @property {number | null} refreshedAtMs - Most recent successful local refresh.
 * @property {boolean} refreshing - Whether a manual refresh is running.
 * @property {boolean} unsupported - Whether the backend lacks this endpoint.
 * @property {number} nowMs - Clock used for live elapsed labels.
 */

const POLL_INTERVAL_MS = 5000
const CLOCK_INTERVAL_MS = 1000

/** @type {Record<string, object>} */
const styles = {}

/**
 * Live operational view of assigned and running TensorBuzz builds.
 * @extends {ShapeComponent<RunningBuildsScreenProps, RunningBuildsScreenState>}
 */
class RunningBuildsScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  mounted = true
  requestId = 0

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  pollTimer = undefined

  /** @type {Promise<void> | undefined} */
  requestPromise = undefined

  /** @type {ConnectionsContextValue} */
  connections

  /** @type {Record<string, string | string[] | undefined>} */
  params

  /** @type {RunningBuildsScreenState} */
  state = {
    builds: [],
    errorMessage: null,
    loading: true,
    nowMs: Date.now(),
    refreshedAtMs: null,
    refreshing: false,
    unsupported: false
  }

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
    this.params = useLocalSearchParams()

    const connectionId = stringParam(this.params.connectionId)
    const connectionsLoading = this.connections.loading
    const routeConnection = this.tt.connection()

    useEffect(() => {
      if (connectionsLoading) return

      this.requestId += 1
      this.requestPromise = undefined
      this.setState({builds: [], errorMessage: null, loading: true, refreshedAtMs: null, unsupported: false})

      if (routeConnection) void this.tt.loadBuilds()

      return () => {
        this.requestId += 1
        this.requestPromise = undefined
        if (this.pollTimer) clearTimeout(this.pollTimer)
      }
    }, [connectionId, connectionsLoading, routeConnection])

    useEffect(() => {
      const clockTimer = setInterval(() => this.setState({nowMs: Date.now()}), CLOCK_INTERVAL_MS)

      return () => clearInterval(clockTimer)
    }, [])
  }

  /** @returns {void} */
  componentWillUnmount() {
    this.mounted = false
    this.requestId += 1

    if (this.pollTimer) clearTimeout(this.pollTimer)
  }

  /** @returns {React.JSX.Element} - Rendered running-build list. */
  render() {
    const connection = this.tt.connection()

    if (!connection) {
      return (
        <Screen testID="runningBuildsScreen">
          <Stack.Screen options={{title: _("Running builds")}} />
          {this.connections.loading ?
            <ActivityIndicator color={colors.primary} testID="runningBuildsLoading" />
            :
            <Text style={styles.notFound ||= {color: colors.textMuted, fontSize: 15}} testID="runningBuildsNotFound">
              {_("Connection not found.")}
            </Text>
          }
        </Screen>
      )
    }

    const {builds, errorMessage, loading, nowMs, refreshedAtMs, refreshing, unsupported} = this.s

    return (
      <Screen
        onRefresh={this.tt.onRefreshPress}
        refreshing={refreshing}
        testID="runningBuildsScreen"
      >
        <Stack.Screen options={{title: _("Running builds")}} />
        <View style={styles.summary ||= {alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between"}}>
          <View style={styles.summaryText ||= {flex: 1, gap: 3}}>
            <Text style={styles.count ||= {color: colors.text, fontSize: 18, fontWeight: "700"}} testID="runningBuildsCount">
              {_("Active builds")}: {builds.length}
            </Text>
            <Text style={styles.refreshed ||= {color: colors.textMuted, fontSize: 12}} testID="runningBuildsLastRefresh">
              {_("Last refresh")}: {refreshedAtMs ? formatTimestamp(refreshedAtMs) : "—"}
            </Text>
          </View>
          <Pressable
            disabled={refreshing}
            onPress={this.tt.onRefreshPress}
            style={styles.refresh ||= {borderColor: colors.border, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8}}
            testID="runningBuildsRefresh"
          >
            <Text style={styles.refreshText ||= {color: colors.primary, fontSize: 13, fontWeight: "600"}}>
              {refreshing ? _("Refreshing…") : _("Refresh")}
            </Text>
          </Pressable>
        </View>
        {loading &&
          <ActivityIndicator color={colors.primary} testID="runningBuildsLoading" />
        }
        {!loading && unsupported &&
          <View style={styles.unsupportedMessage ||= {gap: 10}} testID="runningBuildsUnsupported">
            <Text style={styles.unsupportedText ||= {color: colors.danger, fontSize: 14}}>
              {_("Running builds are not supported by this backend.")}
            </Text>
            {this.tt.retryButton()}
          </View>
        }
        {!loading && errorMessage && !unsupported &&
          <View style={styles.errorMessageContainer ||= {gap: 10}} testID="runningBuildsError">
            <Text style={styles.errorText ||= {color: colors.danger, fontSize: 14}}>
              {errorMessage}
            </Text>
            {this.tt.retryButton()}
          </View>
        }
        {!loading && !errorMessage && !unsupported && builds.length === 0 &&
          <Text style={styles.empty ||= {color: colors.textMuted, fontSize: 15}} testID="runningBuildsEmpty">
            {_("No builds are currently assigned or running.")}
          </Text>
        }
        {builds.map((build, index) => this.tt.renderBuild(build, index, connection, nowMs))}
      </Screen>
    )
  }

  /** @returns {Connection | undefined} - The connection for this route. */
  connection() {
    const connectionId = stringParam(this.params.connectionId)

    return connectionId ? this.connections.getConnection(connectionId) : undefined
  }

  /** @returns {Promise<void>} - Loads active builds without overlapping requests. */
  async loadBuilds() {
    if (this.requestPromise) return await this.requestPromise

    const connection = this.tt.connection()

    if (!connection) return

    const requestId = ++this.requestId
    const client = new RunningBuildsClient(connection)
    const request = this.tt.performLoad({client, requestId})

    this.requestPromise = request

    try {
      await request
    } finally {
      if (this.requestPromise === request) this.requestPromise = undefined
    }
  }

  /**
   * @param {{client: RunningBuildsClient, requestId: number}} args - Request context.
   * @returns {Promise<void>} - Performs and applies a request.
   */
  async performLoad({client, requestId}) {
    let shouldPoll = true

    try {
      const result = await client.runningBuilds()

      if (!this.mounted || requestId !== this.requestId) return

      this.setState({builds: result.builds, errorMessage: null, loading: false, refreshedAtMs: Date.now(), unsupported: false})
    } catch (error) {
      if (!this.mounted || requestId !== this.requestId) return

      const unsupported = error instanceof RunningBuildsClientError && error.status === 404

      shouldPoll = !unsupported

      if (unsupported && this.pollTimer) {
        clearTimeout(this.pollTimer)
        this.pollTimer = undefined
      }

      this.setState({builds: [], errorMessage: unsupported ? null : error instanceof Error ? error.message : String(error), loading: false, unsupported})
    } finally {
      if (shouldPoll && this.mounted && requestId === this.requestId) this.tt.schedulePoll()
    }
  }

  /** @returns {void} - Schedules the next poll after the current request. */
  schedulePoll() {
    if (this.pollTimer) clearTimeout(this.pollTimer)
    this.pollTimer = setTimeout(() => void this.tt.loadBuilds(), POLL_INTERVAL_MS)
  }

  /** @type {() => Promise<void>} - Pull-to-refresh handler. */
  onRefreshPress = async () => {
    this.setState({refreshing: true})

    try {
      await this.tt.loadBuilds()
    } finally {
      if (this.mounted) this.setState({refreshing: false})
    }
  }

  /** @type {() => void} - Retry handler. */
  onRetryPress = () => {
    this.setState({loading: true})
    void this.tt.loadBuilds()
  }

  /** @returns {React.JSX.Element} - Reusable retry control. */
  retryButton() {
    return (
      <Pressable
        onPress={this.tt.onRetryPress}
        style={styles.retry ||= {alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1, padding: 10}}
        testID="runningBuildsRetry"
      >
        <Text style={styles.retryText ||= {color: colors.primary, fontSize: 14, fontWeight: "600"}}>
          {_("Retry")}
        </Text>
      </Pressable>
    )
  }

  /**
   * @param {RunningBuild} build - Active build.
   * @param {number} index - API-order index.
   * @param {Connection} connection - Owning connection.
   * @param {number} nowMs - Current display clock.
   * @returns {React.JSX.Element} - Operational build card.
   */
  renderBuild(build, index, connection, nowMs) {
    const detailPath = build.detailPath
    const projectLabel = build.project ? `${build.project.name} (${build.project.slug})` : _("Unknown project")
    const serverLabel = build.dockerServer?.name || _("Unassigned server")
    const elapsedStartedAt = build.createdAtMs === null ? null : nowMs - Math.max(0, nowMs - build.createdAtMs)

    return (
      <View
        key={build.buildId}
        style={styles.buildCard ||= {backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 8, padding: 14}}
        testID={`runningBuildCard-${build.buildId}`}
      >
        <View style={styles.cardTop ||= {alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between"}}>
          <Text style={styles.project ||= {color: colors.text, flex: 1, fontSize: 16, fontWeight: "700"}}>
            {projectLabel}
          </Text>
          <StatusBadge status={build.status} />
        </View>
        <Text style={styles.branch ||= {color: colors.text, fontSize: 14}}>
          {_("Branch")}: {build.branchName}
        </Text>
        <Text style={styles.statusMeta ||= {color: colors.textMuted, fontSize: 13}}>
          {build.status === "assigned" ? _("Assigned / starting") : _("Running")} · {_("Elapsed")} {formatRelative(elapsedStartedAt)}
        </Text>
        <Text style={styles.serverMeta ||= {color: colors.textMuted, fontSize: 13}}>
          {_("Worker / server")}: {serverLabel}
        </Text>
        <Text style={styles.createdMeta ||= {color: colors.textMuted, fontSize: 13}}>
          {_("Created")}: {formatTimestamp(build.createdAtMs)} ({formatRelative(build.createdAtMs)})
        </Text>
        <Text style={styles.priorityMeta ||= {color: colors.textMuted, fontSize: 13}}>
          {_("Priority")}: {build.priority} · {_("Chained build")}: {build.chainedBuild ? _("Yes") : _("No")}
        </Text>
        {(build.estimatedCpuUsage !== null || build.estimatedMemoryUsage !== null) &&
          <Text style={styles.resourcesMeta ||= {color: colors.textMuted, fontSize: 13}}>
            {_("Estimated CPU")}: {build.estimatedCpuUsage ?? "—"} mCPU · {_("Estimated memory")}: {build.estimatedMemoryUsage ?? "—"} MB
          </Text>
        }
        {detailPath &&
          <Link
            asChild
            href={this.tt.detailUrl(connection.baseUrl, detailPath)}
          >
            <Pressable
              accessibilityRole="link"
              style={styles.buildLink ||= {alignSelf: "flex-start", paddingVertical: 4}}
              testID={`runningBuildLink-${build.buildId}`}
            >
              <Text style={styles.buildLinkText ||= {color: colors.primary, fontSize: 14, fontWeight: "600"}}>
                {_("Open build details")}
              </Text>
            </Pressable>
          </Link>
        }
        <Text style={styles.order ||= {color: colors.textMuted, fontSize: 10}} testID={`runningBuildRow-${index}`}>
          {_("Build ID")}: {build.buildId}
        </Text>
      </View>
    )
  }

  /** @param {string} baseUrl - Connection URL. @param {string} detailPath - Validated relative path. @returns {string} - Absolute same-backend detail URL. */
  detailUrl(baseUrl, detailPath) {
    const configuredUrl = new URL(baseUrl)
    const detailUrl = new URL(detailPath, `${baseUrl.replace(/\/+$/, "")}/`)

    if (detailUrl.origin !== configuredUrl.origin) throw new Error("Build detail path escaped the configured backend origin.")

    return detailUrl.toString()
  }
}

/** @type {NamedExoticComponent<RunningBuildsScreenProps>} */
const RunningBuildsScreenComponent = memo(shapeComponent(RunningBuildsScreen))

export default RunningBuildsScreenComponent
