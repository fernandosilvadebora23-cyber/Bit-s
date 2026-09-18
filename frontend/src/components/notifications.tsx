import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { EmptyState } from "@/src/components/ui";
import { Screen } from "@/src/components/screen";
import { shortDate } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const ICON: Record<string, any> = {
  order: "cube-outline",
  payment: "card-outline",
  verification: "shield-checkmark-outline",
  info: "information-circle-outline",
};

export function NotificationsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => api("/notifications"), refetchInterval: 10000 });
  const items = q.data?.notifications || [];

  const markRead = async (id: string) => {
    await api(`/notifications/${id}/read`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Screen title="Notificações" subtitle={q.data?.unread ? `${q.data.unread} não lidas` : "Tudo em dia"}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.notification_id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={q.refetch} tintColor={colors.brandPrimary} />}
        ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="Sem notificações" />}
        renderItem={({ item }) => (
          <Pressable testID={`notif-${item.notification_id}`} onPress={() => !item.read && markRead(item.notification_id)}
            style={[s.card, !item.read && { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]}>
            <View style={s.iconWrap}>
              <Ionicons name={ICON[item.kind] || ICON.info} size={20} color={colors.brandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{item.title}</Text>
              <Text style={s.body}>{item.body}</Text>
              <Text style={s.date}>{shortDate(item.created_at)}</Text>
            </View>
            {!item.read && <View style={s.unreadDot} />}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  card: { flexDirection: "row", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: c.border },
  iconWrap: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  body: { fontSize: 13, color: c.onSurfaceSecondary, marginTop: 1 },
  date: { fontSize: 11, color: c.muted, marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.brandPrimary, alignSelf: "center" },
}));
