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
    let { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && /invalid/i.test(error.message)) {
      // Auto-provision admin on first use (admin_users seeded after)
      const { error: suErr } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (suErr) throw suErr;
      const retry = await supabase.auth.signInWithPassword({ email, password });
      error = retry.error;
    }
    if (error) throw error;
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("id, ativo")
      .eq("email", email)
      .maybeSingle();
    if (!adminRow) {
      await supabase.from("admin_users").insert({ email, nome: email.split("@")[0], ativo: true });
    } else if (adminRow.ativo === false) {
      await supabase.auth.signOut();
      throw new Error("Usuário administrador desativado.");
    }
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