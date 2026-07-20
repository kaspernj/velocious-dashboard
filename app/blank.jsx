// @ts-check

import {Text, View} from "react-native"

/** @returns {React.JSX.Element} - System-test reset route. */
export default function BlankScreen() {
  return (
    <View>
      <Text testID="blankText">Blank</Text>
    </View>
  )
}
