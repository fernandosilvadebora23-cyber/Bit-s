import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { useToast } from "@/src/components/toast";
import { Button, Field } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";

export default function Register() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const toast = useToast();
  const router = useRouter();

  const [role, setRole] = useState<"customer" | "provider">("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name || !email || !phone || password.length < 6)
      return toast.show("Preencha todos os campos (senha mín. 6)", "error");
    setLoading(true);
    try {
      await register({ name, email, phone, password, role });
      toast.show("Conta criada com sucesso!", "success");
    } catch (e: any) {
      toast.show(e.message || "Falha no cadastro", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={s.topbar}>
        <Pressable testID="register-back" onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 15 }}>Voltar</Text>
        </Pressable>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={s.content} bottomOffset={20}>
        <Text style={s.title}>Criar conta</Text>
        <Text style={s.subtitle}>Escolha como deseja usar a Bit-s</Text>

        <View style={s.roleRow}>
          {(["customer", "provider"] as const).map((r) => (
            <Pressable
              key={r}
              testID={`role-${r}`}
              onPress={() => setRole(r)}
              style={[s.roleCard, role === r && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
            >
              <Text style={[s.roleTitle, role === r && { color: colors.onBrandTertiary }]}>
                {r === "customer" ? "Sou Cliente" : "Sou Prestador"}
              </Text>
              <Text style={s.roleDesc}>
                {r === "customer" ? "Contratar serviços" : "Trabalhar e ganhar"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.form}>
          <Field label="Nome completo" testID="reg-name" value={name} onChangeText={setName} placeholder="Seu nome" />
          <Field label="E-mail" testID="reg-email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" />
          <Field label="Telefone" testID="reg-phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+55 41 90000-0000" />
          <Field label="Senha" testID="reg-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="mínimo 6 caracteres" />
          <Button testID="register-submit-button" label="Cadastrar" onPress={submit} loading={loading} />
          {role === "provider" && (
            <Text style={s.note}>
              Após o cadastro você completará seu perfil e passará por verificação antes de receber pedidos.
            </Text>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  topbar: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  content: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "800", color: c.onSurface },
  subtitle: { fontSize: 14, color: c.muted, marginTop: -spacing.sm },
  roleRow: { flexDirection: "row", gap: spacing.md },
  roleCard: { flex: 1, borderWidth: 1.5, borderColor: c.border, borderRadius: 16, padding: spacing.lg, gap: 4 },
  roleTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  roleDesc: { fontSize: 12, color: c.muted },
  form: { gap: spacing.md },
  note: { fontSize: 12, color: c.muted, lineHeight: 18 },
}));
