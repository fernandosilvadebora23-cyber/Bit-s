import { Stack } from "expo-router";
import React from "react";

export default function ProviderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="job/[orderId]" />
    </Stack>
  );
}
