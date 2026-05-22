// @ts-check

import {ActivityIndicator, Pressable, Text, View} from "react-native"
import {Link, Stack, useLocalSearchParams} from "expo-router"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import _ from "gettext-universal/build/src/translate.js"
import colors from "@/src/theme/colors"
import {formatRelative} from "@/src/utils/format-time"
import JobsClient from "@/src/api/jobs-client"
import {memo, useEffect} from "react"
import propTypesExact from "prop-types-exact"
import Screen from "@/src/components/screen"
import StatusBadge from "@/src/components/status-badge"
import {stringParam} from "@/src/utils/params"
import useLocale from "gettext-universal/build/src/use-locale-expo.js"
import {useConnections} from "@/src/connections/use-connections"

/**
 * @import {NamedExoticComponent} from "react"
 * @typedef {import("@/src/connections/use-connections").ConnectionsContextValue} ConnectionsContextValue
 * @typedef {import("@/src/connections/connections-store.js").Connection} Connection
 */

/** @typedef {Record<string, never>} JobsScreenProps */

/**
 * @typedef {object} JobsScreenState
 * @property {Array<Record<string, any>>} jobs - Loaded jobs.
 * @property {{page: number, perPage: number, total: number, totalPages: number} | null} pagination - Page info.
 * @property {string | null} errorMessage - Last fetch error.
 * @property {boolean} loading - Whether a load is in progress.
 */

const FILTERS = ["all", "queued", "handed_off", "completed", "failed", "orphaned"]
const PER_PAGE = 25

/** @type {Record<string, object>} */
const styles = {}

/**
 * Paginated, status-filterable job list for a connection.
 * @extends {ShapeComponent<JobsScreenProps, JobsScreenState>}
 */
class JobsScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  mounted = true
  requestId = 0

  /** @type {ConnectionsContextValue} */
  connections

  /** @type {Record<string, string | string[] | undefined>} */
  params

  /** @type {JobsScreenState} */
  state = {
    errorMessage: null,
    jobs: [],
    loading: true,
    pagination: null
  }

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
    this.params = useLocalSearchParams()

    const status = stringParam(this.params.status)
    const page = Number(stringParam(this.params.page)) || 1
    const connectionId = stringParam(this.params.connectionId)

    useEffect(() => {
      void this.tt.loadJobs({page, status})
    }, [connectionId, status, page])
  }

  /** @returns {void} */
  componentWillUnmount() {
    this.mounted = false
  }

  /** @returns {React.JSX.Element} - Rendered list. */
  render() {
    const connection = this.tt.connection()

    if (!connection) {
      return (
        <Screen testID="jobsScreen">
          <Stack.Screen options={{title: _("Jobs")}} />
          <Text style={styles.notFound ||= {color: colors.textMuted, fontSize: 15}} testID="jobsNotFound">
            {_("Connection not found.")}
          </Text>
        </Screen>
      )
    }

    const connectionId = connection.id
    const activeStatus = stringParam(this.params.status) || "all"
    const {errorMessage, jobs, loading} = this.s

    return (
      <Screen testID="jobsScreen">
        <Stack.Screen options={{title: _("Jobs")}} />
        <View style={styles.filters ||= {flexDirection: "row", flexWrap: "wrap", gap: 8}}>
          {FILTERS.map((filter) =>
            <Link
              asChild
              href={filter === "all" ? `/connections/${connectionId}/jobs` : `/connections/${connectionId}/jobs?status=${filter}`}
              key={filter}
            >
              <Pressable
                style={styles[`filter-${filter === activeStatus}`] ||= {
                  backgroundColor: filter === activeStatus ? colors.primary : colors.surface,
                  borderColor: colors.border,
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 6
                }}
                testID={`jobsFilter-${filter}`}
              >
                <Text style={styles[`filterText-${filter === activeStatus}`] ||= {color: filter === activeStatus ? colors.background : colors.textMuted, fontSize: 13, fontWeight: "600"}}>
                  {filter}
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
        {loading &&
          <ActivityIndicator color={colors.primary} testID="jobsLoading" />
        }
        {errorMessage &&
          <Text style={styles.error ||= {color: colors.danger, fontSize: 14}} testID="jobsError">
            {errorMessage}
          </Text>
        }
        {!loading && !errorMessage && jobs.length === 0 &&
          <Text style={styles.empty ||= {color: colors.textMuted, fontSize: 15}} testID="jobsEmpty">
            {_("No jobs match this filter.")}
          </Text>
        }
        {jobs.map((job) =>
          <Link
            asChild
            href={`/connections/${connectionId}/jobs/${job.id}`}
            key={job.id}
          >
            <Pressable
              style={styles.jobRow ||= {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
                gap: 6,
                padding: 14
              }}
              testID={`jobRow-${job.id}`}
            >
              <View style={styles.jobRowTop ||= {alignItems: "center", flexDirection: "row", justifyContent: "space-between"}}>
                <Text style={styles.jobName ||= {color: colors.text, fontSize: 15, fontWeight: "600"}}>
                  {job.jobName}
                </Text>
                <StatusBadge status={job.status} />
              </View>
              <Text style={styles.jobMeta ||= {color: colors.textMuted, fontSize: 12}}>
                {_("Created")} {formatRelative(job.createdAtMs)}
              </Text>
            </Pressable>
          </Link>
        )}
      </Screen>
    )
  }

  /** @returns {Connection | undefined} - The connection for this route. */
  connection() {
    const connectionId = stringParam(this.params.connectionId)

    return connectionId ? this.connections.getConnection(connectionId) : undefined
  }

  /**
   * @param {object} args - Options.
   * @param {string} [args.status] - Status filter.
   * @param {number} args.page - Page number.
   * @returns {Promise<void>} - Loads the matching jobs.
   */
  async loadJobs({page, status}) {
    const connection = this.tt.connection()

    // Expected when the connection was removed while this screen is open.
    if (!connection) return

    const requestId = ++this.requestId
    const client = new JobsClient(connection)

    this.setState({loading: true})

    try {
      const result = await client.jobs({page, perPage: PER_PAGE, status: status === "all" ? undefined : status})

      if (!this.mounted || requestId !== this.requestId) return

      this.setState({errorMessage: null, jobs: result.jobs, loading: false, pagination: result.pagination})
    } catch (error) {
      if (!this.mounted || requestId !== this.requestId) return

      this.setState({errorMessage: error instanceof Error ? error.message : String(error), jobs: [], loading: false})
    }
  }
}

/** @type {NamedExoticComponent<JobsScreenProps>} */
const JobsScreenComponent = memo(shapeComponent(JobsScreen))

export default JobsScreenComponent
