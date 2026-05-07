import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase, STATUS_COLORS, type Pedido } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CheckCircle2, DollarSign, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_admin/dashboard")({ component: Dashboard });

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Dashboard() {
  const [stats, setStats] = useState({ pendentes: 0, entreguesHoje: 0, fatDia: 0, fatMes: 0 });
  const [recent, setRecent] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
      const isoDay = startOfDay.toISOString();
      const isoMonth = startOfMonth.toISOString();

      const [pendQ, entrQ, dayQ, monthQ, recentQ] = await Promise.all([
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "Pendente"),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "Entregue").gte("atualizado_em", isoDay),
        supabase.from("pedidos").select("total").gte("criado_em", isoDay).neq("status", "Cancelado"),
        supabase.from("pedidos").select("total").gte("criado_em", isoMonth).neq("status", "Cancelado"),
        supabase.from("pedidos").select("*").order("criado_em", { ascending: false }).limit(5),
      ]);

      const sum = (rows: any[] | null) => (rows ?? []).reduce((a, r) => a + Number(r.total ?? 0), 0);
      setStats({
        pendentes: pendQ.count ?? 0,
        entreguesHoje: entrQ.count ?? 0,
        fatDia: sum(dayQ.data),
        fatMes: sum(monthQ.data),
      });
      setRecent((recentQ.data as Pedido[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Pedidos Pendentes", value: stats.pendentes, icon: Clock, tint: "text-yellow-300" },
    { label: "Entregues Hoje", value: stats.entreguesHoje, icon: CheckCircle2, tint: "text-green-300" },
    { label: "Faturamento Dia", value: fmt(stats.fatDia), icon: DollarSign, tint: "text-blue-300" },
    { label: "Faturamento Mês", value: fmt(stats.fatMes), icon: TrendingUp, tint: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral das vendas</p>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.tint}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{loading ? "—" : c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.numero_pedido}</TableCell>
                  <TableCell>{p.cliente_nome}</TableCell>
                  <TableCell>{fmt(Number(p.total))}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[p.status] ?? ""}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(p.criado_em), "dd/MM HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && recent.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem pedidos ainda</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}