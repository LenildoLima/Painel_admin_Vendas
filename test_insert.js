import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("Attempting manual test insert...");
  const testNum = "TEST-" + Date.now();
  
  const { data, error } = await supabase
    .from("pedidos")
    .insert([{
      numero_pedido: testNum,
      forma_pagamento: "PIX",
      metodo_pagamento: "PIX",
      status: "Pendente",
      total: 1.00,
      subtotal: 1.00
    }])
    .select()
    .single();
    
  if (error) {
    console.error("INSERT_ERROR:", error);
  } else {
    console.log("INSERT_SUCCESS:", JSON.stringify(data, null, 2));
  }
}

testInsert();
