import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking triggers on table 'pedidos'...");
  // We can't run arbitrary SQL on info schema easily via supabase-js unless exposed via REST
  // But maybe we can guess if there is a 'handle_new_order' function or similar
  // Let's try to fetch a very old order to see if it ALWAYS was null.
  
  const { data, error } = await supabase
    .from("pedidos")
    .select("numero_pedido, forma_pagamento, metodo_pagamento, criado_em")
    .order("criado_em", { ascending: true })
    .limit(5);
    
  if (error) {
    console.error("DEBUG_ERROR:", error);
  } else {
    console.log("HISTORY_DATA:", JSON.stringify(data, null, 2));
  }
}

check();
