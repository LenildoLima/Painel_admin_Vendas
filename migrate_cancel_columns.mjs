/**
 * Migration: adiciona colunas de cancelamento à tabela pedidos
 * 
 * Execute com: node migrate_cancel_columns.mjs
 * Requer: SUPABASE_SERVICE_ROLE_KEY no ambiente ou troque abaixo
 */
const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
// Cole a service role key do Supabase Dashboard > Settings > API > service_role
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "COLE_AQUI";

const sql = `
ALTER TABLE public.pedidos 
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por text;
`;

const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  },
  body: JSON.stringify({ query: sql }),
});

if (res.ok) {
  console.log("✅ Migração aplicada com sucesso!");
} else {
  const body = await res.text();
  console.error("❌ Erro:", res.status, body);
  console.log("\n💡 Alternativa: execute o SQL abaixo diretamente no Supabase Dashboard > SQL Editor:");
  console.log(sql);
}
