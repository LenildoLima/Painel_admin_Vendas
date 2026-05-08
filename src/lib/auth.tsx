import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { signInWithAdminUsers } from "../api/auth";

type AuthCtx = {
  token: string | null;
  loading: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("admin_token");
    if (savedToken) {
      try {
        const decoded = atob(savedToken);
        const [savedEmail] = decoded.split(":");
        setToken(savedToken);
        setEmail(savedEmail);
      } catch (e) {
        localStorage.removeItem("admin_token");
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (emailInput: string, passwordInput: string) => {
    const { token: newToken } = await signInWithAdminUsers(emailInput, passwordInput);
    
    setToken(newToken);
    setEmail(emailInput);
    localStorage.setItem("admin_token", newToken);
  };

  const signOut = async () => {
    setToken(null);
    setEmail(null);
    localStorage.removeItem("admin_token");
  };

  return (
    <Ctx.Provider value={{ token, loading, email, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}