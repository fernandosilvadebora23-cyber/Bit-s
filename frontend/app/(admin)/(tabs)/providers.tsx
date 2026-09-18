import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { Screen } from "@/src/components/screen";
import { EmptyState } from "@/src/components/ui";
import { PROVIDER_STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const STATUSES = ["PENDENTE", "EM_ANALISE", "VERIFICADO", "SUSPENSO", "BLOQUEADO"];

export default function AdminProviders() {
  const s = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const q = useQuery({ queryKey: ["admin-providers"], queryFn: () => api("/admin/providers"), refetchInterval: 10000 });
  const providers = q.data?.providers || [];

  const setStatus = async (userId: string, status: string) => {
    try {
      await api(`/admin/providers/${userId}/status`, { method: "POST", body: { status } });
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.show(`Status: ${PROVIDER_STATUS_LABEL[status]}`, "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  return (
    <Screen title="Prestadores" subtitle="Verificação e gestão">
      <FlatList
        data={providers}
        keyExtractor={(p) => p.user_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="people-outline" title="Nenhum prestador" />}
        renderItem={({ item }) => (
          <View style={s.card} testID={`admin-provider-${item.user_id}`}>
            <View style={s.head}>
              <View style={s.avatar}><Ionicons name="person" size={22} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name || "Sem nome"}</Text>
                <Text style={s.email}>{item.email}</Text>
                <Text style={s.meta}>{(item.categories || []).join(", ") || "sem categorias"} · {item.rating_avg?.toFixed(1) ?? "0.0"}★</Text>
              </View>
              <View style={[s.badge, { backgroundColor: statusColor(item.status, colors) + "22" }]}>
                <Text style={[s.badgeText, { color: statusColor(item.status, colors) }]}>{PROVIDER_STATUS_LABEL[item.status]}</Text>
              </View>
            </View>
            <View style={s.statusRow}>
              {STATUSES.map((st) => {
                const on = item.status === st;
                return (
                  <Pressable key={st} testID={`set-status-${item.user_id}-${st}`} onPress={() => setStatus(item.user_id, st)}
                    style={[s.stChip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    <Text style={[s.stChipText, on && { color: colors.onBrandPrimary }]}>{PROVIDER_STATUS_LABEL[st]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  email: { fontSize: 12, color: c.muted },
  meta: { fontSize: 12, color: c.onSurfaceSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  stChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  stChipText: { fontSize: 11, fontWeight: "600", color: c.onSurfaceSecondary },
}));
