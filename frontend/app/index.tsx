import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/src/auth";
import { BitsTile } from "@/src/components/logo";
import { useTheme } from "@/src/theme";

const ROLE_HOME: Record<string, any> = {
  customer: "/(customer)/(tabs)/home",
  provider: "/(provider)/(tabs)/home",
  admin: "/(admin)/(tabs)/dashboard",
};

export default function Index() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 20 }}>
        <BitsTile size={84} />
        <ActivityIndicator color={colors.brandPrimary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={ROLE_HOME[user.role]} />;
}
