/**
 * Web implementation of `@react-native-segmented-control/segmented-control`.
 *
 * The published package only ships an iOS native view plus a JS fallback that
 * animates with `useNativeDriver` (unsupported in the browser), so metro
 * aliases the package to this module for web (see metro.config.js).
 */
import { useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

type SegmentedControlProps = {
  values?: string[];
  selectedIndex?: number;
  enabled?: boolean;
  tintColor?: string;
  backgroundColor?: string;
  fontStyle?: TextStyle;
  activeFontStyle?: TextStyle;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onChange?: (event: {
    nativeEvent: { value: string; selectedSegmentIndex: number };
  }) => void;
  onValueChange?: (value: string) => void;
};

const SegmentedControl = ({
  values = [],
  selectedIndex,
  enabled = true,
  tintColor,
  backgroundColor,
  fontStyle,
  activeFontStyle,
  style,
  testID,
  onChange,
  onValueChange,
}: SegmentedControlProps) => {
  // Mirrors the native component: controlled when `selectedIndex` is given.
  const [uncontrolledIndex, setUncontrolledIndex] = useState(0);
  const activeIndex = selectedIndex ?? uncontrolledIndex;

  const select = (index: number) => {
    if (!enabled) {
      return;
    }
    setUncontrolledIndex(index);
    onChange?.({
      nativeEvent: { value: values[index], selectedSegmentIndex: index },
    });
    onValueChange?.(values[index]);
  };

  return (
    <View
      testID={testID}
      style={[
        styles.container,
        backgroundColor ? { backgroundColor } : null,
        !enabled && styles.disabled,
        style,
      ]}
    >
      {values.map((value, index) => {
        const active = index === activeIndex;

        return (
          <Pressable
            key={`${value}-${index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: !enabled }}
            onPress={() => select(index)}
            style={[
              styles.segment,
              active && styles.activeSegment,
              active && tintColor ? { backgroundColor: tintColor } : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                fontStyle,
                active && styles.activeLabel,
                active ? activeFontStyle : null,
              ]}
            >
              {value}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#EFEFF0",
    borderRadius: 9,
    padding: 2,
    overflow: "hidden",
  },
  disabled: { opacity: 0.5 },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 8,
  },
  activeSegment: { backgroundColor: "#FFFFFF" },
  label: { fontSize: 13, color: "#000000" },
  activeLabel: { fontWeight: "600" },
});

export default SegmentedControl;
