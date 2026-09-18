import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { Screen } from "@/src/components/screen";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

function Stepper({ value, onChange, step = 1, min = 0, max = 9999, suffix, testID }: any) {
  const s = useStepper();
  const { colors } = useTheme();
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <View style={s.wrap}>
      <Pressable testID={`${testID}-dec`} style={s.btn} onPress={() => set(value - step)}>
        <Ionicons name="remove" size={18} color={colors.onSurface} />
      </Pressable>
      <Text style={s.value} testID={testID}>{value}{suffix || ""}</Text>
      <Pressable testID={`${testID}-inc`} style={s.btn} onPress={() => set(value + step)}>
        <Ionicons name="add" size={18} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}
const useStepper = makeStyles((c) => ({
  wrap: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
  btn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  value: { minWidth: 56, textAlign: "center", fontSize: 15, fontWeight: "800", color: c.onSurface },
}));

export default function AdminSettings() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const settingsQ = useQuery({ queryKey: ["admin-settings"], queryFn: () => api("/admin/settings") });
  const servicesQ = useQuery({ queryKey: ["admin-services"], queryFn: () => api("/admin/services") });
  const cfg = settingsQ.data?.settings;
  const services = servicesQ.data?.services || [];

  const patch = async (p: any, msg?: string) => {
    try {
      await api("/admin/settings", { method: "PATCH", body: { patch: p } });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      if (msg) toast.show(msg, "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    }
  };

  const toggleService = async (id: string) => {
    await api(`/admin/services/${id}/toggle`, { method: "POST" });
    queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  if (!cfg) {
    return <Screen title="Ajustes"><View /></Screen>;
  }

  return (
    <Screen title="Ajustes" subtitle="Parâmetros operacionais">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={settingsQ.isFetching} onRefresh={settingsQ.refetch} tintColor={colors.brandPrimary} />}>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Comissão da plataforma</Text>
          <View style={s.row}>
            <Text style={s.label}>Taxa ({Math.round((cfg.commission?.rate || 0) * 100)}%)</Text>
            <Stepper testID="commission-rate" value={Math.round((cfg.commission?.rate || 0) * 100)} step={1} min={8} max={15} suffix="%"
              onChange={(v: number) => patch({ commission: { rate: v / 100 } })} />
          </View>
          <Text style={s.hint}>Faixa permitida: 8% a 15%</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Deslocamento</Text>
          <View style={s.row}>
            <Text style={s.label}>Preço por km</Text>
            <Stepper testID="price-per-km" value={cfg.price_per_km || 0} step={0.5} min={0} max={20}
              onChange={(v: number) => patch({ price_per_km: v })} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Precificação dinâmica</Text>
          <View style={s.row}>
            <Text style={s.label}>Ativada</Text>
            <Switch testID="dynamic-enabled" value={!!cfg.dynamic_pricing?.enabled}
              onValueChange={(v) => patch({ dynamic_pricing: { enabled: v } }, "Atualizado")}
              trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
          </View>
          <View style={s.row}>
            <Text style={s.label}>Fator máximo</Text>
            <Stepper testID="max-factor" value={cfg.dynamic_pricing?.max_factor || 1} step={0.1} min={1} max={3}
              onChange={(v: number) => patch({ dynamic_pricing: { max_factor: v } })} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Matching</Text>
          <View style={s.row}>
            <Text style={s.label}>Raio inicial (km)</Text>
            <Stepper testID="radius-initial" value={cfg.matching?.radius_initial_km || 5} step={1} min={1} max={50}
              onChange={(v: number) => patch({ matching: { radius_initial_km: v } })} />
          </View>
          <View style={s.row}>
            <Text style={s.label}>Raio máximo (km)</Text>
            <Stepper testID="radius-max" value={cfg.matching?.radius_max_km || 25} step={5} min={5} max={100}
              onChange={(v: number) => patch({ matching: { radius_max_km: v } })} />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Serviços ativos</Text>
          {services.map((svc: any) => (
            <View key={svc.service_id} style={s.row}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Ionicons name={svc.icon} size={18} color={colors.brandPrimary} />
                <Text style={s.label}>{svc.name}</Text>
              </View>
              <Switch testID={`service-toggle-${svc.service_id}`} value={!!svc.active} onValueChange={() => toggleService(svc.service_id)}
                trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} thumbColor={colors.surface} />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  section: { backgroundColor: c.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, color: c.onSurface, fontWeight: "600" },
  hint: { fontSize: 12, color: c.muted },
}));
