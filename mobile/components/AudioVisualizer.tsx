import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

interface Props {
  active: boolean;
  color?: string;
  barCount?: number;
}

export default function AudioVisualizer({ active, color = "#FF6B35", barCount = 5 }: Props) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <View style={styles.container}>
      {bars.map((i) => (
        <Bar key={i} index={i} active={active} color={color} total={barCount} />
      ))}
    </View>
  );
}

function Bar({ index, active, color, total }: { index: number; active: boolean; color: string; total: number }) {
  const height = useSharedValue(4);
  const center = Math.floor(total / 2);
  const distance = Math.abs(index - center);
  const maxH = 32 - distance * 4;
  const delay = (index / total) * 300;

  useEffect(() => {
    if (active) {
      height.value = withDelay(
        delay,
        withRepeat(
          withTiming(maxH, { duration: 400 + distance * 80, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        )
      );
    } else {
      height.value = withTiming(4, { duration: 300 });
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[styles.bar, animStyle, { backgroundColor: color, width: 4, borderRadius: 2 }]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 40,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
