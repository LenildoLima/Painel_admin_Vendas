import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // If user doesn't exist, try to sign up (admin_users table is initially empty)
      if (error.message.toLowerCase().includes("invalid")) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (signUpErr) throw signUpErr;
        // Try sign in again
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
      } else {
        throw error;
      }
    }
    // Ensure admin_users record exists
    const { data: existing } = await supabase
      .from("admin_users")
      .select("id, ativo")
      .eq("email", email)
      .maybeSingle();
    if (!existing) {
      await supabase.from("admin_users").insert({ email, nome: email.split("@")[0], ativo: true });
    } else if (existing.ativo === false) {
      await supabase.auth.signOut();
      throw new Error("Usuário desativado");
    }
    await supabase.from("admin_users").update({ ultimo_acesso: new Date().toISOString() }).eq("email", email);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, loading, email: session?.user?.email ?? null, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}