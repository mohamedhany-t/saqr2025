'use client';
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  Package,
  Users,
  LogOut,
  ChevronDown,
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
import { useIsMobile } from "@/hooks/use-mobile";

const courierNavItems = [
  {
    href: "/",
    icon: Home,
    label: "الرئيسية",
  },
  {
    href: "/accounts",
    icon: Wallet,
    label: "الحسابات",
  },
];

const adminNavItems = [
    { href: '/', icon: Home, label: 'الرئيسية' },
    { href: '/shipments', icon: Package, label: 'الشحنات' },
    { href: '/users', icon: Users, label: 'المستخدمين' },
]


export function SidebarContent() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  
  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "User";
  const displayInitial = displayName?.charAt(0).toUpperCase() || "U";
  
  const role = (user as any)?.role;

  const navItems = role === 'courier' ? courierNavItems : adminNavItems;

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
            <AvatarFallback>{displayInitial}</AvatarFallback>
          </Avatar>
          <span className="">{displayName}</span>
        </Link>
      </div>
      <div className="flex-1">
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

          {role === 'courier' && (
            <Collapsible className="grid items-start">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary cursor-pointer">
                    <div className="flex items-center gap-3">
                        <Package className="h-4 w-4" />
                        الطرود
                    </div>
                    <ChevronLeft className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-[-90deg]" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid gap-1 pr-6">
                  <Link
                    href="/?tab=active"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    طرود نشطة
                  </Link>
                  <Link
                    href="/?tab=finished"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary"
                  >
                    طرود منتهية
                  </Link>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

        </nav>
      </div>
      <div className="mt-auto p-4">
        <Button size="sm" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}


export function Sidebar() {
    return (
        <aside className="hidden border-r bg-background sm:block">
            <SidebarContent />
        </aside>
    )
}
