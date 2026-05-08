import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, UserPlus, ArrowLeft } from "lucide-react";
import bcrypt from "bcryptjs";

export const Route = createFileRoute("/cadastro")({ component: CadastroPage });

function CadastroPage() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!nome.trim() || nome.length > 150) return toast.error("Nome inválido (máx 150 caracteres)");
    if (!validateEmail(email)) return toast.error("E-mail com formato inválido");
    if (password.length < 6) return toast.error("Senha deve ter no mínimo 6 caracteres");
    if (password !== confirmPassword) return toast.error("As senhas não coincidem");

    setBusy(true);
    try {
      // 1. Verificar e-mail duplicado
      const { count, error: checkError } = await supabase
        .from("admin_users")
        .select("*", { count: "exact", head: true })
        .eq("email", email.trim());

      if (checkError) throw checkError;
      if (count && count > 0) {
        toast.error("Email já cadastrado");
        setBusy(false);
        return;
      }

      // 2. Hash da senha
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(password, salt);

      // 3. Inserir usuário
      const { error: insertError } = await supabase
        .from("admin_users")
        .insert({
          email: email.trim(),
          senha_hash: hash,
          nome: nome.trim(),
          ativo: true
        });

      if (insertError) throw insertError;

      toast.success("Conta criada com sucesso!");
      
      // Delay de 2 segundos para o toast ser visto
      setTimeout(() => {
        navigate({ to: "/login" });
      }, 2000);

    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao criar conta");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 py-12">
      <Card className="w-full max-w-md border-border/60 bg-card">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Criar Nova Conta</CardTitle>
          <CardDescription>Preencha os dados para se tornar um administrador</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <Input 
                id="nome" 
                required 
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
                placeholder="Seu nome" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="admin@exemplo.com" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  minLength={6} 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input 
                  id="confirm-password" 
                  type="password" 
                  required 
                  minLength={6} 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••" 
                />
              </div>
            </div>
            <Button type="submit" className="w-full mt-6" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} 
              Criar Conta
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border mt-2 pt-4">
          <Link to="/login" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
