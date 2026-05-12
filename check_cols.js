import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://odjjonyhrbdppgljbpfq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kampvbnlocmJkcHBnbGpicGZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMTU2MjMsImV4cCI6MjA5MzY5MTYyM30.70xd2GX28koDJrUN6FDZKSHR1xEdUmjHhCSrkMb7mlc";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking columns of table 'pedidos'...");
  // Using direct SQL might not work through supabase-js for info_schema
  // But we can try to select all columns from a single row and check keys
  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .limit(1)
    .single();
    
  if (error) {
    console.error("DEBUG_ERROR:", error);
  } else {
    console.log("COLUMNS FOUND:", Object.keys(data));
  }
}

check();
