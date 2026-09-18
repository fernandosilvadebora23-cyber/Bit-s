import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/screen";
import { Button } from "@/src/components/ui";
import { brl } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const METRICS: { key: string; label: string; icon: any; money?: boolean }[] = [
  { key: "gmv", label: "GMV (concluídos)", icon: "trending-up", money: true },
  { key: "platform_revenue", label: "Receita plataforma", icon: "wallet", money: true },
  { key: "total_orders", label: "Pedidos totais", icon: "receipt" },
  { key: "active_orders", label: "Pedidos ativos", icon: "pulse" },
  { key: "customers", label: "Clientes", icon: "person" },
  { key: "providers", label: "Prestadores", icon: "people" },
  { key: "online_providers", label: "Online agora", icon: "flash" },
  { key: "pending_verifications", label: "Verif. pendentes", icon: "shield-half" },
];

export default function AdminDashboard() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const q = useQuery({ queryKey: ["admin-overview"], queryFn: () => api("/admin/overview"), refetchInterval: 10000 });
  const d = q.data || {};

  return (
    <Screen title="Painel" subtitle="Visão geral da operação">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}>
        <View style={s.grid}>
          {METRICS.map((m) => (
            <View key={m.key} style={s.card} testID={`metric-${m.key}`}>
              <View style={s.iconWrap}><Ionicons name={m.icon} size={18} color={colors.brandPrimary} /></View>
              <Text style={s.value}>{m.money ? brl(d[m.key] || 0) : (d[m.key] ?? 0)}</Text>
              <Text style={s.label}>{m.label}</Text>
            </View>
          ))}
        </View>
        <Button testID="logout-button" label="Sair" variant="outline" icon="log-out-outline" onPress={logout} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: { width: "47%", flexGrow: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
  iconWrap: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs },
  value: { fontSize: 22, fontWeight: "800", color: c.onSurface },
  label: { fontSize: 12, color: c.muted },
}));
