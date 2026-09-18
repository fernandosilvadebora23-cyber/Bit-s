// Bit-s logo: four squares in a 2x2 grid, the top-right one slightly tilted.
import React from "react";
import { View } from "react-native";

import { radius, useTheme } from "@/src/theme";

export function BitsMark({ size = 40, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const c = color ?? colors.brandPrimary;
  const gap = size * 0.14;
  const sq = (size - gap) / 2;
  const r = sq * 0.22;
  const cell = (extra?: object) => (
    <View
      style={[
        { width: sq, height: sq, backgroundColor: c, borderRadius: r },
        extra,
      ]}
    />
  );
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: gap }}>
        {cell()}
        <View style={{ transform: [{ rotate: "20deg" }] }}>{cell()}</View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {cell()}
        {cell()}
      </View>
    </View>
  );
}

// Rounded green tile version (app-icon style) with black squares.
export function BitsTile({ size = 64 }: { size?: number }) {
  const { colors } = useTheme();
  const pad = size * 0.2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.brandPrimary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BitsMark size={size - pad * 2} color="#0B0F0D" />
    </View>
  );
}

export function BitsWordmark({ size = 22, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: size * 0.4 }}>
      <BitsMark size={size} />
      <View style={{ borderRadius: radius.sm }} />
    </View>
  );
}
