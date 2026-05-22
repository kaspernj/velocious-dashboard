// @ts-check

import {Text, TextInput, View} from "react-native"
import {memo} from "react"
import {shapeComponent, ShapeComponent} from "set-state-compare/build/shape-component"
import colors from "../theme/colors.js"
import PropTypes from "prop-types"
import propTypesExact from "prop-types-exact"

/** @import {NamedExoticComponent} from "react" */

/**
 * @typedef {object} FormFieldProps
 * @property {string} label - Field label.
 * @property {(text: string) => void} onChangeText - Change handler.
 * @property {string} [defaultValue] - Initial uncontrolled value.
 * @property {string} [placeholder] - Placeholder text.
 * @property {"none" | "sentences" | "words" | "characters"} [autoCapitalize] - Auto-capitalize behavior.
 * @property {string} [testID] - Test id for the input.
 */

/** @typedef {Record<string, never>} FormFieldState */

/** @type {Record<string, object>} */
const styles = {}

/**
 * Labeled uncontrolled text input. Syncs through `onChangeText` so the parent
 * keeps the value, avoiding controlled-input focus issues on web.
 * @extends {ShapeComponent<FormFieldProps, FormFieldState>}
 */
class FormField extends ShapeComponent {
  static defaultProps = {
    autoCapitalize: "none"
  }

  static propTypes = propTypesExact({
    autoCapitalize: PropTypes.string,
    defaultValue: PropTypes.string,
    label: PropTypes.string.isRequired,
    onChangeText: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
    testID: PropTypes.string
  })

  /** @returns {React.JSX.Element} - Rendered field. */
  render() {
    const {autoCapitalize, defaultValue, label, onChangeText, placeholder, testID} = this.p

    return (
      <View style={styles.wrap ||= {gap: 6}}>
        <Text style={styles.label ||= {color: colors.textMuted, fontSize: 13, fontWeight: "600"}}>
          {label}
        </Text>
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          defaultValue={defaultValue}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input ||= {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: 10,
            borderWidth: 1,
            color: colors.text,
            fontSize: 15,
            padding: 12
          }}
          testID={testID}
        />
      </View>
    )
  }
}

/** @type {NamedExoticComponent<FormFieldProps>} */
const FormFieldComponent = memo(shapeComponent(FormField))

export default FormFieldComponent
