import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { BitsMark } from "@/src/components/logo";
import { BitsMap } from "@/src/components/map";
import { Button } from "@/src/components/ui";
import { brl, STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

const CURITIBA = { lat: -25.4284, lng: -49.2733 };
const ACTIVE_HIDDEN = ["COMPLETED", "CANCELLED", "EXPIRED"];

export default function CustomerHome() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);

  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => api("/services") });
  const addressesQ = useQuery({ queryKey: ["addresses"], queryFn: () => api("/me/addresses") });
  const ordersQ = useQuery({ queryKey: ["orders"], queryFn: () => api("/orders"), refetchInterval: 8000 });

  const services = servicesQ.data?.services || [];
  const addresses = addressesQ.data?.addresses || [];
  const defaultAddr = addresses.find((a: any) => a.is_default) || addresses[0];
  const activeOrders = (ordersQ.data?.orders || []).filter((o: any) => !ACTIVE_HIDDEN.includes(o.status));

  const center = defaultAddr?.location || CURITIBA;
  const markers = useMemo(() => (defaultAddr?.location ? [{ ...defaultAddr.location, kind: "customer" as const }] : []), [defaultAddr]);

  const go = (serviceId: string) => router.push({ pathname: "/(customer)/request", params: { serviceId } });

  return (
    <View style={s.root}>
      {/* Map background */}
      <View style={s.mapWrap}>
        <BitsMap center={center} markers={markers} interactive={false} />
        {/* Address bar */}
        <View style={[s.addressBar, { top: insets.top + spacing.sm }]}>
          <Pressable
            testID="address-selector"
            style={s.addressInner}
            onPress={() => router.push("/(customer)/(tabs)/profile")}
          >
            <View style={s.pin}>
              <Ionicons name="location" size={18} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.addressLabel}>Endereço</Text>
              <Text style={s.addressValue} numberOfLines={1}>
                {defaultAddr ? `${defaultAddr.street}, ${defaultAddr.number} · ${defaultAddr.neighborhood}` : "Adicionar endereço"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </View>
        <View style={s.brandBadge}>
          <BitsMark size={18} />
          <Text style={s.brandText}>Bit-s</Text>
        </View>
      </View>

      {/* Content sheet */}
      <View style={s.sheet}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.sheetContent}>
          {activeOrders.length > 0 && (
            <Pressable
              testID="active-order-banner"
              style={s.activeBanner}
              onPress={() => router.push(`/(customer)/order/${activeOrders[0].order_id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.activeTitle}>{activeOrders[0].service_name} em andamento</Text>
                <Text style={[s.activeStatus, { color: statusColor(activeOrders[0].status, colors) }]}>
                  {STATUS_LABEL[activeOrders[0].status]}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.onBrandPrimary} />
            </Pressable>
          )}

          <Button
            testID="chamar-button"
            label="CHAMAR"
            icon="flash"
            disabled={!selected}
            onPress={() => selected && go(selected)}
            style={{ height: 60 }}
          />
          <Text style={s.hint}>
            {selected ? `Serviço selecionado: ${services.find((x: any) => x.service_id === selected)?.name}` : "Escolha um serviço abaixo"}
          </Text>

          <Text style={s.sectionTitle}>Serviços disponíveis</Text>
          <View style={{ gap: spacing.sm }}>
            {services.map((svc: any) => {
              const on = selected === svc.service_id;
              return (
                <Pressable
                  key={svc.service_id}
                  testID={`service-${svc.service_id}`}
                  onPress={() => setSelected(svc.service_id)}
                  onLongPress={() => go(svc.service_id)}
                  style={[s.serviceRow, on && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                >
                  <View style={[s.serviceIcon, on && { backgroundColor: colors.brandPrimary }]}>
                    <Ionicons name={svc.icon} size={24} color={on ? colors.onBrandPrimary : colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceName}>{svc.name}</Text>
                    <Text style={s.serviceDesc} numberOfLines={1}>{svc.description}</Text>
                  </View>
                  <Pressable testID={`service-go-${svc.service_id}`} hitSlop={10} onPress={() => go(svc.service_id)}>
                    <Ionicons name="arrow-forward-circle" size={28} color={colors.brandPrimary} />
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  mapWrap: { height: "40%", backgroundColor: c.surfaceSecondary },
  addressBar: { position: "absolute", left: spacing.lg, right: spacing.lg },
  addressInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    paddingRight: spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pin: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  addressLabel: { fontSize: 11, color: c.muted, fontWeight: "600" },
  addressValue: { fontSize: 14, color: c.onSurface, fontWeight: "600" },
  brandBadge: { position: "absolute", bottom: spacing.xl, right: spacing.lg, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  brandText: { fontWeight: "800", color: c.onSurface },
  sheet: {
    flex: 1,
    backgroundColor: c.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    marginTop: -22,
  },
  sheetContent: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  activeBanner: { flexDirection: "row", alignItems: "center", backgroundColor: c.brandPrimary, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  activeTitle: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 15 },
  activeStatus: { fontWeight: "700", fontSize: 13, marginTop: 2 },
  hint: { fontSize: 13, color: c.muted, textAlign: "center", marginBottom: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface, marginTop: spacing.sm },
  serviceRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1.5, borderColor: c.border, borderRadius: radius.md, padding: spacing.md },
  serviceIcon: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  serviceName: { fontSize: 16, fontWeight: "700", color: c.onSurface },
  serviceDesc: { fontSize: 12, color: c.muted },
}));
