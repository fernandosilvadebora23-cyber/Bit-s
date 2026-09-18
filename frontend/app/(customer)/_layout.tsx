import { Stack } from "expo-router";
import React from "react";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="request" options={{ presentation: "card" }} />
      <Stack.Screen name="order/[orderId]" />
    </Stack>
  );
}
