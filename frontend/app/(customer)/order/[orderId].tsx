import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { BitsMap } from "@/src/components/map";
import { Button } from "@/src/components/ui";
import { brl, ORDER_FLOW, STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const CUSTOMER_CANCELLABLE = [
  "CREATED", "PRICED", "SEARCHING_PROVIDER", "PROVIDER_ASSIGNED",
  "PROVIDER_ACCEPTED", "PROVIDER_EN_ROUTE", "NO_PROVIDER_FOUND",
];

export default function OrderTracking() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();

  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const q = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api(`/orders/${orderId}`),
    refetchInterval: 4000,
  });
  const order = q.data?.order;

  const act = async (fn: () => Promise<any>, okMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      await q.refetch();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (okMsg) toast.show(okMsg, "success");
    } catch (e: any) {
      toast.show(e.message || "Falha na ação", "error");
    } finally {
      setBusy(false);
    }
  };

  if (q.isLoading || !order) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  const currentIdx = ORDER_FLOW.indexOf(order.status);
  const markers: any[] = [{ ...order.location, kind: "customer" }];
  if (order.provider?.current_location) markers.push({ ...order.provider.current_location, kind: "provider" });

  const canCancel = CUSTOMER_CANCELLABLE.includes(order.status);
  const canPay = order.status === "SERVICE_COMPLETED" || order.status === "PAYMENT_FAILED";
  const canReview = order.status === "COMPLETED" && !order.review;

  return (
    <View style={s.root}>
      <View style={s.mapWrap}>
        <BitsMap center={order.location} markers={markers} interactive={false} />
        <Pressable testID="order-back" onPress={() => router.replace("/(customer)/(tabs)/home")} style={[s.backBtn, { top: insets.top + spacing.sm }]}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={s.sheet}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.statusHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.serviceName}>{order.service_name}</Text>
              <Text style={[s.statusText, { color: statusColor(order.status, colors) }]}>
                {STATUS_LABEL[order.status]}
              </Text>
            </View>
            <Text style={s.price}>{brl(order.price_total)}</Text>
          </View>

          {order.status === "SEARCHING_PROVIDER" && (
            <View style={s.searching}>
              <ActivityIndicator color={colors.brandPrimary} />
              <Text style={s.searchingText}>Procurando prestadores próximos...</Text>
            </View>
          )}

          {order.status === "NO_PROVIDER_FOUND" && (
            <View style={[s.searching, { backgroundColor: colors.error + "18" }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[s.searchingText, { color: colors.error }]}>Nenhum prestador disponível no momento.</Text>
            </View>
          )}

          {/* Provider card */}
          {order.provider && (
            <View style={s.providerCard} testID="provider-card">
              <View style={s.avatar}>
                <Ionicons name="person" size={26} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.providerName}>{order.provider.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="star" size={14} color={colors.warning} />
                  <Text style={s.providerRating}>{(order.provider.rating_avg || 0).toFixed(1)}</Text>
                  {order.provider_distance_km != null && (
                    <Text style={s.providerDist}> · {order.provider_distance_km} km</Text>
                  )}
                </View>
              </View>
              <Ionicons name="call" size={22} color={colors.brandPrimary} />
            </View>
          )}

          {/* Timeline */}
          <Text style={s.sectionTitle}>Acompanhamento</Text>
          <View style={s.timeline}>
            {ORDER_FLOW.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <View key={step} style={s.timelineRow}>
                  <View style={s.timelineLeft}>
                    <View style={[s.dot, done && { backgroundColor: colors.success }, active && { backgroundColor: colors.brandPrimary }]}>
                      {done && <Ionicons name="checkmark" size={12} color={colors.onSuccess} />}
                    </View>
                    {i < ORDER_FLOW.length - 1 && <View style={[s.connector, (done) && { backgroundColor: colors.success }]} />}
                  </View>
                  <Text style={[s.timelineLabel, active && { color: colors.onSurface, fontWeight: "800" }, done && { color: colors.onSurfaceSecondary }]}>
                    {STATUS_LABEL[step]}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Payment */}
          {canPay && (
            <View style={s.actionCard}>
              <Text style={s.sectionTitle}>Pagamento</Text>
              <Text style={s.payHint}>Serviço concluído. Confirme o pagamento de {brl(order.price_total)}.</Text>
              <Button testID="pay-button" label="Pagar com Pix" icon="qr-code" loading={busy}
                onPress={() => act(() => api(`/orders/${orderId}/pay`, { method: "POST", body: { method: "pix", outcome: "approved" } }), "Pagamento confirmado")} />
              <Pressable testID="pay-decline" onPress={() => act(() => api(`/orders/${orderId}/pay`, { method: "POST", body: { method: "card", outcome: "declined" } }))}>
                <Text style={s.simulateText}>Simular pagamento recusado</Text>
              </Pressable>
            </View>
          )}

          {/* Review */}
          {canReview && (
            <View style={s.actionCard} testID="review-card">
              <Text style={s.sectionTitle}>Avalie o prestador</Text>
              <View style={s.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} testID={`star-${n}`} onPress={() => setRating(n)} hitSlop={6}>
                    <Ionicons name={n <= rating ? "star" : "star-outline"} size={34} color={colors.warning} />
                  </Pressable>
                ))}
              </View>
              <TextInput testID="review-comment" value={comment} onChangeText={setComment} placeholder="Comentário (opcional)"
                placeholderTextColor={colors.muted} style={s.reviewInput} multiline />
              <Button testID="submit-review-button" label="Enviar avaliação" loading={busy}
                onPress={() => act(() => api(`/orders/${orderId}/review`, { method: "POST", body: { rating, comment } }), "Obrigado pela avaliação!")} />
            </View>
          )}

          {order.review && (
            <View style={s.actionCard}>
              <Text style={s.sectionTitle}>Sua avaliação</Text>
              <View style={{ flexDirection: "row" }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Ionicons key={n} name={n <= order.review.rating ? "star" : "star-outline"} size={20} color={colors.warning} />
                ))}
              </View>
              {!!order.review.comment && <Text style={s.reviewComment}>{order.review.comment}</Text>}
            </View>
          )}

          {canCancel && (
            <Button testID="cancel-order-button" label="Cancelar pedido" variant="outline" loading={busy}
              onPress={() => act(() => api(`/orders/${orderId}/cancel`, { method: "POST" }), "Pedido cancelado")} />
          )}
          <View style={{ height: insets.bottom + spacing.lg }} />
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  mapWrap: { height: "32%", backgroundColor: c.surfaceSecondary },
  backBtn: { position: "absolute", left: spacing.lg, width: 40, height: 40, borderRadius: radius.sm, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },
  sheet: { flex: 1, backgroundColor: c.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, marginTop: -22 },
  content: { padding: spacing.lg, gap: spacing.md },
  statusHeader: { flexDirection: "row", alignItems: "center" },
  serviceName: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  statusText: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  price: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  searching: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: c.brandTertiary, padding: spacing.md, borderRadius: radius.md },
  searchingText: { fontSize: 14, color: c.onBrandTertiary, fontWeight: "600", flex: 1 },
  providerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, padding: spacing.md, borderRadius: radius.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  providerName: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  providerRating: { fontSize: 13, color: c.onSurfaceSecondary, fontWeight: "600" },
  providerDist: { fontSize: 13, color: c.muted },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  timelineLeft: { alignItems: "center", width: 24 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  connector: { width: 2, height: 22, backgroundColor: c.surfaceTertiary },
  timelineLabel: { fontSize: 14, color: c.muted, paddingTop: 1, flex: 1 },
  actionCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  payHint: { fontSize: 14, color: c.onSurfaceSecondary },
  simulateText: { fontSize: 13, color: c.muted, textAlign: "center", paddingVertical: spacing.xs },
  stars: { flexDirection: "row", gap: spacing.xs, justifyContent: "center" },
  reviewInput: { minHeight: 60, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, color: c.onSurface, backgroundColor: c.surface, textAlignVertical: "top" },
  reviewComment: { fontSize: 14, color: c.onSurfaceSecondary, fontStyle: "italic" },
}));
