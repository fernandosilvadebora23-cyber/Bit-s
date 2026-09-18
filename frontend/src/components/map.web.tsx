// Web fallback map: react-native-maps is native-only and breaks web bundling,
// so on web we render a styled placeholder with pins.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "@/src/theme";

export type MapMarker = { lat: number; lng: number; kind?: "customer" | "provider"; title?: string };

type Props = {
  center: { lat: number; lng: number };
  markers?: MapMarker[];
  style?: any;
  interactive?: boolean;
};

export function BitsMap({ markers = [], style }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, style, { overflow: "hidden" }]} testID="map-web-fallback">
      <LinearGradient
        colors={[colors.brandTertiary, colors.surfaceSecondary]}
        style={StyleSheet.absoluteFill}
      />
      {/* faux street grid */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={`h${i}`} style={[styles.line, { top: `${(i + 1) * 14}%`, height: 1, width: "100%", backgroundColor: colors.border }]} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={`v${i}`} style={[styles.line, { left: `${(i + 1) * 14}%`, width: 1, height: "100%", backgroundColor: colors.border }]} />
      ))}
      <View style={styles.center}>
        {markers.some((m) => m.kind === "provider") && (
          <Ionicons name="car-sport" size={26} color={colors.info} style={{ marginBottom: 40, marginRight: 60 }} />
        )}
        <Ionicons name="location" size={34} color={colors.brandPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { position: "absolute" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
});
