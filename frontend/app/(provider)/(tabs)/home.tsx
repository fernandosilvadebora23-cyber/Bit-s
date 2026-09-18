import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { Button } from "@/src/components/ui";
import { Screen } from "@/src/components/screen";
import { brl, STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const CURITIBA = { lat: -25.4284, lng: -49.2733 };

export default function ProviderHome() {
  const s = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const profileQ = useQuery({ queryKey: ["provider-profile"], queryFn: () => api("/provider/me") });
  const incomingQ = useQuery({ queryKey: ["provider-incoming"], queryFn: () => api("/provider/incoming"), refetchInterval: 4000 });
  const activeQ = useQuery({ queryKey: ["provider-active"], queryFn: () => api("/provider/active"), refetchInterval: 5000 });
  const earningsQ = useQuery({ queryKey: ["provider-earnings"], queryFn: () => api("/provider/earnings") });

  const profile = profileQ.data?.profile;
  const incoming = incomingQ.data?.orders || [];
  const active = activeQ.data?.orders || [];
  const verified = profile?.status === "VERIFICADO";
  const online = !!profile?.is_online;

  const toggleOnline = async (val: boolean) => {
    try {
      await api("/provider/availability", {
        method: "POST",
        body: { is_online: val, location: profile?.current_location || CURITIBA },
      });
      queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
    } catch (e: any) {
      toast.show(e.message || "Falha", "error");
    }
  };

  const respond = async (orderId: string, action: "accept" | "decline") => {
    try {
      await api(`/orders/${orderId}/${action}`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["provider-incoming"] });
      queryClient.invalidateQueries({ queryKey: ["provider-active"] });
      toast.show(action === "accept" ? "Pedido aceito!" : "Pedido recusado", action === "accept" ? "success" : "info");
      if (action === "accept") router.push(`/(provider)/job/${orderId}`);
    } catch (e: any) {
      toast.show(e.message || "Falha", "error");
    }
  };

  const refreshing = incomingQ.isFetching || activeQ.isFetching;

  return (
    <Screen title="Painel" subtitle="Prestador Bit-s"
      right={
        <View style={s.onlinePill}>
          <View style={[s.dot, { backgroundColor: online ? colors.success : colors.muted }]} />
          <Text style={[s.onlineText, { color: online ? colors.success : colors.muted }]}>{online ? "Online" : "Offline"}</Text>
        </View>
      }>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { incomingQ.refetch(); activeQ.refetch(); }} tintColor={colors.brandPrimary} />}>

        {!verified && (
          <Pressable testID="verify-banner" style={s.warnBanner} onPress={() => router.push("/(provider)/onboarding")}>
            <Ionicons name="shield-half-outline" size={22} color={colors.onWarning} />
            <View style={{ flex: 1 }}>
              <Text style={s.warnTitle}>Verificação necessária</Text>
              <Text style={s.warnSub}>Status: {STATUS_LABEL[profile?.status] || profile?.status || "—"}. Complete seu cadastro.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onWarning} />
          </Pressable>
        )}

        {/* Availability card */}
        <View style={s.availCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.availTitle}>Disponibilidade</Text>
            <Text style={s.availSub}>{online ? "Você está recebendo pedidos" : "Fique online para receber pedidos"}</Text>
          </View>
          <Switch
            testID="availability-switch"
            value={online}
            onValueChange={toggleOnline}
            disabled={!verified}
            trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
            thumbColor={colors.surface}
          />
        </View>

        {/* Today stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{brl(earningsQ.data?.earnings_total || 0)}</Text>
            <Text style={s.statLabel}>Ganhos totais</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{earningsQ.data?.completed_count ?? 0}</Text>
            <Text style={s.statLabel}>Concluídos</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue}>{(earningsQ.data?.rating_avg || 0).toFixed(1)}</Text>
            <Text style={s.statLabel}>Avaliação</Text>
          </View>
        </View>

        {/* Active jobs */}
        {active.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Em andamento</Text>
            {active.map((o: any) => (
              <Pressable key={o.order_id} testID={`active-job-${o.order_id}`} style={s.activeCard} onPress={() => router.push(`/(provider)/job/${o.order_id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={s.activeName}>{o.service_name}</Text>
                  <Text style={[s.activeStatus, { color: statusColor(o.status, colors) }]}>{STATUS_LABEL[o.status]}</Text>
                </View>
                <Text style={s.activePay}>{brl(o.pricing?.provider_payout)}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </>
        )}

        {/* Incoming requests */}
        <Text style={s.sectionTitle}>Novos pedidos</Text>
        {incomingQ.isLoading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : incoming.length === 0 ? (
          <View style={s.emptyIncoming}>
            <Ionicons name="notifications-outline" size={28} color={colors.muted} />
            <Text style={s.emptyText}>{online ? "Aguardando novos pedidos..." : "Fique online para receber pedidos"}</Text>
          </View>
        ) : (
          incoming.map((o: any) => (
            <View key={o.order_id} style={s.requestCard} testID={`incoming-${o.order_id}`}>
              <View style={s.requestHead}>
                <View style={s.reqIcon}><Ionicons name="cube" size={22} color={colors.onBrandPrimary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reqName}>{o.service_name}</Text>
                  <Text style={s.reqAddr} numberOfLines={1}>{o.address?.neighborhood} · {o.provider_distance_km ?? "?"} km</Text>
                </View>
                <Text style={s.reqPay}>{brl(o.pricing?.provider_payout)}</Text>
              </View>
              <View style={s.reqActions}>
                <Button testID={`decline-${o.order_id}`} label="Recusar" variant="outline" style={{ flex: 1 }} onPress={() => respond(o.order_id, "decline")} />
                <Button testID={`accept-${o.order_id}`} label="Aceitar" style={{ flex: 2 }} onPress={() => respond(o.order_id, "accept")} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  onlinePill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 13, fontWeight: "700" },
  warnBanner: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.warning, borderRadius: radius.md, padding: spacing.md },
  warnTitle: { fontSize: 15, fontWeight: "800", color: c.onWarning },
  warnSub: { fontSize: 12, color: c.onWarning, opacity: 0.9 },
  availCard: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg },
  availTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  availSub: { fontSize: 13, color: c.muted },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", gap: 2 },
  statValue: { fontSize: 17, fontWeight: "800", color: c.onSurface },
  statLabel: { fontSize: 11, color: c.muted },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: c.onSurface, marginTop: spacing.sm },
  activeCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  activeName: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  activeStatus: { fontSize: 13, fontWeight: "700" },
  activePay: { fontSize: 15, fontWeight: "800", color: c.onBrandTertiary },
  emptyIncoming: { alignItems: "center", gap: spacing.sm, padding: spacing.xl, backgroundColor: c.surfaceSecondary, borderRadius: radius.md },
  emptyText: { fontSize: 13, color: c.muted },
  requestCard: { backgroundColor: c.surface, borderWidth: 2, borderColor: c.brandPrimary, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  requestHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  reqIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  reqName: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  reqAddr: { fontSize: 12, color: c.muted },
  reqPay: { fontSize: 18, fontWeight: "800", color: c.brandPrimary },
  reqActions: { flexDirection: "row", gap: spacing.sm },
}));
