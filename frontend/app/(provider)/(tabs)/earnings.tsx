import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { Screen } from "@/src/components/screen";
import { EmptyState } from "@/src/components/ui";
import { brl, shortDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ProviderEarnings() {
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["provider-earnings"], queryFn: () => api("/provider/earnings") });
  const data = q.data;
  const orders = data?.orders || [];

  return (
    <Screen title="Ganhos" subtitle="Repasses e desempenho">
      <FlatList
        data={orders}
        keyExtractor={(o) => o.order_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={s.heroCard}>
              <Text style={s.heroLabel}>Total recebido</Text>
              <Text style={s.heroValue}>{brl(data?.earnings_total || 0)}</Text>
            </View>
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statValue}>{data?.completed_count ?? 0}</Text>
                <Text style={s.statLabel}>Serviços</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{(data?.rating_avg || 0).toFixed(1)}★</Text>
                <Text style={s.statLabel}>Avaliação ({data?.rating_count ?? 0})</Text>
              </View>
            </View>
            <Text style={s.sectionTitle}>Histórico de repasses</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="cash-outline" title="Nenhum repasse ainda" />}
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName}>{item.service_name}</Text>
              <Text style={s.rowDate}>{shortDate(item.created_at)}</Text>
            </View>
            <Text style={s.rowValue}>+{brl(item.pricing?.provider_payout)}</Text>
          </View>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  heroCard: { backgroundColor: c.brandPrimary, borderRadius: radius.lg, padding: spacing.xl, gap: 4 },
  heroLabel: { fontSize: 14, color: c.onBrandPrimary, opacity: 0.9 },
  heroValue: { fontSize: 34, fontWeight: "800", color: c.onBrandPrimary },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 2 },
  statValue: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  rowName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  rowDate: { fontSize: 12, color: c.muted },
  rowValue: { fontSize: 16, fontWeight: "800", color: c.success },
}));
