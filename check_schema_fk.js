import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking columns of table 'pedidos'...");
  const { data: pedidosCols, error: err1 } = await supabase.rpc('get_column_names', { table_name: 'pedidos' });
  // If RPC is missing, we try a fallback check via a sample select
  const { data: samplePedido } = await supabase.from('pedidos').select('*').limit(1);
  console.log("PEDIDOS COLUMNS:", Object.keys(samplePedido?.[0] || {}));

  console.log("\nChecking table 'formas_pagamento'...");
  const { data: formas, error: err2 } = await supabase.from('formas_pagamento').select('*');
  if (err2) {
    console.error("ERROR fetching formas_pagamento:", err2);
  } else {
    console.log("FORMAS_PAGAMENTO DATA:", JSON.stringify(formas, null, 2));
  }
}

check();
