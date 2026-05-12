import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking order PED-20260511-010...");
  const { data, error } = await supabase
    .from("pedidos")
    .select("id, numero_pedido, forma_pagamento")
    .eq("numero_pedido", "PED-20260511-010")
    .maybeSingle();
    
  if (error) {
    console.error("DEBUG_ERROR:", error);
  } else {
    console.log("DEBUG_ORDER_DATA:", JSON.stringify(data, null, 2));
  }
}

check();
