// @ts-check

import {ActivityIndicator, Pressable, Text} from "react-native"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import {Stack, useRouter} from "expo-router"
import _ from "gettext-universal/build/src/translate.js"
import colors from "@/src/theme/colors"
import FormField from "@/src/components/form-field"
import JobsClient from "@/src/api/jobs-client"
import {memo} from "react"
import propTypesExact from "prop-types-exact"
import Screen from "@/src/components/screen"
import useLocale from "gettext-universal/build/src/use-locale-expo.js"
import {useConnections} from "@/src/connections/use-connections"

/**
 * @import {NamedExoticComponent} from "react"
 * @typedef {import("@/src/connections/use-connections").ConnectionsContextValue} ConnectionsContextValue
 */

/** @typedef {Record<string, never>} AddConnectionScreenProps */

/**
 * @typedef {object} AddConnectionScreenState
 * @property {string | null} errorMessage - Validation/health error to show.
 * @property {boolean} submitting - Whether the connection is being verified/saved.
 */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Form to add a backend connection. Verifies the API with a health check
 * before persisting it.
 * @extends {ShapeComponent<AddConnectionScreenProps, AddConnectionScreenState>}
 */
class AddConnectionScreen extends ShapeComponent {
  static propTypes = propTypesExact({})

  name = ""
  baseUrl = ""
  token = ""
  mountPath = "/velocious/jobs"
  mounted = true

  /** @type {ConnectionsContextValue} */
  connections

  /** @type {import("expo-router").Router} */
  router

  /** @type {AddConnectionScreenState} */
  state = {
    errorMessage: null,
    submitting: false
  }

  /** @returns {void} */
  setup() {
    useLocale()
    this.connections = useConnections()
    this.router = useRouter()
  }

  /** @returns {React.JSX.Element} - Rendered form. */
  render() {
    const {errorMessage, submitting} = this.s

    return (
      <Screen testID="addConnectionScreen">
        <Stack.Screen options={{title: _("Add connection")}} />
        <FormField
          autoCapitalize="sentences"
          label={_("Name")}
          onChangeText={this.tt.onNameChangeText}
          placeholder={_("Production")}
          testID="connectionNameInput"
        />
        <FormField
          label={_("Backend URL")}
          onChangeText={this.tt.onBaseUrlChangeText}
          placeholder="https://api.example.com"
          testID="connectionBaseUrlInput"
        />
        <FormField
          label={_("Access token")}
          onChangeText={this.tt.onTokenChangeText}
          placeholder={_("Bearer token (optional for loopback)")}
          testID="connectionTokenInput"
        />
        <FormField
          defaultValue="/velocious/jobs"
          label={_("Mount path")}
          onChangeText={this.tt.onMountPathChangeText}
          testID="connectionMountPathInput"
        />
        {errorMessage &&
          <Text style={styles.error ||= {color: colors.danger, fontSize: 14}} testID="addConnectionError">
            {errorMessage}
          </Text>
        }
        <Pressable
          disabled={submitting}
          onPress={this.tt.onSavePress}
          style={styles[`submit-${submitting}`] ||= {
            alignItems: "center",
            backgroundColor: submitting ? colors.surfaceMuted : colors.primary,
            borderRadius: 12,
            marginTop: 4,
            padding: 14
          }}
          testID="saveConnectionButton"
        >
          {submitting ?
            <ActivityIndicator color={colors.background} />
            :
            <Text style={styles.submitText ||= {color: colors.background, fontSize: 15, fontWeight: "700"}}>
              {_("Save connection")}
            </Text>
          }
        </Pressable>
      </Screen>
    )
  }

  /** @returns {void} */
  componentWillUnmount() {
    this.mounted = false
  }

  /** @param {string} text - New value. @returns {void} */
  onNameChangeText(text) {
    this.name = text
  }

  /** @param {string} text - New value. @returns {void} */
  onBaseUrlChangeText(text) {
    this.baseUrl = text
  }

  /** @param {string} text - New value. @returns {void} */
  onTokenChangeText(text) {
    this.token = text
  }

  /** @param {string} text - New value. @returns {void} */
  onMountPathChangeText(text) {
    this.mountPath = text
  }

  /** @returns {Promise<void>} - Verifies and persists the connection. */
  async onSavePress() {
    const baseUrl = this.baseUrl.trim()
    const mountPath = this.mountPath.trim() || "/velocious/jobs"
    const token = this.token.trim()

    if (!/^https?:\/\//i.test(baseUrl)) {
      this.setState({errorMessage: _("Enter a backend URL starting with http:// or https://")})
      return
    }

    this.setState({errorMessage: null, submitting: true})

    try {
      const client = new JobsClient({baseUrl, mountPath, token})

      await client.health()
      await this.connections.addConnection({baseUrl, mountPath, name: this.name.trim() || baseUrl, token})
      this.router.replace("/")
    } catch (error) {
      this.setState({errorMessage: error instanceof Error ? error.message : String(error)})
    } finally {
      if (this.mounted) this.setState({submitting: false})
    }
  }
}

/** @type {NamedExoticComponent<AddConnectionScreenProps>} */
const AddConnectionScreenComponent = memo(shapeComponent(AddConnectionScreen))

export default AddConnectionScreenComponent
