import { supabase } from "../lib/supabase";
import bcrypt from "bcryptjs";

export async function signInWithAdminUsers(email: string, passwordInput: string) {
  // Busca o usuário pelo e-mail
  const { data, error } = await supabase
    .from("admin_users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Erro na consulta de admin_users:", error);
    throw new Error("Erro ao processar login");
  }

  if (!data) {
    throw new Error("Email ou senha inválidos");
  }

  // Compara a senha informada com o hash salvo no banco
  let passwordMatch = false;
  try {
    passwordMatch = bcrypt.compareSync(passwordInput, data.senha_hash);
  } catch (e) {
    // ignorar erro do bcrypt se nao for um hash valido
  }

  // Fallback para senha em texto plano (caso inserido manualmente no banco)
  if (!passwordMatch && passwordInput === data.senha_hash) {
    passwordMatch = true;
  }

  if (!passwordMatch) {
    throw new Error("Email ou senha inválidos");
  }

  // Gera um token simples (base64 do email + timestamp)
  const token = btoa(`${email}:${Date.now()}`);

  return { user: data, token };
}
