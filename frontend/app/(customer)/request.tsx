import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { Button } from "@/src/components/ui";
import { brl } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function RequestScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();

  const serviceQ = useQuery({ queryKey: ["service", serviceId], queryFn: () => api(`/services/${serviceId}`) });
  const addressesQ = useQuery({ queryKey: ["addresses"], queryFn: () => api("/me/addresses") });
  const service = serviceQ.data?.service;
  const addresses = addressesQ.data?.addresses || [];
  const defaultAddr = addresses.find((a: any) => a.is_default) || addresses[0];

  const [params, setParams] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (service && Object.keys(params).length === 0) {
      const init: Record<string, any> = {};
      for (const f of service.request_fields || []) {
        init[f.key] = f.type === "multiselect" ? [] : f.default ?? (f.type === "number" ? 0 : "");
      }
      setParams(init);
    }
  }, [service]);

  const quoteQ = useQuery({
    queryKey: ["quote", serviceId, params, defaultAddr?.address_id],
    queryFn: () =>
      api("/orders/quote", {
        method: "POST",
        auth: false,
        body: { service_id: serviceId, params, location: defaultAddr?.location || null },
      }),
    enabled: !!service && Object.keys(params).length > 0,
  });
  const quote = quoteQ.data;

  const setField = (key: string, value: any) => setParams((p) => ({ ...p, [key]: value }));
  const toggleMulti = (key: string, value: string) =>
    setParams((p) => {
      const arr: string[] = p[key] || [];
      return { ...p, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });

  const submit = async () => {
    if (!defaultAddr) return toast.show("Adicione um endereço no seu perfil", "error");
    setSubmitting(true);
    try {
      const res = await api("/orders", {
        method: "POST",
        body: {
          service_id: serviceId,
          address: defaultAddr,
          params,
          notes,
          photos: [],
        },
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const oid = res.order.order_id;
      router.replace(`/(customer)/order/${oid}`);
    } catch (e: any) {
      toast.show(e.message || "Falha ao solicitar", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (serviceQ.isLoading || !service) {
    return (
      <View style={[s.root, s.centered]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="request-back" onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{service.name}</Text>
          <Text style={s.headerSub}>Detalhes do serviço</Text>
        </View>
        <View style={s.headerIcon}>
          <Ionicons name={service.icon} size={22} color={colors.brandPrimary} />
        </View>
      </View>

      <KeyboardAwareScrollView contentContainerStyle={s.content} bottomOffset={140}>
        {(service.request_fields || []).map((f: any) => (
          <View key={f.key} style={s.fieldBlock}>
            <Text style={s.fieldLabel}>{f.label}</Text>
            {f.type === "number" && (
              <View style={s.stepper}>
                <Pressable
                  testID={`dec-${f.key}`}
                  style={s.stepBtn}
                  onPress={() => setField(f.key, Math.max(f.min ?? 0, (params[f.key] || 0) - 1))}
                >
                  <Ionicons name="remove" size={22} color={colors.onSurface} />
                </Pressable>
                <Text style={s.stepValue} testID={`val-${f.key}`}>{params[f.key] ?? 0}</Text>
                <Pressable testID={`inc-${f.key}`} style={s.stepBtn} onPress={() => setField(f.key, (params[f.key] || 0) + 1)}>
                  <Ionicons name="add" size={22} color={colors.onSurface} />
                </Pressable>
              </View>
            )}
            {f.type === "select" && (
              <View style={s.chipRow}>
                {f.options.map((o: any) => {
                  const on = params[f.key] === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      testID={`opt-${f.key}-${o.value}`}
                      onPress={() => setField(f.key, o.value)}
                      style={[s.chip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                    >
                      <Text style={[s.chipText, on && { color: colors.onBrandPrimary }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {f.type === "multiselect" && (
              <View style={s.chipRow}>
                {f.options.map((o: any) => {
                  const on = (params[f.key] || []).includes(o.value);
                  return (
                    <Pressable
                      key={o.value}
                      testID={`opt-${f.key}-${o.value}`}
                      onPress={() => toggleMulti(f.key, o.value)}
                      style={[s.chip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                    >
                      <Text style={[s.chipText, on && { color: colors.onBrandPrimary }]}>{o.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        <View style={s.fieldBlock}>
          <Text style={s.fieldLabel}>Observações</Text>
          <TextInput
            testID="request-notes"
            value={notes}
            onChangeText={setNotes}
            placeholder="Detalhes adicionais (opcional)"
            placeholderTextColor={colors.muted}
            multiline
            style={s.notes}
          />
        </View>

        {/* Price breakdown */}
        <View style={s.priceCard}>
          <View style={s.priceHeader}>
            <Text style={s.priceTitle}>Resumo do preço</Text>
            {quote?.surge && (
              <View style={s.surgeBadge}>
                <Ionicons name="trending-up" size={12} color={colors.onWarning} />
                <Text style={s.surgeText}>Alta demanda x{quote.surge_factor}</Text>
              </View>
            )}
          </View>
          {quoteQ.isFetching && !quote ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : quote ? (
            <>
              {quote.breakdown.map((b: any, i: number) => (
                <View key={i} style={s.priceLine}>
                  <Text style={s.priceLabel}>{b.label}</Text>
                  <Text style={s.priceAmount}>{brl(b.amount)}</Text>
                </View>
              ))}
              <View style={s.priceDivider} />
              <View style={s.priceLine}>
                <Text style={s.totalLabel}>Total</Text>
                <Text style={s.totalAmount} testID="quote-total">{brl(quote.total)}</Text>
              </View>
            </>
          ) : null}
        </View>
      </KeyboardAwareScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View>
          <Text style={s.footerLabel}>Total</Text>
          <Text style={s.footerTotal}>{quote ? brl(quote.total) : "--"}</Text>
        </View>
        <Button
          testID="submit-order-button"
          label="Solicitar serviço"
          onPress={submit}
          loading={submitting}
          style={{ flex: 1, marginLeft: spacing.md }}
        />
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  centered: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: c.divider },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: c.surfaceSecondary },
  headerTitle: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  headerSub: { fontSize: 13, color: c.muted },
  headerIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 },
  fieldBlock: { gap: spacing.sm },
  fieldLabel: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  stepper: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surfaceSecondary },
  stepBtn: { width: 52, height: 48, alignItems: "center", justifyContent: "center" },
  stepValue: { minWidth: 44, textAlign: "center", fontSize: 18, fontWeight: "800", color: c.onSurface },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, height: 40, justifyContent: "center", borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
  chipText: { fontSize: 14, fontWeight: "600", color: c.onSurface },
  notes: { minHeight: 80, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, color: c.onSurface, backgroundColor: c.surfaceSecondary, textAlignVertical: "top" },
  priceCard: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  priceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  priceTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  surgeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.warning, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  surgeText: { fontSize: 11, fontWeight: "700", color: c.onWarning },
  priceLine: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: 14, color: c.onSurfaceSecondary },
  priceAmount: { fontSize: 14, color: c.onSurface, fontWeight: "600" },
  priceDivider: { height: 1, backgroundColor: c.border, marginVertical: spacing.xs },
  totalLabel: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  totalAmount: { fontSize: 18, fontWeight: "800", color: c.brandPrimary },
  footer: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.divider, backgroundColor: c.surface },
  footerLabel: { fontSize: 12, color: c.muted },
  footerTotal: { fontSize: 20, fontWeight: "800", color: c.onSurface },
}));
