import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Calendar as CalendarIcon, DollarSign, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_admin/vendas-balcao")({
  component: VendasBalcaoPage,
});

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function VendasBalcaoPage() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroData, setFiltroData] = useState<string>("");
  const [filtroPagamento, setFiltroPagamento] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  const loadVendas = async () => {
    setLoading(true);
    let query = supabase
      .from("vendas_balcao")
      .select("*, formas_pagamento(nome)")
      .order("criado_em", { ascending: false });

    if (filtroPagamento !== "todos") {
      query = query.filter("formas_pagamento.nome", "eq", filtroPagamento);
    }

    if (filtroData) {
      query = query.gte("criado_em", `${filtroData}T00:00:00`)
                   .lte("criado_em", `${filtroData}T23:59:59`);
    }

    const { data, error } = await query;

    if (!error) {
      setVendas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVendas();
  }, [filtroData, filtroPagamento]);

  const vendasFiltradas = vendas.filter(v => 
    v.numero_venda.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Histórico de Vendas Balcão
          </h1>
          <p className="text-muted-foreground text-sm">Visualize e filtre todas as vendas realizadas no balcão.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por Nº da Venda..."
                className="pl-9"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="flex-1"
              />
            </div>
            <Select value={filtroPagamento} onValueChange={setFiltroPagamento}>
              <SelectTrigger>
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Forma de Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Formas</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Débito">Débito</SelectItem>
                <SelectItem value="Crédito">Crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Venda</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Forma Pgto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="h-12 animate-pulse bg-muted/50" />
                    </TableRow>
                  ))
                ) : vendasFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhuma venda encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  vendasFiltradas.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-bold">{v.numero_venda}</TableCell>
                      <TableCell>
                        {format(new Date(v.criado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-bold uppercase">
                          {v.formas_pagamento?.nome || "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold text-primary">
                        {fmt(v.total)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          Finalizada
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
