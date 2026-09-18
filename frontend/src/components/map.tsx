// Native map (Expo Go / device). Web uses map.web.tsx automatically.
import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { useTheme } from "@/src/theme";

export type MapMarker = { lat: number; lng: number; kind?: "customer" | "provider"; title?: string };

type Props = {
  center: { lat: number; lng: number };
  markers?: MapMarker[];
  style?: any;
  interactive?: boolean;
};

export function BitsMap({ center, markers = [], style, interactive = true }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        region={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
      >
        {markers.map((m, i) => (
          <Marker
            key={i}
            coordinate={{ latitude: m.lat, longitude: m.lng }}
            title={m.title}
            pinColor={m.kind === "provider" ? colors.info : colors.brandPrimary}
          />
        ))}
      </MapView>
    </View>
  );
}
