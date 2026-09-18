import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { BitsMap } from "@/src/components/map";
import { Button } from "@/src/components/ui";
import { brl, ORDER_FLOW, STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const NEXT_ACTION: Record<string, { label: string; endpoint: string; icon: string }> = {
  PROVIDER_ACCEPTED: { label: "Estou a caminho", endpoint: "en_route", icon: "navigate" },
  PROVIDER_EN_ROUTE: { label: "Iniciar serviço", endpoint: "start", icon: "play" },
  SERVICE_STARTED: { label: "Concluir serviço", endpoint: "complete", icon: "checkmark-done" },
};

export default function ProviderJob() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [busy, setBusy] = useState(false);

  const q = useQuery({ queryKey: ["order", orderId], queryFn: () => api(`/orders/${orderId}`), refetchInterval: 5000 });
  const order = q.data?.order;

  const doAction = async (endpoint: string) => {
    setBusy(true);
    try {
      await api(`/orders/${orderId}/${endpoint}`, { method: "POST" });
      await q.refetch();
      queryClient.invalidateQueries({ queryKey: ["provider-active"] });
      queryClient.invalidateQueries({ queryKey: ["provider-earnings"] });
    } catch (e: any) {
      toast.show(e.message || "Falha", "error");
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading || !order) {
    return <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}><ActivityIndicator size="large" color={colors.brandPrimary} /></View>;
  }

  const currentIdx = ORDER_FLOW.indexOf(order.status);
  const action = NEXT_ACTION[order.status];

  return (
    <View style={s.root}>
      <View style={s.mapWrap}>
        <BitsMap center={order.location} markers={[{ ...order.location, kind: "customer" }]} interactive={false} />
        <Pressable testID="job-back" onPress={() => router.back()} style={[s.backBtn, { top: insets.top + spacing.sm }]}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
      </View>
      <View style={s.sheet}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{order.service_name}</Text>
              <Text style={[s.status, { color: statusColor(order.status, colors) }]}>{STATUS_LABEL[order.status]}</Text>
            </View>
            <Text style={s.pay}>{brl(order.pricing?.provider_payout)}</Text>
          </View>

          <View style={s.infoCard}>
            <Ionicons name="person-circle-outline" size={22} color={colors.brandPrimary} />
            <Text style={s.infoText}>{order.customer_name}</Text>
          </View>
          <View style={s.infoCard}>
            <Ionicons name="location-outline" size={22} color={colors.brandPrimary} />
            <Text style={s.infoText}>{order.address?.street}, {order.address?.number} · {order.address?.neighborhood}</Text>
          </View>
          {!!order.notes && (
            <View style={s.infoCard}>
              <Ionicons name="document-text-outline" size={22} color={colors.brandPrimary} />
              <Text style={s.infoText}>{order.notes}</Text>
            </View>
          )}

          {/* Params summary */}
          <View style={s.paramsCard}>
            <Text style={s.sectionTitle}>Detalhes do serviço</Text>
            {Object.entries(order.params || {}).map(([k, v]) => (
              <View key={k} style={s.paramRow}>
                <Text style={s.paramKey}>{k}</Text>
                <Text style={s.paramVal}>{Array.isArray(v) ? v.join(", ") || "—" : String(v)}</Text>
              </View>
            ))}
          </View>

          <Text style={s.sectionTitle}>Progresso</Text>
          <View style={s.timeline}>
            {ORDER_FLOW.slice(3, 11).map((step) => {
              const idx = ORDER_FLOW.indexOf(step);
              const done = idx < currentIdx;
              const active = idx === currentIdx;
              return (
                <View key={step} style={s.tRow}>
                  <View style={[s.dot, done && { backgroundColor: colors.success }, active && { backgroundColor: colors.brandPrimary }]}>
                    {done && <Ionicons name="checkmark" size={12} color={colors.onSuccess} />}
                  </View>
                  <Text style={[s.tLabel, active && { fontWeight: "800", color: colors.onSurface }]}>{STATUS_LABEL[step]}</Text>
                </View>
              );
            })}
          </View>

          {order.status === "SERVICE_COMPLETED" && (
            <View style={s.waitCard}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={s.waitText}>Aguardando pagamento do cliente...</Text>
            </View>
          )}
          {order.status === "COMPLETED" && (
            <View style={[s.waitCard, { backgroundColor: colors.brandTertiary }]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Text style={[s.waitText, { color: colors.onBrandTertiary }]}>Serviço finalizado. Repasse de {brl(order.pricing?.provider_payout)} realizado.</Text>
            </View>
          )}
          <View style={{ height: insets.bottom + 90 }} />
        </ScrollView>

        {action && (
          <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            <Button testID="job-action-button" label={action.label} icon={action.icon as any} loading={busy} onPress={() => doAction(action.endpoint)} />
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  mapWrap: { height: "28%", backgroundColor: c.surfaceSecondary },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", elevation: 3 },
  sheet: { flex: 1, backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -22 },
  content: { padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  status: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  pay: { fontSize: 20, fontWeight: "800", color: c.brandPrimary },
  infoCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  infoText: { flex: 1, fontSize: 14, color: c.onSurface },
  paramsCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  paramRow: { flexDirection: "row", justifyContent: "space-between" },
  paramKey: { fontSize: 13, color: c.muted, textTransform: "capitalize" },
  paramVal: { fontSize: 13, color: c.onSurface, fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  timeline: { gap: spacing.sm },
  tRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  tLabel: { fontSize: 14, color: c.muted },
  waitCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.surfaceSecondary, padding: spacing.md, borderRadius: radius.md },
  waitText: { flex: 1, fontSize: 14, color: c.onSurfaceSecondary, fontWeight: "600" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingTop: spacing.md, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.divider },
}));
