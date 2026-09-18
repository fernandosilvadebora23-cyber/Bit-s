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

export default function CustomerOrders() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const q = useQuery({ queryKey: ["orders"], queryFn: () => api("/orders") });
  const orders = q.data?.orders || [];

  return (
    <Screen title="Meus pedidos" subtitle="Histórico e pedidos ativos">
      <FlatList
        data={orders}
        keyExtractor={(o) => o.order_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="Nenhum pedido ainda" subtitle="Seus pedidos aparecerão aqui" />}
        renderItem={({ item }) => (
          <Pressable testID={`order-row-${item.order_id}`} style={s.card} onPress={() => router.push(`/(customer)/order/${item.order_id}`)}>
            <View style={s.iconWrap}>
              <Ionicons name="cube-outline" size={22} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.service_name}</Text>
              <Text style={s.date}>{shortDate(item.created_at)}</Text>
              <Text style={[s.status, { color: statusColor(item.status, colors) }]}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <Text style={s.price}>{brl(item.price_total)}</Text>
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
  price: { fontSize: 16, fontWeight: "800", color: c.onSurface },
}));
