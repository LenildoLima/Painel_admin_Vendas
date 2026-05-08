import { ReactNode, useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Package, ShoppingCart, LogOut, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/entrada-produtos", label: "Entrada", icon: ArrowDownToLine },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const { email, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicializa o som de notificação
  useEffect(() => {
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
  }, []);

  const playNotification = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  };

  const flashTitle = (msg: string) => {
    const old = document.title;
    let count = 0;
    const interval = setInterval(() => {
      document.title = count % 2 === 0 ? "🔔 NOVO PEDIDO!" : msg;
      if (++count > 10) {
        clearInterval(interval);
        document.title = old;
      }
    }, 1000);
  };

  useEffect(() => {
    // Busca inicial de pedidos pendentes
    supabase
      .from("pedidos")
      .select("id", { count: "exact" })
      .eq("status", "Pendente")
      .then(({ count }) => setPendingCount(count || 0));

    // Subscrição Realtime
    const channel = supabase
      .channel("admin_orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos" },
        (payload: any) => {
          setPendingCount((c) => c + 1);
          playNotification();
          toast.success(`🔔 Novo pedido ${payload.new.numero_pedido}`, {
            description: `Valor: R$ ${payload.new.total}`,
            duration: 5000,
          });
          flashTitle(`Novo pedido: ${payload.new.numero_pedido}`);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos" },
        (payload: any) => {
          // Se o status mudou de Pendente para algo mais, decrementa
          if (payload.old.status === "Pendente" && payload.new.status !== "Pendente") {
            setPendingCount((c) => Math.max(0, c - 1));
          }
          // Se mudou para Pendente (ex: reaberto), incrementa
          if (payload.old.status !== "Pendente" && payload.new.status === "Pendente") {
            setPendingCount((c) => c + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        <div className="px-6 py-5 border-b border-border">
          <div className="text-lg font-bold tracking-tight">Vendas<span className="text-primary">.</span>Admin</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const Active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                  Active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </div>
                {n.label === "Pedidos" && pendingCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between border-b border-border px-4 md:px-6 bg-card/50">
          <div className="md:hidden font-bold">Vendas<span className="text-primary">.</span>Admin</div>
          <div className="flex-1 md:flex hidden" />
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground hidden sm:block">{email}</div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        <nav className="md:hidden border-t border-border bg-sidebar grid grid-cols-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex flex-col items-center gap-1 py-2 text-xs text-muted-foreground">
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}