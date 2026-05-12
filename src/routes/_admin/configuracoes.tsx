import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Save, Store, Mail, Phone, QrCode, Truck, Clock } from "lucide-react";

export const Route = createFileRoute("/_admin/configuracoes")({ component: ConfiguracoesPage });

// Aplica máscara de telefone: (00) 00000-0000
function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState({
    nome_loja: "",
    email_contato: "",
    telefone_whatsapp: "",
    chave_pix: "",
    taxa_entrega_padrao: 0,
    horario_funcionamento_inicio: "08:00",
    horario_funcionamento_fim: "22:00",
  });

  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor");
      
      if (error) throw error;
      
      if (data) {
        const mapped: any = { ...config };
        data.forEach((item: any) => {
          if (item.chave === "taxa_entrega_padrao") {
            mapped[item.chave] = Number(item.valor) || 0;
          } else if (item.chave === "telefone_whatsapp") {
            mapped[item.chave] = maskPhone(item.valor || "");
          } else {
            mapped[item.chave] = item.valor || "";
          }
        });
        setConfig(mapped);
      }
    } catch (e: any) {
      toast.error("Erro ao carregar configurações: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      setBusy(true);
      
      const updates = Object.entries(config).map(([chave, valor]) => ({
        chave,
        valor: chave === "telefone_whatsapp" ? String(valor).replace(/\D/g, "") : String(valor)
      }));

      // Upsert individualmente para garantir que funcione se a tabela tiver chave como PK
      for (const item of updates) {
        const { error } = await supabase
          .from("configuracoes")
          .upsert(item, { onConflict: "chave" });
        if (error) throw error;
      }

      toast.success("Configurações salvas com sucesso!");
      load();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configurações da Loja</h1>
          <p className="text-muted-foreground text-sm">Gerencie as informações básicas e regras de negócio da sua loja</p>
        </div>
        <Button onClick={handleSave} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Alterações
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identificação */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Store className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Identificação</CardTitle>
            </div>
            <CardDescription>Nome e contatos da sua loja</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Loja</Label>
              <Input 
                value={config.nome_loja} 
                onChange={e => setConfig(prev => ({ ...prev, nome_loja: e.target.value }))}
                placeholder="Ex: Minha Loja Premium"
              />
            </div>
            <div className="space-y-2">
              <Label>Email de Contato</Label>
              <Input 
                type="email"
                value={config.email_contato} 
                onChange={e => setConfig(prev => ({ ...prev, email_contato: e.target.value }))}
                placeholder="contato@loja.com"
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp (Somente números)</Label>
              <Input 
                value={config.telefone_whatsapp} 
                onChange={e => {
                  const masked = maskPhone(e.target.value);
                  setConfig(prev => ({ ...prev, telefone_whatsapp: masked }));
                }}
                placeholder="(11) 99999-9999"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pagamento PIX */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <QrCode className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Pagamento PIX</CardTitle>
            </div>
            <CardDescription>Chave PIX para recebimentos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Chave PIX (Email, CPF/CNPJ, Tel ou Aleatória)</Label>
              <Input 
                value={config.chave_pix} 
                onChange={e => setConfig(prev => ({ ...prev, chave_pix: e.target.value }))}
                placeholder="Sua chave PIX aqui"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded-lg border">
              Esta chave será usada para gerar o QR Code dinâmico nos pedidos dos clientes.
            </p>
          </CardContent>
        </Card>

        {/* Entrega */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Entrega</CardTitle>
            </div>
            <CardDescription>Taxas e logística</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Taxa de Entrega Padrão (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={config.taxa_entrega_padrao} 
                onChange={e => setConfig(prev => ({ ...prev, taxa_entrega_padrao: Number(e.target.value) }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Funcionamento */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Funcionamento</CardTitle>
            </div>
            <CardDescription>Horários de atendimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Abertura</Label>
                <Input 
                  type="time"
                  value={config.horario_funcionamento_inicio || ""} 
                  onChange={e => setConfig(prev => ({ ...prev, horario_funcionamento_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fechamento</Label>
                <Input 
                  type="time"
                  value={config.horario_funcionamento_fim || ""} 
                  onChange={e => setConfig(prev => ({ ...prev, horario_funcionamento_fim: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
