import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type Produto } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Loader2, FileText, Camera, Trash2, Eye, Pencil } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_admin/entrada-produtos")({ component: EntradaProdutosPage });

type EntradaProduto = {
  id: string;
  produto_id: string;
  quantidade: number;
  data_entrada: string;
  observacoes: string | null;
  arquivo_nota_url: string | null;
  criado_em: string;
  produtos: { nome: string; imagem_url: string | null } | null;
};

function EntradaProdutosPage() {
  const [items, setItems] = useState<EntradaProduto[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    produto_id: "",
    quantidade: "",
    data_entrada: format(new Date(), "yyyy-MM-dd"),
    observacoes: "",
    arquivo_nota_url: "",
  });

  const load = async () => {
    setLoading(true);
    const [p, e] = await Promise.all([
      supabase.from("produtos").select("*").order("nome"),
      supabase.from("entrada_produtos").select("*, produtos(nome, imagem_url)").order("data_entrada", { ascending: false }),
    ]);
    
    if (e.error) toast.error(e.error.message);
    setProdutos((p.data as Produto[]) ?? []);
    setItems((e.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBusy(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `notas/${fileName}`;

      const { data, error } = await supabase.storage
        .from("arquivos") // Tentando usar um bucket genérico "arquivos"
        .upload(filePath, file);

      if (error) {
        // Se falhar o Storage, tenta base64 como fallback conforme solicitado
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData(prev => ({ ...prev, arquivo_nota_url: reader.result as string }));
          setBusy(false);
          toast.info("Arquivo carregado como base64 (Storage indisponível)");
        };
        reader.readAsDataURL(file);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("arquivos").getPublicUrl(filePath);
        setFormData(prev => ({ ...prev, arquivo_nota_url: publicUrl }));
        setBusy(false);
        toast.success("Arquivo enviado com sucesso!");
      }
    } catch (err) {
      setBusy(false);
      toast.error("Erro ao processar arquivo");
    }
  };

  const handleSave = async () => {
    if (!formData.produto_id) return toast.error("Selecione um produto");
    if (!formData.quantidade || Number(formData.quantidade) <= 0) return toast.error("Quantidade inválida");
    if (!formData.data_entrada) return toast.error("Data obrigatória");

    setBusy(true);
    console.log("INICIANDO SALVAMENTO DE ENTRADA:", formData);

    try {
      // 1. Buscar estoque atual para garantir consistência
      const { data: prod, error: errFetch } = await supabase
        .from("produtos")
        .select("quantidade_estoque, nome")
        .eq("id", formData.produto_id)
        .single();

      if (errFetch) {
        console.error("ERRO BUSCA PRODUTO:", errFetch);
        throw new Error("Erro ao buscar estoque atual: " + errFetch.message);
      }

      const qEntrada = Number(formData.quantidade);
      const qAtual = Number(prod.quantidade_estoque || 0);
      const novaQtde = qAtual + qEntrada;

      console.log(`PRODUTO: ${prod.nome} | ATUAL: ${qAtual} | ENTRADA: ${qEntrada} | NOVA: ${novaQtde}`);

      // 2. Inserir registro na tabela entrada_produtos
      const { error: errEntrada } = await supabase.from("entrada_produtos").insert({
        produto_id: formData.produto_id,
        quantidade: qEntrada,
        data_entrada: formData.data_entrada,
        observacoes: formData.observacoes || null,
        arquivo_nota_url: null, // Removido campo de arquivo
      });

      if (errEntrada) {
        console.error("ERRO INSERIR ENTRADA:", errEntrada);
        throw new Error("Erro ao registrar entrada: " + errEntrada.message);
      }

      // 3. Executar UPDATE na tabela produtos para aumentar o estoque
      console.log("EXECUTANDO UPDATE NO PRODUTO ID:", formData.produto_id);
      const { data: updateData, error: errStock } = await supabase
        .from("produtos")
        .update({ quantidade_estoque: novaQtde })
        .eq("id", formData.produto_id)
        .select();

      if (errStock) {
        console.error("ERRO UPDATE ESTOQUE:", errStock);
        throw new Error("Erro ao atualizar estoque: " + errStock.message);
      }

      if (!updateData || updateData.length === 0) {
        console.warn("UPDATE EXECUTADO MAS NENHUMA LINHA AFETADA (Pode ser RLS)");
        throw new Error("A atualização do estoque falhou. Verifique as permissões (RLS).");
      }

      console.log("ESTOQUE ATUALIZADO COM SUCESSO!", updateData);

      // 4. Registrar no histórico de estoque
      await supabase.from("historico_estoque").insert({
        produto_id: formData.produto_id,
        quantidade: qEntrada,
        tipo_movimento: "Entrada",
        observacoes: `Entrada: ${formData.observacoes || "Sem obs."}`,
      });

      toast.success(`Estoque atualizado: ${novaQtde} unidades`);
      setOpenForm(false);
      setFormData({
        produto_id: "",
        quantidade: "",
        data_entrada: format(new Date(), "yyyy-MM-dd"),
        observacoes: "",
        arquivo_nota_url: "",
      });
      load();
    } catch (error: any) {
      console.error("FALHA CRÍTICA NA ENTRADA:", error);
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: EntradaProduto) => {
    const ok = window.confirm(`Tem certeza que deseja excluir esta entrada?\nO estoque do produto será reduzido em ${item.quantidade}.`);
    if (!ok) return;

    setBusy(true);
    try {
      // 1. Buscar estoque atual para reversão
      const { data: prod, error: errFetch } = await supabase
        .from("produtos")
        .select("quantidade_estoque")
        .eq("id", item.produto_id)
        .single();

      if (errFetch) throw new Error("Erro ao buscar estoque para estorno");

      const novaQtde = Math.max(0, Number(prod.quantidade_estoque) - Number(item.quantidade));

      // 2. Reverter estoque
      const { error: errStock } = await supabase
        .from("produtos")
        .update({ quantidade_estoque: novaQtde })
        .eq("id", item.produto_id);

      if (errStock) throw new Error("Erro ao atualizar estoque");

      // 3. Excluir o registro de entrada
      const { error: errDel } = await supabase
        .from("entrada_produtos")
        .delete()
        .eq("id", item.id);

      if (errDel) throw errDel;

      toast.success("Entrada removida e estoque ajustado!");
      load();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => 
      i.produtos?.nome.toLowerCase().includes(s) || 
      i.observacoes?.toLowerCase().includes(s)
    );
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Entrada de Produtos</h1>
          <p className="text-muted-foreground text-sm">Registre a chegada de novas mercadorias no estoque</p>
        </div>
        <Button onClick={() => setOpenForm(true)}><Plus className="h-4 w-4 mr-2" /> Nova Entrada</Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por produto ou ref..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="hidden md:block rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-24">Qtd</TableHead>
                  <TableHead className="w-32">Data</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                )}
                {!loading && filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {item.produtos?.imagem_url ? (
                          <img src={item.produtos.imagem_url} alt={item.produtos.nome} className="h-8 w-8 rounded object-cover bg-muted" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted" />
                        )}
                        <span className="font-medium">{item.produtos?.nome ?? "Removido"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-green-400">+{item.quantidade}</TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(item.data_entrada), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{item.observacoes || "—"}</TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => toast.info("Edição em breve")}><Pencil className="h-4 w-4" /></Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(item)}
                        disabled={busy}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">Nenhuma entrada registrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Versão Mobile (Cards) */}
          <div className="md:hidden flex flex-col gap-4 mt-2">
            {loading && <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>}
            {!loading && filtered.map((item) => (
              <div key={item.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3 relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.produtos?.imagem_url ? (
                      <img src={item.produtos.imagem_url} alt={item.produtos.nome} className="h-10 w-10 min-w-10 rounded object-cover bg-muted" />
                    ) : (
                      <div className="h-10 w-10 min-w-10 rounded bg-muted flex items-center justify-center text-xs">Sem Img</div>
                    )}
                    <span className="font-bold text-base line-clamp-1">{item.produtos?.nome ?? "Removido"}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-2 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-xs">Quantidade:</span>
                    <span className="font-mono font-bold text-green-500 text-base">+{item.quantidade}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Data:</span>
                    <span className="font-semibold">{format(new Date(item.data_entrada), "dd/MM/yyyy")}</span>
                  </div>
                </div>
                
                {item.observacoes && (
                  <div>
                    <span className="text-muted-foreground block text-xs">Observações:</span>
                    <p className="text-sm border-l-2 border-border pl-2 mt-1">{item.observacoes}</p>
                  </div>
                )}
                
                <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                  <Button size="sm" variant="ghost" className="flex-1 h-9" onClick={() => toast.info("Edição em breve")}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1 h-9 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(item)} disabled={busy}>
                    <Trash2 className="h-4 w-4 mr-2" /> Menos
                  </Button>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="text-center text-muted-foreground py-10 bg-muted/20 rounded-xl">Nenhuma entrada</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto p-4 sm:p-6 pt-10">
          <DialogHeader>
            <DialogTitle>Registrar Entrada de Estoque</DialogTitle>
            <DialogDescription>Preencha os dados abaixo para atualizar o estoque do produto.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base sm:text-sm">Produto</Label>
              <Select value={formData.produto_id} onValueChange={(v) => setFormData(p => ({ ...p, produto_id: v }))}>
                <SelectTrigger className="h-12 sm:h-10 text-base"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                <SelectContent>
                  {produtos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (Estoque: {p.quantidade_estoque})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-base sm:text-sm">Quantidade</Label>
                <Input className="h-12 sm:h-10 text-base" type="number" min="1" value={formData.quantidade} onChange={(e) => setFormData(p => ({ ...p, quantidade: e.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label className="text-base sm:text-sm">Data de Entrada</Label>
                <Input className="h-12 sm:h-10 text-base" type="date" value={formData.data_entrada} onChange={(e) => setFormData(p => ({ ...p, data_entrada: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base sm:text-sm">Observações</Label>
              <Textarea className="min-h-[100px] text-base" value={formData.observacoes} onChange={(e) => setFormData(p => ({ ...p, observacoes: e.target.value }))} placeholder="Ex: NF 123, fornecedor X..." />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-3 sm:gap-2">
            <Button className="h-12 sm:h-10 w-full sm:w-auto" variant="outline" onClick={() => setOpenForm(false)} disabled={busy}>Cancelar</Button>
            <Button className="h-12 sm:h-10 w-full sm:w-auto text-base sm:text-sm" onClick={handleSave} disabled={busy}>
              {busy ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Plus className="h-5 w-5 md:h-4 md:w-4 mr-2" />}
              Salvar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
