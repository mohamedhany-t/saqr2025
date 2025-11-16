
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Package, Users, LogOut, Building, User, Settings } from "lucide-react";
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from '../icons';
import { Role } from '@/lib/types';

export function SidebarContent() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || "User";
  const displayInitial = displayName?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex h-full max-h-screen flex-col gap-2">
      <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo className="h-6 w-6 text-primary" />
          <span className="">AlSaqr Logistics</span>
        </Link>
      </div>
      <div className="flex-1">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
          <Link
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-primary bg-sidebar-accent text-primary"
          >
            <Home className="h-4 w-4" />
            الرئيسية
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-primary"
          >
            <Package className="h-4 w-4" />
            الشحنات
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground transition-all hover:text-primary"
          >
            <Users className="h-4 w-4" />
            العملاء
          </Link>
        </nav>
      </div>
      <div className="mt-auto p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4">
               <Avatar className='h-9 w-9'>
                    <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
                    <AvatarFallback>{displayInitial}</AvatarFallback>
                </Avatar>
              <div className="flex flex-col">
                <span className="font-medium text-sidebar-foreground">{displayName}</span>
                <span className="text-xs text-muted-foreground">{user?.email}</span>
              </div>
          </div>
        <Button size="sm" className="w-full justify-center gap-2 bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </Button>
      </div>
    </div>
  );
}
