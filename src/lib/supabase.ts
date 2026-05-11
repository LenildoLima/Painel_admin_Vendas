import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type AdminUser = {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
};

export type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  preco: number;
  preco_promocional: number | null;
  imagem_url: string | null;
  quantidade_estoque: number;
  ativo: boolean;
  criado_em: string;
};

export type Categoria = { id: string; nome: string; ativo: boolean };

export type Pedido = {
  id: string;
  numero_pedido: string;
  cliente_id?: string;
  clientes?: {
    nome: string;
    telefone: string | null;
    email: string | null;
    endereco: string | null;
  };
  observacoes_cliente: string | null;
  status: string;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  total: number;
  metodo_pagamento: string | null;
  status_pagamento: string | null;
  criado_em: string;
  data_entrega: string | null;
  hora_entrega: string | null;
  observacoes_entrega: string | null;
  cancelado_em?: string | null;
  cancelado_por?: string | null;
};

export type ItemPedido = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

export const PEDIDO_STATUSES = [
  "Pendente",
  "Em Preparação",
  "Pronto",
  "Entregue",
  "Cancelado",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  Pendente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  "Em Preparação": "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Pronto: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  Entregue: "bg-green-500/20 text-green-300 border-green-500/40",
  Cancelado: "bg-red-500/20 text-red-300 border-red-500/40",
};