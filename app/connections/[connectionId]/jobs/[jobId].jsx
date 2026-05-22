// @ts-check

import {ActivityIndicator, Text, View} from "react-native"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import {Stack, useLocalSearchParams} from "expo-router"
import _ from "gettext-universal/build/src/translate.js"
import colors from "@/src/theme/colors"
import {formatTimestamp} from "@/src/utils/format-time"
import JobsClient from "@/src/api/jobs-client"
import {memo} from "react"
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

/** @typedef {Record<string, never>} JobDetailScreenProps */

/**
 * @typedef {object} JobDetailScreenState
 * @property {Record<string, any> | null} job - The loaded job.
 * @property {string | null} errorMessage - Last fetch error.
 * @property {boolean} loading - Whether the load is in progress.
 */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Detail view for a single job: timestamps, retries, args and last error.
 * @extends {ShapeComponent<JobDetailScreenProps, JobDetailScreenState>}
 */
class JobDetailScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  mounted = true

  /** @type {ConnectionsContextValue} */
  connections

  /** @type {Record<string, string | string[] | undefined>} */
  params

  /** @type {JobDetailScreenState} */
  state = {
    errorMessage: null,
    job: null,
    loading: true
  }

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
    this.params = useLocalSearchParams()
  }

  /** @returns {void} */
  componentDidMount() {
    void this.tt.loadJob()
  }

  /** @returns {void} */
  componentWillUnmount() {
    this.mounted = false
  }

  /** @returns {React.JSX.Element} - Rendered detail. */
  render() {
    const {errorMessage, job, loading} = this.s

    return (
      <Screen testID="jobDetailScreen">
        <Stack.Screen options={{title: _("Job")}} />
        {loading &&
          <ActivityIndicator color={colors.primary} testID="jobDetailLoading" />
        }
        {errorMessage &&
          <Text style={styles.error ||= {color: colors.danger, fontSize: 14}} testID="jobDetailError">
            {errorMessage}
          </Text>
        }
        {job &&
          <View style={styles.body ||= {gap: 14}}>
            <View style={styles.header ||= {alignItems: "center", flexDirection: "row", gap: 10}}>
              <Text style={styles.jobName ||= {color: colors.text, fontSize: 18, fontWeight: "700"}}>
                {job.jobName}
              </Text>
              <StatusBadge status={job.status} />
            </View>
            <View style={styles.rows ||= {gap: 8}}>
              {this.tt.detailRows(job).map((row) =>
                <View key={row.label} style={styles.row ||= {flexDirection: "row", justifyContent: "space-between"}}>
                  <Text style={styles.rowLabel ||= {color: colors.textMuted, fontSize: 13}}>
                    {row.label}
                  </Text>
                  <Text style={styles.rowValue ||= {color: colors.text, fontSize: 13, fontWeight: "600"}}>
                    {row.value}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionLabel ||= {color: colors.textMuted, fontSize: 13, fontWeight: "600"}}>
              {_("Arguments")}
            </Text>
            <Text style={styles.code ||= {backgroundColor: colors.surface, borderRadius: 10, color: colors.text, fontFamily: "monospace", fontSize: 12, padding: 12}} testID="jobDetailArgs">
              {job.argsRedacted ? _("(redacted)") : JSON.stringify(job.args ?? [], null, 2)}
            </Text>
            {job.lastError &&
              <View style={styles.errorBlock ||= {gap: 6}}>
                <Text style={styles.sectionLabel ||= {color: colors.textMuted, fontSize: 13, fontWeight: "600"}}>
                  {_("Last error")}
                </Text>
                <Text style={styles.errorCode ||= {backgroundColor: colors.surface, borderColor: colors.danger, borderRadius: 10, borderWidth: 1, color: colors.danger, fontFamily: "monospace", fontSize: 12, padding: 12}} testID="jobDetailLastError">
                  {job.lastError}
                </Text>
              </View>
            }
          </View>
        }
      </Screen>
    )
  }

  /** @returns {Connection | undefined} - The connection for this route. */
  connection() {
    const connectionId = stringParam(this.params.connectionId)

    return connectionId ? this.connections.getConnection(connectionId) : undefined
  }

  /**
   * @param {Record<string, any>} job - The job.
   * @returns {Array<{label: string, value: string}>} - Label/value rows for display.
   */
  detailRows(job) {
    return [
      {label: _("Attempts"), value: `${job.attempts} / ${job.maxRetries}`},
      {label: _("Forked"), value: job.forked ? _("Yes") : _("No")},
      {label: _("Worker"), value: job.workerId || "—"},
      {label: _("Created"), value: formatTimestamp(job.createdAtMs)},
      {label: _("Scheduled"), value: formatTimestamp(job.scheduledAtMs)},
      {label: _("Handed off"), value: formatTimestamp(job.handedOffAtMs)},
      {label: _("Completed"), value: formatTimestamp(job.completedAtMs)},
      {label: _("Failed"), value: formatTimestamp(job.failedAtMs)},
      {label: _("Orphaned"), value: formatTimestamp(job.orphanedAtMs)}
    ]
  }

  /** @returns {Promise<void>} - Loads the job from the backend. */
  async loadJob() {
    const connection = this.tt.connection()
    const jobId = stringParam(this.params.jobId)

    if (!connection || !jobId) {
      this.setState({errorMessage: _("Connection or job not found."), loading: false})
      return
    }

    const client = new JobsClient(connection)

    try {
      const result = await client.job(jobId)

      if (!this.mounted) return

      this.setState({errorMessage: null, job: result.job, loading: false})
    } catch (error) {
      if (!this.mounted) return

      this.setState({errorMessage: error instanceof Error ? error.message : String(error), loading: false})
    }
  }
}

/** @type {NamedExoticComponent<JobDetailScreenProps>} */
const JobDetailScreenComponent = memo(shapeComponent(JobDetailScreen))

export default JobDetailScreenComponent
