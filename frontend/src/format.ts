// Formatting + order status metadata (labels PT-BR, colors, flow steps).
import type { ThemeColors } from "@/src/theme";

export function brl(v: number | undefined | null): string {
  const n = typeof v === "number" ? v : 0;
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export const ORDER_FLOW = [
  "CREATED",
  "PRICED",
  "SEARCHING_PROVIDER",
  "PROVIDER_ASSIGNED",
  "PROVIDER_ACCEPTED",
  "PROVIDER_EN_ROUTE",
  "SERVICE_STARTED",
  "SERVICE_COMPLETED",
  "PAYMENT_CONFIRMED",
  "PAYOUT_PENDING",
  "COMPLETED",
];

export const STATUS_LABEL: Record<string, string> = {
  CREATED: "Criado",
  PRICED: "Preço calculado",
  SEARCHING_PROVIDER: "Buscando prestador",
  PROVIDER_ASSIGNED: "Prestador encontrado",
  PROVIDER_ACCEPTED: "Pedido aceito",
  PROVIDER_EN_ROUTE: "A caminho",
  SERVICE_STARTED: "Serviço iniciado",
  SERVICE_COMPLETED: "Serviço concluído",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  PAYOUT_PENDING: "Repasse pendente",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  PAYMENT_FAILED: "Pagamento recusado",
  NO_PROVIDER_FOUND: "Nenhum prestador disponível",
  DISPUTED: "Em disputa",
};

export const PROVIDER_STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Pendente",
  EM_ANALISE: "Em análise",
  VERIFICADO: "Verificado",
  SUSPENSO: "Suspenso",
  BLOQUEADO: "Bloqueado",
};

export function statusColor(status: string, colors: ThemeColors): string {
  if (["COMPLETED", "PAYMENT_CONFIRMED", "PROVIDER_ACCEPTED", "VERIFICADO"].includes(status)) return colors.success;
  if (["CANCELLED", "EXPIRED", "PAYMENT_FAILED", "NO_PROVIDER_FOUND", "DISPUTED", "BLOQUEADO", "SUSPENSO"].includes(status)) return colors.error;
  if (["SEARCHING_PROVIDER", "SERVICE_STARTED", "PROVIDER_EN_ROUTE", "PROVIDER_ASSIGNED", "PAYOUT_PENDING", "EM_ANALISE"].includes(status)) return colors.warning;
  return colors.info;
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
