
'use client';
import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Package,
  Users,
  LogOut,
  ChevronLeft,
  Wallet,
} from "lucide-react";
import { useAuth, useUser } from "@/firebase";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import type { Role } from "@/lib/types";
import { Logo } from "../icons";

const getNavItems = (role?: Role | null) => {
    switch(role) {
        case "admin":
            return [
                { href: '/', icon: Home, label: 'الرئيسية' },
            ];
        case "company":
             return [
                { href: '/', icon: Home, label: 'الرئيسية' },
            ];
        case "courier":
            return [
                { href: "/", icon: Home, label: "الرئيسية" },
                { href: "/accounts", icon: Wallet, label: "الحسابات" },
            ];
        default:
            return [];
    }
}


export function SidebarContent() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = React.useState<Role | null>(null);

   React.useEffect(() => {
    if (user) {
      // This is a client-side workaround. For production, custom claims should be used.
      // This is less secure as it relies on client-side checks.
      const userEmail = user.email;
      if (userEmail === 'mhanyt21@gmail.com') {
          setRole('admin');
      } else if (userEmail?.includes('company')) {
          setRole('company');
      } else if (userEmail?.includes('courier')) {
          setRole('courier');
      }
    }
  }, [user]);

  
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const displayInitial = displayName?.charAt(0).toUpperCase() || "U";
  
  const navItems = getNavItems(role);

  return (
    <nav className="flex h-full max-h-screen flex-col gap-2 bg-background">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <Logo className="h-6 w-6" />
          <span className="">الصقر للشحن</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                pathname === item.href && "bg-muted text-primary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
       <div className="mt-auto border-t p-4">
          <div className="flex items-center gap-3 mb-4">
             <Avatar className="h-9 w-9">
              <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
              <AvatarFallback>{displayInitial}</AvatarFallback>
            </Avatar>
            <div>
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            تسجيل الخروج
          </Button>
       </div>
    </nav>
  );
}


export function Sidebar() {
    return (
        <aside className="hidden border-e bg-background md:block md:w-64">
            <SidebarContent />
        </aside>
    )
}
