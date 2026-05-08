import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, type Categoria, type Produto } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2, Loader2, Camera, Upload } from "lucide-react";

export const Route = createFileRoute("/_admin/produtos")({ component: ProdutosPage });

const fmt = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Mode = { type: "create" } | { type: "edit"; produto: Produto } | { type: "view"; produto: Produto } | null;

function ProdutosPage() {
  const [items, setItems] = useState<Produto[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>(null);
  const [confirmDel, setConfirmDel] = useState<Produto | null>(null);

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      supabase.from("produtos")
        .select("id, nome, descricao, categoria_id, preco, imagem_url, quantidade_estoque, ativo, criado_em")
        .order("criado_em", { ascending: false }),
      supabase.from("categorias").select("id,nome,ativo").eq("ativo", true).order("nome"),
    ]);
    if (p.error) toast.error(p.error.message);
    setItems((p.data as Produto[]) ?? []);
    setCats((c.data as Categoria[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.nome.toLowerCase().includes(s));
  }, [items, q]);

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.nome ?? "—";

  const handleDelete = async () => {
    if (!confirmDel) return;
    const { error } = await supabase.from("produtos").delete().eq("id", confirmDel.id);
    if (error) return toast.error(error.message);
    toast.success("Produto removido");
    setConfirmDel(null);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground text-sm">Gerencie o catálogo de produtos</p>
        </div>
        <Button onClick={() => setMode({ type: "create" })}><Plus className="h-4 w-4 mr-2" /> Novo Produto</Button>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Imagem</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                )}
                {!loading && filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.imagem_url ? (
                        <img src={p.imagem_url} alt={p.nome} className="h-10 w-10 rounded object-cover bg-muted" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{catName(p.categoria_id)}</TableCell>
                    <TableCell>{fmt(Number(p.preco))}</TableCell>
                    <TableCell>
                      <span className={p.quantidade_estoque <= 5 ? "text-yellow-300" : ""}>{p.quantidade_estoque}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.ativo ? "bg-green-500/20 text-green-300 border-green-500/40" : "bg-muted text-muted-foreground"}>
                        {p.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => setMode({ type: "view", produto: p })}><Eye className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setMode({ type: "edit", produto: p })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmDel(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhum produto</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ProdutoFormDialog mode={mode} cats={cats} onClose={() => setMode(null)} onSaved={() => { setMode(null); load(); }} />

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir <b>{confirmDel?.nome}</b>? Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProdutoFormDialog({ mode, cats, onClose, onSaved }: { mode: Mode; cats: Categoria[]; onClose: () => void; onSaved: () => void }) {
  const open = !!mode;
  const isView = mode?.type === "view";
  const initial = mode && mode.type !== "create" ? mode.produto : null;
  const [form, setForm] = useState<Partial<Produto>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? { ...initial }
        : { nome: "", descricao: "", preco: 0, quantidade_estoque: 0, ativo: true, categoria_id: cats[0]?.id ?? null, imagem_url: "" }
    );
  }, [open, mode]);

  const set = <K extends keyof Produto>(k: K, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.error("Por favor, selecione um arquivo de imagem.");
    }

    setBusy(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from("produtos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("produtos")
        .getPublicUrl(filePath);

      set("imagem_url", publicUrl);
      toast.success("Imagem carregada com sucesso!");
    } catch (error: any) {
      console.error("ERRO UPLOAD:", error);
      toast.error("Falha no upload: " + (error.message || "Verifique as permissões do bucket 'produtos'"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!form.nome?.trim()) return toast.error("Nome obrigatório");
    setBusy(true);
    const payload = {
      nome: form.nome,
      descricao: form.descricao ?? null,
      categoria_id: form.categoria_id || null,
      preco: Number(form.preco) || 0,
      imagem_url: form.imagem_url || null,
      quantidade_estoque: Number(form.quantidade_estoque) || 0,
      ativo: !!form.ativo,
    };
    const res = initial
      ? await supabase.from("produtos").update(payload).eq("id", initial.id)
      : await supabase.from("produtos").insert(payload);
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(initial ? "Produto atualizado" : "Produto criado");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isView ? "Detalhes do Produto" : initial ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          <DialogDescription className="sr-only">Formulário para gerenciar informações do produto no catálogo.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-4">
            <Label>Imagem do Produto</Label>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="h-32 min-w-[8rem] rounded-lg border-2 border-dashed border-border bg-muted flex items-center justify-center overflow-hidden relative">
                {form.imagem_url ? (
                  <img src={form.imagem_url} alt="Preview" className="h-full w-full object-cover" onError={(e) => { (e.target as any).src = "https://placehold.co/400?text=Indisponivel"; }} />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                    <Plus className="h-6 w-6" />
                    <span className="text-[10px] mt-1 uppercase font-bold">Sem Imagem</span>
                  </div>
                )}
                {busy && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              
              {!isView && (
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <label className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md cursor-pointer hover:bg-primary/90 transition-colors text-sm font-medium">
                    <Upload className="h-4 w-4" />
                    Carregar Imagem
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                  
                  <label className="flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:bg-secondary/80 transition-colors text-sm font-medium">
                    <Camera className="h-4 w-4" />
                    Tirar Foto
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                  </label>
                  
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">URL da Imagem</p>
                    <Input value={form.imagem_url ?? ""} readOnly placeholder="Gerado automaticamente..." className="font-mono text-[10px] h-8 bg-muted/50" />
                  </div>
                </div>
              )}

              {isView && (
                <div className="flex-1 w-full space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-tight">URL da Imagem</p>
                  <Input value={form.imagem_url ?? ""} readOnly className="font-mono text-xs bg-muted/50" />
                </div>
              )}
            </div>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label>Nome</Label>
            <Input value={form.nome ?? ""} disabled={isView} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Descrição</Label>
            <Textarea value={form.descricao ?? ""} disabled={isView} onChange={(e) => set("descricao", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.categoria_id ?? undefined} onValueChange={(v) => set("categoria_id", v)} disabled={isView}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Preço (R$)</Label>
            <Input type="number" step="0.01" value={form.preco ?? 0} disabled={isView} onChange={(e) => set("preco", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Estoque</Label>
            <Input type="number" value={form.quantidade_estoque ?? 0} readOnly className="bg-muted/50" />
            <p className="text-[10px] text-yellow-500 italic">Atualizar em Entrada de Produtos</p>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={!!form.ativo} disabled={isView} onCheckedChange={(v) => set("ativo", v)} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{isView ? "Fechar" : "Cancelar"}</Button>
          {!isView && <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}