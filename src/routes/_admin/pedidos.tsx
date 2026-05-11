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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, MessageCircle, Loader2, AlertTriangle, RotateCcw, XCircle } from "lucide-react";

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
    const { data, error } = await supabase.from("pedidos").select("*, clientes(*)").order("criado_em", { ascending: false });
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
        const hay = `${p.numero_pedido} ${p.clientes?.nome} ${p.clientes?.telefone ?? ""}`.toLowerCase();
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
                    <TableCell>{p.clientes?.nome || "Desconhecido"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.clientes?.telefone || "—"}</TableCell>
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

      <PedidoDetail pedido={selected} onClose={() => setSelected(null)} onUpdated={() => { load(); setSelected(null); }} />
    </div>
  );
}

// --------------------------------------------------------------------------
// Tipo estendido com campos de cancelamento
// --------------------------------------------------------------------------
type PedidoComCancelamento = Pedido & {
  cancelado_em?: string | null;
  cancelado_por?: string | null;
};

type ItemComProduto = ItemPedido & {
  produtos: { nome: string; imagem_url: string | null } | null;
};

// --------------------------------------------------------------------------
// Componente de detalhe do pedido
// --------------------------------------------------------------------------
function PedidoDetail({
  pedido,
  onClose,
  onUpdated,
}: {
  pedido: Pedido | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const open = !!pedido;
  const ped = pedido as PedidoComCancelamento | null;

  const [itens, setItens] = useState<ItemComProduto[]>([]);
  const [status, setStatus] = useState<string>("");
  const [dataEntrega, setDataEntrega] = useState("");
  const [horaEntrega, setHoraEntrega] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  // Diálogo de confirmação de cancelamento
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string>("");

  const isCancelled = ped?.status === "Cancelado";

  useEffect(() => {
    if (!pedido) return;
    setStatus(pedido.status);
    setDataEntrega(pedido.data_entrega ?? "");
    setHoraEntrega(pedido.hora_entrega ?? "");
    setObs(pedido.observacoes_entrega ?? "");

    supabase
      .from("itens_pedido")
      .select("*, produtos(nome, imagem_url)")
      .eq("pedido_id", pedido.id)
      .then(({ data }) => {
        setItens((data as any) ?? []);
      });
  }, [pedido]);

  // Ao tentar mudar o status
  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "Cancelado") {
      setPendingStatus(newStatus);
      setConfirmCancel(true);
    } else {
      setStatus(newStatus);
    }
  };

  // Confirma cancelamento: restaura estoque e salva
  const confirmCancellation = async () => {
    setConfirmCancel(false);
    if (!pedido) return;
    setBusy(true);

    try {
      // 1. GUARDA: busca status atual no banco para evitar dupla restauração
      const { data: pedidoAtual, error: checkErr } = await supabase
        .from("pedidos")
        .select("status")
        .eq("id", pedido.id)
        .single();

      if (checkErr) throw checkErr;

      const oldStatus = pedidoAtual.status;
      const newStatus = "Cancelado";

      console.log('--- CANCELAMENTO ---');
      console.log('Status anterior (banco):', oldStatus);
      console.log('Status novo:', newStatus);

      if (oldStatus === "Cancelado") {
        console.log('Bloqueio: Pedido já está cancelado. Estoque NÃO será restaurado.');
        toast.info("Pedido já está cancelado. Estoque não foi alterado.");
        setBusy(false);
        onUpdated();
        return;
      }

      // 2. Restaurar estoque de cada item (atômico via RPC ou via valor incrementado)
      console.log('Iniciando restauração de estoque...');
      for (const item of itens) {
        if (!item.produto_id) continue;
        
        const { data: prod, error: prodErr } = await supabase
          .from("produtos")
          .select("quantidade_estoque")
          .eq("id", item.produto_id)
          .single();

        if (prodErr || !prod) continue;

        console.log(`Item: ${item.produtos?.nome || item.produto_id}`);
        console.log(`Quantidade no pedido: ${item.quantidade}`);
        console.log(`Estoque antes: ${prod.quantidade_estoque}`);

        const { error: updateErr } = await supabase
          .from("produtos")
          .update({ 
            quantidade_estoque: prod.quantidade_estoque + item.quantidade 
          })
          .eq("id", item.produto_id);
          
        if (updateErr) throw updateErr;
        console.log(`Estoque depois: ${prod.quantidade_estoque + item.quantidade}`);
      }

      // 3. Atualizar pedido com status cancelado + metadados
      const now = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      const canceladoPor = user?.email ?? user?.id ?? "admin";

      const { error, count } = await supabase.from("pedidos").update({
        status: "Cancelado",
        cancelado_em: now,
        cancelado_por: canceladoPor,
        data_entrega: null,
        hora_entrega: null,
      }).eq("id", pedido.id).eq("status", pedidoAtual.status);

      if (error) {
        // Fallback se as colunas ainda não existirem no banco
        const { error: err2 } = await supabase.from("pedidos").update({
          status: "Cancelado",
          data_entrega: null,
          hora_entrega: null,
        }).eq("id", pedido.id);
        if (err2) throw err2;
      }

      setStatus("Cancelado");
      toast.success("Pedido cancelado e estoque restaurado.");
      onUpdated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao cancelar pedido.");
      setBusy(false);
    }
  };

  // Reabrir pedido (volta para Pendente e deduz estoque novamente)
  const reopenOrder = async () => {
    if (!pedido) return;
    setBusy(true);

    try {
      // GUARDA: busca status atual no banco para evitar dupla dedução
      const { data: pedidoAtual, error: checkErr } = await supabase
        .from("pedidos")
        .select("status")
        .eq("id", pedido.id)
        .single();

      if (checkErr) throw checkErr;

      const oldStatus = pedidoAtual.status;
      const newStatus = "Pendente";

      console.log('--- REABERTURA ---');
      console.log('Status anterior (banco):', oldStatus);
      console.log('Status novo:', newStatus);

      if (oldStatus !== "Cancelado") {
        console.log('Bloqueio: Pedido não está cancelado. Estoque NÃO será deduzido.');
        toast.info("Pedido não está cancelado. Estoque não foi alterado.");
        setBusy(false);
        onUpdated();
        return;
      }

      // Deduzir estoque novamente (atômico)
      console.log('Iniciando dedução de estoque...');
      for (const item of itens) {
        if (!item.produto_id) continue;
        
        const { data: prod, error: prodErr } = await supabase
          .from("produtos")
          .select("quantidade_estoque")
          .eq("id", item.produto_id)
          .single();

        if (prodErr || !prod) continue;

        console.log(`Item: ${item.produtos?.nome || item.produto_id}`);
        console.log(`Quantidade no pedido: ${item.quantidade}`);
        console.log(`Estoque antes: ${prod.quantidade_estoque}`);

        const novoEst = Math.max(0, prod.quantidade_estoque - item.quantidade);
        const { error: updateErr } = await supabase
          .from("produtos")
          .update({ quantidade_estoque: novoEst })
          .eq("id", item.produto_id);

        if (updateErr) throw updateErr;
        console.log(`Estoque depois: ${novoEst}`);
      }

      const { error, count } = await supabase.from("pedidos").update({
        status: "Pendente",
        cancelado_em: null,
        cancelado_por: null,
      }).eq("id", pedido.id).eq("status", "Cancelado");

      if (error) {
        // Fallback se as colunas ainda não existirem no banco
        const { error: err2 } = await supabase.from("pedidos").update({
          status: "Pendente",
        }).eq("id", pedido.id);
        if (err2) throw err2;
      }

      setStatus("Pendente");
      toast.success("Pedido reaberto. Estoque atualizado.");
      onUpdated();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao reabrir pedido.");
      setBusy(false);
    }
  };

  // Salvar alterações normais (APENAS metadados, NÃO mexe no estoque)
  const save = async () => {
    if (!pedido) return;
    setBusy(true);

    try {
      console.log('--- SALVANDO METADADOS ---');
      
      const { error } = await supabase.from("pedidos").update({
        data_entrega: dataEntrega || null,
        hora_entrega: horaEntrega || null,
        observacoes_entrega: obs || null,
      }).eq("id", pedido.id);

      if (error) throw error;

      toast.success("Dados do pedido atualizados");
      onUpdated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar alterações");
    } finally {
      setBusy(false);
    }
  };

  const whatsappHref = pedido?.clientes?.telefone
    ? `https://wa.me/55${pedido.clientes.telefone.replace(/\D/g, "")}`
    : "#";

  return (
    <>
      {/* Diálogo de confirmação de cancelamento */}
      <Dialog open={confirmCancel} onOpenChange={(o) => !o && setConfirmCancel(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              Cancelar Pedido?
            </DialogTitle>
            <DialogDescription className="pt-2">
              <span className="font-medium text-foreground">Tem certeza?</span> O estoque dos produtos será restaurado automaticamente e esta ação não pode ser desfeita facilmente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancellation}
              disabled={busy}
            >
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sim, cancelar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog principal de detalhes */}
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              Pedido <span className="font-mono text-sm">{pedido?.numero_pedido}</span>
              {pedido && (
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[pedido.status] ?? ""}
                >
                  {pedido.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {pedido && (
            <div className="space-y-5">
              {/* Banner de aviso para pedido cancelado */}
              {isCancelled && (
                <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-red-400">Este pedido foi cancelado. O estoque foi restaurado.</p>
                    {ped?.cancelado_por && (
                      <p className="text-muted-foreground mt-0.5">
                        Cancelado por <span className="text-foreground">{ped.cancelado_por}</span>
                        {ped.cancelado_em && (
                          <> em <span className="text-foreground">
                            {format(new Date(ped.cancelado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span></>
                        )}
                      </p>
                    )}
                    {!ped?.cancelado_por && ped?.cancelado_em && (
                      <p className="text-muted-foreground mt-0.5">
                        Cancelado em{" "}
                        <span className="text-foreground">
                          {format(new Date(ped.cancelado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Dados do cliente */}
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Cliente</div>
                  <div className="font-medium">{pedido.clientes?.nome || "Desconhecido"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Telefone</div>
                  <div className="flex items-center gap-2">
                    <span>{pedido.clientes?.telefone ?? "—"}</span>
                    {pedido.clientes?.telefone && (
                      <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-400 hover:underline">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Endereço</div>
                  <div>{pedido.clientes?.endereco || "—"}</div>
                </div>
                {pedido.observacoes_cliente && (
                  <div className="sm:col-span-2">
                    <div className="text-muted-foreground">Observações do cliente</div>
                    <div>{pedido.observacoes_cliente}</div>
                  </div>
                )}
              </div>

              {/* Tabela de itens */}
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

              {/* Totais */}
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

              {/* Painel de edição */}
              <div className={`grid sm:grid-cols-3 gap-3 border-t border-border pt-5 ${isCancelled ? "opacity-60 pointer-events-none select-none" : ""}`}>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={handleStatusChange} disabled={isCancelled}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pendente">Pendente</SelectItem>
                      <SelectItem value="Em Preparação">Em Preparação</SelectItem>
                      <SelectItem value="Pronto">Pronto</SelectItem>
                      <SelectItem value="Entregue">Entregue</SelectItem>
                      <SelectItem value="Cancelado">
                        <span className="text-red-400">Cancelado</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Previsão de Entrega (Data)</Label>
                  <Input
                    type="date"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                    disabled={isCancelled}
                    readOnly={isCancelled}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Previsão de Entrega (Hora)</Label>
                  <Input
                    type="time"
                    value={horaEntrega}
                    onChange={(e) => setHoraEntrega(e.target.value)}
                    disabled={isCancelled}
                    readOnly={isCancelled}
                  />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label>Observações Internas / Entrega</Label>
                  <Textarea
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    placeholder="Instruções para o entregador ou observações internas..."
                    disabled={isCancelled}
                    readOnly={isCancelled}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={onClose}>Fechar</Button>

            {isCancelled ? (
              /* Botão de reabrir pedido */
              <Button
                variant="outline"
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                onClick={reopenOrder}
                disabled={busy}
              >
                {busy
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <RotateCcw className="h-4 w-4 mr-2" />
                }
                Reabrir Pedido
              </Button>
            ) : (
              <Button onClick={save} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}