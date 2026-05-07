import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import bcrypt from "bcryptjs";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/registrar")({ component: RegistrarPage });

function RegistrarPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Navigate to="/dashboard" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const emailTrim = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast.error("E-mail inválido");
      return;
    }
    if (senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe o nome");
      return;
    }

    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from("admin_users")
        .select("id")
        .eq("email", emailTrim)
        .maybeSingle();
      if (existing) throw new Error("Já existe um administrador com este e-mail");

      const { error: suErr } = await supabase.auth.signUp({
        email: emailTrim,
        password: senha,
        options: { emailRedirectTo: window.location.origin },
      });
      if (suErr && !/registered|already/i.test(suErr.message)) throw suErr;

      // Garantir sessão para passar em RLS na inserção
      await supabase.auth.signInWithPassword({ email: emailTrim, password: senha });

      const senha_hash = await bcrypt.hash(senha, 10);
      const { error: insErr } = await supabase.from("admin_users").insert({
        email: emailTrim,
        nome: nome.trim(),
        senha_hash,
        ativo: true,
      });
      if (insErr) throw insErr;

      await supabase.auth.signOut();
      toast.success("Conta criada!");
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao registrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Criar conta de Admin</CardTitle>
          <CardDescription>Registre um novo administrador</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar Senha</Label>
              <Input id="confirmar" type="password" required minLength={6} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} placeholder="Repita a senha" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Registrar
            </Button>
            <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground pt-2">
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar para login
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}