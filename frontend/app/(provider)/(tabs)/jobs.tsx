import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { EmptyState } from "@/src/components/ui";
import { Screen } from "@/src/components/screen";
import { brl, shortDate, STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const ACTIVE = ["PROVIDER_ACCEPTED", "PROVIDER_EN_ROUTE", "SERVICE_STARTED", "SERVICE_COMPLETED"];

export default function ProviderJobs() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const q = useQuery({ queryKey: ["orders"], queryFn: () => api("/orders"), refetchInterval: 8000 });
  const orders = q.data?.orders || [];

  return (
    <Screen title="Serviços" subtitle="Seus atendimentos">
      <FlatList
        data={orders}
        keyExtractor={(o) => o.order_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="briefcase-outline" title="Nenhum serviço ainda" subtitle="Fique online para receber pedidos" />}
        renderItem={({ item }) => (
          <Pressable testID={`job-row-${item.order_id}`} style={s.card}
            onPress={() => ACTIVE.includes(item.status) && router.push(`/(provider)/job/${item.order_id}`)}>
            <View style={s.iconWrap}><Ionicons name="cube-outline" size={22} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.service_name}</Text>
              <Text style={s.date}>{shortDate(item.created_at)} · {item.address?.neighborhood}</Text>
              <Text style={[s.status, { color: statusColor(item.status, colors) }]}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <Text style={s.pay}>{brl(item.pricing?.provider_payout)}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  iconWrap: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  date: { fontSize: 12, color: c.muted },
  status: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  pay: { fontSize: 16, fontWeight: "800", color: c.onSurface },
}));
