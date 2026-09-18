import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { Button, Field } from "@/src/components/ui";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ProviderOnboarding() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const profileQ = useQuery({ queryKey: ["provider-profile"], queryFn: () => api("/provider/me") });
  const servicesQ = useQuery({ queryKey: ["services"], queryFn: () => api("/services") });
  const services = servicesQ.data?.services || [];

  const [cpf, setCpf] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [pix, setPix] = useState("");
  const [radiusKm, setRadiusKm] = useState("15");
  const [categories, setCategories] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const p = profileQ.data?.profile;
    if (p) {
      setCpf(p.cpf || "");
      setBirthdate(p.birthdate || "");
      setPix(p.payout_info?.pix_key || "");
      setRadiusKm(String(p.radius_km || 15));
      setCategories(p.categories || []);
    }
  }, [profileQ.data]);

  const toggleCat = (cat: string) =>
    setCategories((c) => (c.includes(cat) ? c.filter((x) => x !== cat) : [...c, cat]));

  const submit = async () => {
    if (!cpf || !birthdate || categories.length === 0)
      return toast.show("Preencha CPF, nascimento e ao menos 1 categoria", "error");
    setSaving(true);
    try {
      await api("/provider/me", {
        method: "PUT",
        body: {
          cpf, birthdate,
          payout_info: { pix_key: pix },
          categories,
          radius_km: parseFloat(radiusKm) || 10,
          region: "curitiba",
          documents: [{ type: "RG", status: "submitted" }],
        },
      });
      queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
      toast.show("Cadastro enviado para análise!", "success");
      router.back();
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={s.header}>
        <Pressable testID="onboarding-back" onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={s.title}>Cadastro do prestador</Text>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={s.content} bottomOffset={20}>
        <Text style={s.note}>Complete seus dados para análise e verificação (simulada no MVP).</Text>

        <Field label="CPF" testID="onb-cpf" value={cpf} onChangeText={setCpf} placeholder="000.000.000-00" keyboardType="numeric" />
        <Field label="Data de nascimento" testID="onb-birth" value={birthdate} onChangeText={setBirthdate} placeholder="AAAA-MM-DD" />
        <Field label="Chave Pix (recebimento)" testID="onb-pix" value={pix} onChangeText={setPix} placeholder="email ou telefone" autoCapitalize="none" />
        <Field label="Raio de atendimento (km)" testID="onb-radius" value={radiusKm} onChangeText={setRadiusKm} keyboardType="numeric" />

        <Text style={s.fieldLabel}>Categorias de atuação</Text>
        <View style={s.chips}>
          {services.map((svc: any) => {
            const on = categories.includes(svc.category);
            return (
              <Pressable key={svc.service_id} testID={`cat-${svc.category}`} onPress={() => toggleCat(svc.category)}
                style={[s.chip, on && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                <Ionicons name={svc.icon} size={16} color={on ? colors.onBrandPrimary : colors.brandPrimary} />
                <Text style={[s.chipText, on && { color: colors.onBrandPrimary }]}>{svc.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Button testID="onboarding-submit-button" label="Enviar para análise" onPress={submit} loading={saving} style={{ marginTop: spacing.md }} />
        <View style={{ height: insets.bottom + spacing.xl }} />
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: c.surfaceSecondary },
  title: { fontSize: 20, fontWeight: "800", color: c.onSurface },
  content: { padding: spacing.lg, gap: spacing.md },
  note: { fontSize: 13, color: c.muted, lineHeight: 18 },
  fieldLabel: { fontSize: 15, fontWeight: "700", color: c.onSurface, marginTop: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 42, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.border },
  chipText: { fontSize: 14, fontWeight: "700", color: c.onSurface },
}));
