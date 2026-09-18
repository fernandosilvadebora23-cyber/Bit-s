import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { Screen } from "@/src/components/screen";
import { EmptyState } from "@/src/components/ui";
import { brl, shortDate, STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function AdminOrders() {
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["admin-orders"], queryFn: () => api("/admin/orders"), refetchInterval: 8000 });
  const orders = q.data?.orders || [];

  return (
    <Screen title="Pedidos" subtitle={`${orders.length} no total`}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.order_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="Nenhum pedido" />}
        renderItem={({ item }) => (
          <View style={s.card} testID={`admin-order-${item.order_id}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.service_name} · {item.customer_name}</Text>
              <Text style={s.date}>{shortDate(item.created_at)} · {item.address?.neighborhood}</Text>
              <Text style={[s.status, { color: statusColor(item.status, colors) }]}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.price}>{brl(item.price_total)}</Text>
              {item.pricing?.surge && <Text style={s.surge}>surge x{item.pricing.surge_factor}</Text>}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  name: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  date: { fontSize: 12, color: c.muted },
  status: { fontSize: 13, fontWeight: "700", marginTop: 2 },
  price: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  surge: { fontSize: 11, color: c.warning, fontWeight: "700" },
}));
