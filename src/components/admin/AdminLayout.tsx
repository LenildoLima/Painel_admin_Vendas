import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { LayoutDashboard, Package, ShoppingCart, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
] as const;

export function AdminLayout({ children }: { children: ReactNode }) {
  const { email, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

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
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  Active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
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