import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase, PEDIDO_STATUSES, STATUS_COLORS, type Pedido, type ItemPedido } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, MessageCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_admin/pedidos")({ component: PedidosPage });

const fmt = (n: number) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PedidosPage() {
  const [items, setItems] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Pedido | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("pedidos").select("*").order("criado_em", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Pedido[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel("pedidos_page")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload: any) => {
          setItems((current) => [payload.new as Pedido, ...current]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload: any) => {
          setItems((current) =>
            current.map((item) => (item.id === payload.new.id ? (payload.new as Pedido) : item))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (from && new Date(p.criado_em) < new Date(from)) return false;
      if (to && new Date(p.criado_em) > new Date(to + "T23:59:59")) return false;
      if (s) {
        const hay = `${p.numero_pedido} ${p.cliente_nome} ${p.cliente_telefone ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, q, statusFilter, from, to]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <p className="text-muted-foreground text-sm">Gerencie pedidos e entregas</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nº, cliente, telefone..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {PEDIDO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>
                )}
                {!loading && filtered.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-secondary/50" onClick={() => setSelected(p)}>
                    <TableCell className="font-mono text-xs">{p.numero_pedido}</TableCell>
                    <TableCell>{p.cliente_nome}</TableCell>
                    <TableCell className="text-muted-foreground">{p.cliente_telefone}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(p.criado_em), "dd/MM/yy HH:mm")}</TableCell>
                    <TableCell>{fmt(Number(p.total))}</TableCell>
                    <TableCell><Badge variant="outline" className={STATUS_COLORS[p.status] ?? ""}>{p.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Nenhum pedido</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PedidoDetail pedido={selected} onClose={() => setSelected(null)} onUpdated={() => { load(); }} />
    </div>
  );
}
function PedidoDetail({ pedido, onClose, onUpdated }: { pedido: Pedido | null; onClose: () => void; onUpdated: () => void }) {
  const open = !!pedido;
  const [itens, setItens] = useState<(ItemPedido & { produtos: { nome: string; imagem_url: string | null } | null })[]>([]);
  const [status, setStatus] = useState<string>("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    setStatus(pedido.status);
    setDataEntrega(pedido.data_entrega ?? "");
    setHoraEntrega(pedido.hora_entrega ?? "");
    setObs(pedido.observacoes_entrega ?? "");
    
    // Query com join para obter nome e imagem do produto
    supabase
      .from("itens_pedido")
      .select("*, produtos(nome, imagem_url)")
      .eq("pedido_id", pedido.id)
      .then(({ data }) => {
        setItens((data as any) ?? []);
      });
  }, [pedido]);

  const save = async () => {
    if (!pedido) return;
    setBusy(true);
    const { error } = await supabase.from("pedidos").update({
      status,
      data_entrega: dataEntrega || null,
      hora_entrega: horaEntrega || null,
      observacoes_entrega: obs || null,
    }).eq("id", pedido.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pedido atualizado");
    onUpdated();
    onClose();
  };

  const whatsappHref = pedido?.cliente_telefone
    ? `https://wa.me/55${pedido.cliente_telefone.replace(/\D/g, "")}`
    : "#";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Pedido <span className="font-mono text-sm">{pedido?.numero_pedido}</span>
            {pedido && <Badge variant="outline" className={STATUS_COLORS[pedido.status] ?? ""}>{pedido.status}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {pedido && (
          <div className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Cliente</div>
                <div className="font-medium">{pedido.cliente_nome}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Telefone</div>
                <div className="flex items-center gap-2">
                  <span>{pedido.cliente_telefone ?? "—"}</span>
                  {pedido.cliente_telefone && (
                    <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-400 hover:underline">
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-muted-foreground">Endereço</div>
                <div>{[pedido.cliente_endereco, pedido.cliente_bairro, pedido.cliente_cidade].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              {pedido.observacoes_cliente && (
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Observações do cliente</div>
                  <div>{pedido.observacoes_cliente}</div>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-20">Qtd</TableHead>
                    <TableHead className="w-28 text-right">Unit.</TableHead>
                    <TableHead className="w-28 text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {i.produtos?.imagem_url && (
                            <img src={i.produtos.imagem_url} alt={i.produtos.nome} className="h-8 w-8 rounded object-cover bg-secondary" />
                          )}
                          <span className="font-medium">{i.produtos?.nome ?? "Produto removido"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{i.quantidade}</TableCell>
                      <TableCell className="text-right">{fmt(Number(i.preco_unitario))}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(Number(i.subtotal))}</TableCell>
                    </TableRow>
                  ))}
                  {itens.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem itens registrados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-1 text-sm items-end pr-4">
              <div className="flex w-full max-w-[200px] justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{fmt(Number(pedido.subtotal))}</span>
              </div>
              <div className="flex w-full max-w-[200px] justify-between">
                <span className="text-muted-foreground">Taxa Entrega:</span>
                <span>{fmt(Number(pedido.taxa_entrega))}</span>
              </div>
              <div className="flex w-full max-w-[200px] justify-between font-bold text-lg pt-1 border-t border-border mt-1 text-primary">
                <span>Total:</span>
                <span>{fmt(Number(pedido.total))}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 border-t border-border pt-5">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Em Preparação">Em Preparação</SelectItem>
                    <SelectItem value="Pronto">Pronto</SelectItem>
                    <SelectItem value="Entregue">Entregue</SelectItem>
                    <SelectItem value="Cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Previsão de Entrega (Data)</Label>
                <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Previsão de Entrega (Hora)</Label>
                <Input type="time" value={horaEntrega} onChange={(e) => setHoraEntrega(e.target.value)} />
              </div>
              <div className="sm:col-span-3 space-y-1.5">
                <Label>Observações Internas / Entrega</Label>
                <Textarea 
                  value={obs} 
                  onChange={(e) => setObs(e.target.value)} 
                  placeholder="Instruções para o entregador ou observações internas..."
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}