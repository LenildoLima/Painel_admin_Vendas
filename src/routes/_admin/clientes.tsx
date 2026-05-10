import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Search, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_admin/clientes")({
  component: ClientesPage,
});

function ClientesPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    // Simple fetch without ordering by created_at in case the column is named differently
    const { data } = await supabase
      .from("clientes")
      .select(`
        *,
        pedidos (id, numero_pedido, total, criado_em, status)
      `);
      
    setClientes(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = clientes.filter((c) => {
    if (!q) return true;
    const hay = `${c.nome} ${c.email} ${c.telefone ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Listagem e histórico de usuários</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center">
                      <Loader2 className="inline h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!loading && filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-secondary/50"
                    onClick={() => setSelected(c)}
                  >
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell>{c.telefone || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {c.endereco || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {c.pedidos?.length || 0}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ClienteDetail cliente={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ClienteDetail({ cliente, onClose }: { cliente: any; onClose: () => void }) {
  const open = !!cliente;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Cliente</DialogTitle>
        </DialogHeader>

        {cliente && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-secondary/20 p-4">
              <h3 className="mb-2 font-display text-lg font-bold">{cliente.nome}</h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <span className="font-medium text-muted-foreground">Email:</span> {cliente.email}
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Telefone:</span>{" "}
                  {cliente.telefone || "Não informado"}
                </div>
                <div className="sm:col-span-2">
                  <span className="font-medium text-muted-foreground">Endereço Padrão:</span>{" "}
                  {cliente.endereco || "Não informado"}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-semibold">Histórico de Pedidos</h4>
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cliente.pedidos?.length > 0 ? (
                      cliente.pedidos
                        .sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
                        .map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.numero_pedido || p.id.split('-')[0]}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {p.criado_em ? format(new Date(p.criado_em), "dd/MM/yy HH:mm") : "—"}
                            </TableCell>
                            <TableCell>{p.status}</TableCell>
                            <TableCell className="text-right font-medium">
                              {Number(p.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                          Este cliente ainda não efetuou pedidos.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
