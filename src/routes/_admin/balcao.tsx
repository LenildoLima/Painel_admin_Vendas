import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase, type Produto, type Pedido, type ItemPedido } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  X, 
  CheckCircle2, 
  Maximize2, 
  Minimize2, 
  Loader2,
  Clock,
  DollarSign,
  TrendingUp,
  History,
  Plus,
  Minus,
  QrCode,
  CreditCard,
  Banknote,
  Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_admin/balcao")({
  component: BalcaoPage,
});

type CartItem = {
  produto: Produto;
  quantidade: number;
};

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function generatePixPayload(params: {
  chave: string;
  valor: number;
  nome: string;
  cidade?: string;
  txid?: string;
}) {
  const { chave, valor, nome, cidade = "SAO PAULO", txid = "***" } = params;

  function formatField(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  function crc16(str: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  let payload = "000201";
  
  // Merchant Account Information
  const gui = "0014br.gov.bcb.pix";
  const keyField = formatField("01", chave.replace(/\s+/g, ""));
  payload += formatField("26", gui + keyField);

  payload += "52040000"; // Merchant Category Code
  payload += "5303986";  // Currency (986 = BRL)
  
  const valorStr = valor.toFixed(2);
  payload += formatField("54", valorStr); // Transaction Amount

  payload += "5802BR";   // Country Code

  const cleanNome = nome.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/gi, "")
    .substring(0, 25).toUpperCase();
  payload += formatField("59", cleanNome);

  const cleanCidade = cidade.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/gi, "")
    .substring(0, 15).toUpperCase();
  payload += formatField("60", cleanCidade);

  // Tag 62 - Additional Data Field
  payload += formatField("62", formatField("05", txid));

  payload += "6304";
  payload += crc16(payload);

  return payload;
}

function BalcaoPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_admin/balcao" }) as any;
  const isFullscreen = search.fullscreen === "true";

  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(new Date());

  const [paymentMethod, setPaymentMethod] = useState<string>("Dinheiro");
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [showPixDialog, setShowPixDialog] = useState(false);
  const [pixPayload, setPixPayload] = useState("");
  const [pixKey, setPixKey] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("ativo", true)
      .order("nome");
    
    if (error) toast.error(error.message);
    else setProducts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
    const timer = setInterval(() => setNow(new Date()), 1000);

    const channel = supabase
      .channel("pdv_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, () => loadProducts())
      .subscribe();

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!q) return products;
    const s = q.toLowerCase();
    return products.filter((p) => p.nome.toLowerCase().includes(s) || p.descricao?.toLowerCase().includes(s));
  }, [products, q]);

  const updateQuantity = (produto: Produto, delta: number) => {
    if (produto.quantidade_estoque <= 0 && delta > 0) {
      toast.error("Produto sem estoque!");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.produto.id === produto.id);
      if (existing) {
        const newQty = existing.quantidade + delta;
        if (newQty <= 0) return prev.filter((item) => item.produto.id !== produto.id);
        if (newQty > produto.quantidade_estoque) {
          toast.error("Limite de estoque atingido!");
          return prev;
        }
        return prev.map((item) =>
          item.produto.id === produto.id ? { ...item, quantidade: newQty } : item
        );
      }
      if (delta > 0) return [...prev, { produto, quantidade: 1 }];
      return prev;
    });
  };

  const getItemQuantity = (produtoId: string) => {
    return cart.find((it) => it.produto.id === produtoId)?.quantidade || 0;
  };

  const removeFromCart = (produtoId: string) => {
    setCart((prev) => prev.filter((item) => item.produto.id !== produtoId));
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((acc, item) => acc + item.produto.preco * item.quantidade, 0);

  const finalizarVenda = async () => {
    if (cart.length === 0) return toast.error("Carrinho vazio!");
    if (paymentMethod === "PIX" && !pixConfirmed) {
      // Open Pix Dialog
      loadPixConfig();
      return;
    }
    
    setBusy(true);

    try {
      const numVenda = `BAL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // 1. Get Payment Method ID
      const { data: formaPago, error: formaErr } = await supabase
        .from("formas_pagamento")
        .select("id")
        .eq("nome", paymentMethod)
        .single();
      
      if (formaErr || !formaPago) throw formaErr || new Error("Forma de pagamento não encontrada");

      // 2. Map Items for JSONB storage
      const itemsVenda = cart.map((item) => ({
        produto_id: item.produto.id,
        nome: item.produto.nome,
        quantidade: item.quantidade,
        preco: item.produto.preco,
        subtotal: item.produto.preco * item.quantidade,
      }));

      // 3. Create Counter Sale with Items
      const { data: venda, error: vendaErr } = await supabase
        .from("vendas_balcao")
        .insert({
          numero_venda: numVenda,
          total: subtotal,
          forma_pagamento_id: formaPago.id,
          itens_venda: itemsVenda,
        })
        .select()
        .single();

      if (vendaErr || !venda) throw vendaErr || new Error("Erro ao registrar venda");

      // 3. Update Stock
      for (const item of cart) {
        const { error: stockErr } = await supabase
          .from("produtos")
          .update({ quantidade_estoque: item.produto.quantidade_estoque - item.quantidade })
          .eq("id", item.produto.id);
        if (stockErr) console.error("Erro ao atualizar estoque:", stockErr);
      }

      toast.success("Venda finalizada com sucesso!");
      clearCart();
      setPixConfirmed(false);
      loadProducts();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar venda");
    } finally {
      setBusy(false);
    }
  };

  const loadPixConfig = async () => {
    if (cart.length === 0) return toast.error("Carrinho vazio!");
    
    const { data: configData } = await supabase.from("configuracoes").select("chave, valor");
    const lojakey = configData?.find(c => c.chave === "chave_pix")?.valor;
    const lojaNome = configData?.find(c => c.chave === "nome_loja")?.valor || "LOJA PDV";

    if (lojakey) {
      const payload = generatePixPayload({
        chave: lojakey,
        valor: subtotal,
        nome: lojaNome
      });
      setPixKey(lojakey);
      setPixPayload(payload);
      setShowPixDialog(true);
      console.log('QR Code gerado para:', { total: subtotal, chave_pix: lojakey, nome: lojaNome });
    } else {
      toast.error("Chave PIX não configurada!");
    }
  };

  const confirmarPix = () => {
    setPixConfirmed(true);
    setShowPixDialog(false);
    toast.success("Pagamento PIX confirmado!");
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearCart();
      if (e.key === "Enter" && cart.length > 0 && !busy) {
        if (paymentMethod !== "PIX" || pixConfirmed) finalizarVenda();
        else loadPixConfig();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, busy, filteredProducts, paymentMethod, pixConfirmed]);

  const toggleFullscreen = () => {
    navigate({
      to: "/balcao",
      search: (prev: any) => ({ ...prev, fullscreen: isFullscreen ? undefined : "true" }),
    });
  };

  return (
    <div className={cn("flex flex-col h-full bg-background", isFullscreen && "fixed inset-0 z-50 p-4")}>
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-4 bg-card p-4 rounded-xl border border-border/40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-full"><Clock className="h-4 w-4 text-primary" /></div>
            <p className="text-lg font-mono font-bold">{now.toLocaleTimeString("pt-BR")}</p>
          </div>
          <div className="h-4 w-[1px] bg-border mx-2" />
          <h1 className="text-xl font-black uppercase tracking-tight text-primary">Vendas de Balcão</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} title="Tela Cheia (F11)">
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
        {/* Products Grid */}
        <div className="flex-[3] flex flex-col gap-4 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar produto por nome ou descrição..." 
              className="pl-10 h-12 text-lg bg-card border-border/50 focus:border-primary/50" 
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pr-4 pb-4">
              {loading ? (
                Array.from({ length: 15 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-card animate-pulse border border-border/20" />
                ))
              ) : filteredProducts.map((p, index) => {
                const qtyInCart = getItemQuantity(p.id);
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex flex-col items-center p-4 rounded-xl border transition-all text-center relative overflow-hidden group",
                      p.quantidade_estoque <= 0 
                        ? "bg-muted/50 border-border opacity-60" 
                        : "bg-card border-border/40 hover:border-primary/50 hover:shadow-md"
                    )}
                  >
                    {p.imagem_url && (
                      <img src={p.imagem_url} alt={p.nome} className="absolute inset-x-0 top-0 w-full h-20 object-cover opacity-[0.05] pointer-events-none" />
                    )}

                    <div className="flex-1 flex flex-col items-center justify-center gap-1 z-10 pt-4">
                      <p className="font-bold text-sm line-clamp-2 uppercase tracking-tighter leading-tight min-h-[2.5rem]">{p.nome}</p>
                      <p className="text-xl font-black text-primary">{fmt(p.preco)}</p>
                      <p className={cn("text-[10px] font-bold uppercase", p.quantidade_estoque <= 5 ? "text-yellow-500" : "text-muted-foreground")}>
                        Estoque: {p.quantidade_estoque}
                      </p>
                    </div>

                    <div className="w-full mt-4 flex items-center justify-between bg-secondary/50 rounded-lg p-1 z-10">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-md hover:bg-background"
                        onClick={() => updateQuantity(p, -1)}
                        disabled={qtyInCart <= 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-bold text-sm min-w-[20px]">{qtyInCart}</span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-md hover:bg-background"
                        onClick={() => updateQuantity(p, 1)}
                        disabled={qtyInCart >= p.quantidade_estoque}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Cart */}
        <Card className="flex-[1.2] flex flex-col bg-card border-border/40 shadow-xl min-w-[320px]">
          <CardHeader className="py-4 px-6 border-b border-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-lg text-primary"><ShoppingCart className="h-5 w-5" /></div>
                <CardTitle className="text-xl">Carrinho</CardTitle>
              </div>
              <Badge variant="secondary" className="h-6 px-2">{cart.length} itens</Badge>
            </div>
          </CardHeader>
          
          <ScrollArea className="flex-1 px-4">
            <div className="space-y-3 py-4">
              {cart.map((item) => (
                <div key={item.produto.id} className="bg-secondary/20 p-3 rounded-lg group animate-in slide-in-from-right-2 duration-200 border border-border/5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-bold text-xs leading-tight line-clamp-2 flex-1">{item.produto.nome}</p>
                    <button 
                      onClick={() => removeFromCart(item.produto.id)}
                      className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center bg-background rounded-md border border-border/40 p-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.produto, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center text-xs font-bold">{item.quantidade}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.produto, 1)} disabled={item.quantidade >= item.produto.quantidade_estoque}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <p className="font-bold text-sm text-primary">{fmt(item.produto.preco * item.quantidade)}</p>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 text-center">
                  <ShoppingCart className="h-16 w-16 mb-4 opacity-10" />
                  <p className="text-sm font-medium">Carrinho vazio</p>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 bg-secondary/30 mt-auto border-t border-border/20 space-y-4">
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de Pagamento</p>
              <RadioGroup 
                value={paymentMethod} 
                onValueChange={(v: any) => {
                  setPaymentMethod(v);
                  setPixConfirmed(false);
                  if (v === "PIX") {
                    loadPixConfig();
                  }
                }}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { id: "Dinheiro", icon: Banknote, label: "Dinheiro" },
                  { id: "PIX", icon: Smartphone, label: "PIX" },
                  { id: "Débito", icon: CreditCard, label: "Débito" },
                  { id: "Crédito", icon: CreditCard, label: "Crédito" },
                ].map((m) => (
                  <div key={m.id}>
                    <RadioGroupItem value={m.id} id={m.id} className="peer sr-only" />
                    <Label
                      htmlFor={m.id}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                    >
                      <m.icon className="mb-1 h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">{m.label}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator className="bg-border/20" />

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-lg font-black uppercase tracking-tight">Total</span>
                <span className="text-2xl font-black text-primary font-mono">{fmt(subtotal)}</span>
              </div>
              {paymentMethod === "PIX" && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase">
                  {pixConfirmed ? (
                    <span className="text-green-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> PIX Confirmado</span>
                  ) : (
                    <span className="text-yellow-500 flex items-center gap-1"><QrCode className="h-3 w-3" /> Aguardando PIX</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-2 text-white">
              <Button 
                onClick={finalizarVenda}
                disabled={cart.length === 0 || busy || (paymentMethod === "PIX" && !pixConfirmed)} 
                className="h-14 text-lg font-black uppercase tracking-wider shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : "FINALIZAR (ENTER)"}
              </Button>
              <Button variant="outline" size="sm" onClick={clearCart} disabled={cart.length === 0} className="h-10 text-xs font-bold gap-2">
                <Trash2 className="h-4 w-4" /> LIMPAR (ESC)
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* PIX Dialog */}
      <Dialog open={showPixDialog} onOpenChange={setShowPixDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Pagamento via PIX</DialogTitle>
            <DialogDescription>
              Peça ao cliente para escanear o QR Code abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border-4 border-primary/20">
            {pixPayload ? (
              <QRCodeSVG value={pixPayload} size={240} level="H" includeMargin={true} />
            ) : (
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            )}
            <div className="mt-6 text-center space-y-1">
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Valor a pagar</p>
              <p className="text-4xl font-black text-black">{fmt(subtotal)}</p>
            </div>
            <div className="mt-4 p-3 bg-secondary/50 rounded-lg w-full text-center">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Chave PIX</p>
              <p className="text-sm font-mono font-bold break-all">{pixKey}</p>
            </div>
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => {
              setShowPixDialog(false);
              setPaymentMethod("Dinheiro");
            }}>CANCELAR</Button>
            <Button onClick={confirmarPix} className="gap-2 font-bold">
              <CheckCircle2 className="h-4 w-4" /> CONFIRMAR PAGAMENTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
