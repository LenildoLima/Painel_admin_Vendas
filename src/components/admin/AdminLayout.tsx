import { ReactNode, useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  LogOut, 
  ArrowDownToLine, 
  Users, 
  Settings, 
  History, 
  Menu, 
  ChevronDown, 
  Store,
  Rocket
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/balcao", label: "Balcão", icon: ShoppingCart },
  { to: "/vendas-balcao", label: "Vendas Balcão", icon: History },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/entrada-produtos", label: "Entrada", icon: ArrowDownToLine },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
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

  const isFullscreen = (loc.search as any).fullscreen === "true";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {!isFullscreen && (
        <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-4 lg:gap-6">
              <div className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <img src="/logo.png" alt="SkyFlow" className="h-8 w-auto object-contain" />
                <span>Sky<span className="text-primary">Flow</span> Admin</span>
              </div>
              <nav className="flex items-center gap-2">
                
                {/* 1. Balcão Direto */}
                <Link
                  to="/balcao"
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                    loc.pathname.startsWith("/balcao")
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <ShoppingCart className={cn("h-4 w-4", loc.pathname.startsWith("/balcao") ? "text-primary-foreground" : "text-primary")} />
                  <span>Balcão</span>
                </Link>

                {/* 2. Vendas */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10", (loc.pathname.startsWith("/pedidos") || loc.pathname.startsWith("/vendas-balcao")) && "bg-primary/10 text-primary")}>
                      <Store className="h-4 w-4 text-primary" />
                      <span>Vendas</span>
                      {pendingCount > 0 && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/pedidos" className="w-full flex items-center cursor-pointer">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        <span>Pedidos</span>
                        {pendingCount > 0 && (
                          <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
                            {pendingCount}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/vendas-balcao" className="w-full flex items-center cursor-pointer">
                        <History className="mr-2 h-4 w-4" />
                        <span>Histórico de Vendas</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 3. Estoque */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10", (loc.pathname.startsWith("/produtos") || loc.pathname.startsWith("/entrada-produtos")) && "bg-primary/10 text-primary")}>
                      <Package className="h-4 w-4 text-primary" />
                      <span>Estoque</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/produtos" className="w-full flex items-center cursor-pointer">
                        <Package className="mr-2 h-4 w-4" />
                        <span>Produtos</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/entrada-produtos" className="w-full flex items-center cursor-pointer">
                        <ArrowDownToLine className="mr-2 h-4 w-4" />
                        <span>Entrada de Estoque</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* 4. Gestão */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("gap-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10", (loc.pathname.startsWith("/dashboard") || loc.pathname.startsWith("/clientes") || loc.pathname.startsWith("/configuracoes")) && "bg-primary/10 text-primary")}>
                      <LayoutDashboard className="h-4 w-4 text-primary" />
                      <span>Gestão</span>
                      <ChevronDown className="h-3 w-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="w-full flex items-center cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/clientes" className="w-full flex items-center cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        <span>Clientes</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/configuracoes" className="w-full flex items-center cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Configurações</span>
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>

            {/* Mobile Navigation */}
            <div className="flex items-center gap-3 md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 -ml-2">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
                  <div className="px-6 py-5 border-b border-border">
                    <SheetTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
                      <img src="/logo.png" alt="SkyFlow" className="h-8 w-auto object-contain" />
                      <span>Sky<span className="text-primary">Flow</span> Admin</span>
                    </SheetTitle>
                    <SheetDescription className="sr-only">Menu de navegação mobile</SheetDescription>
                  </div>
                  <nav className="flex-1 p-3 space-y-1 overflow-auto">
                    {NAV.map((n) => {
                      const Active = loc.pathname.startsWith(n.to);
                      return (
                        <Link
                          key={n.to}
                          to={n.to}
                          className={cn(
                            "flex items-center justify-between rounded-md px-3 py-3 text-base font-medium transition-colors",
                            Active
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <n.icon className={cn("h-5 w-5", Active ? "text-primary-foreground" : "text-primary")} />
                            {n.label}
                          </div>
                          {n.label === "Pedidos" && pendingCount > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground animate-pulse">
                              {pendingCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </nav>
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2 font-bold text-lg">
                <img src="/logo.png" alt="SkyFlow" className="h-8 w-auto object-contain" />
                <span>Sky<span className="text-primary">Flow</span> Admin</span>
              </div>
            </div>
            
            {/* User Account / Logout */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-sm font-medium text-muted-foreground hidden xl:block truncate max-w-[200px]">{email}</div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="shrink-0 border-border/50 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </header>
      )}
      
      <main className={cn("flex-1 p-2 md:p-3 overflow-hidden", isFullscreen && "p-0 md:p-0")}>
        {children}
      </main>
    </div>
  );
}