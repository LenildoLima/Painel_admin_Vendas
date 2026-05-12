import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function populate() {
  console.log("Populating table 'formas_pagamento'...");
  const formas = [
    { nome: 'PIX', ativo: true },
    { nome: 'Débito', ativo: true },
    { nome: 'Crédito', ativo: true },
    { nome: 'Dinheiro', ativo: true }
  ];
  
  const { data, error } = await supabase
    .from('formas_pagamento')
    .upsert(formas, { onConflict: 'nome' })
    .select();
    
  if (error) {
    console.error("ERROR populating:", error);
  } else {
    console.log("POPULATED SUCCESSFULLY:", JSON.stringify(data, null, 2));
  }
}

populate();
