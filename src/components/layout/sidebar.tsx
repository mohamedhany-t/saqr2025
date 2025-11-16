
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
import { useSidebar } from '../ui/sidebar';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarGroup, SidebarGroupLabel } from '../ui/sidebar';


export function SidebarContent() {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { state } = useSidebar();


  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || "User";
  const displayInitial = displayName?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex h-full max-h-screen flex-col gap-2 bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4 lg:h-[60px] lg:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground">
          <Logo className="h-6 w-6 text-primary" />
          { state === 'expanded' && <span className="">AlSaqr Logistics</span>}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
             <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton href="/" isActive={true} tooltip="الرئيسية">
                        <Home />
                        <span>الرئيسية</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuButton href="#" tooltip="الشحنات">
                        <Package />
                        <span>الشحنات</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton href="#" tooltip="الإدارة">
                        <Users />
                        <span>الإدارة</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </nav>
      </div>
      <div className="mt-auto p-4 border-t border-sidebar-border">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="w-full justify-start items-center gap-3 h-auto p-2">
                    <Avatar className='h-9 w-9'>
                            <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
                            <AvatarFallback>{displayInitial}</AvatarFallback>
                        </Avatar>
                    { state === 'expanded' && <div className="flex flex-col items-start">
                        <span className="font-medium text-sidebar-foreground">{displayName}</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>}
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" side="top">
                <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                    <Settings className="me-2"/>
                    الإعدادات
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="me-2"/>
                    تسجيل الخروج
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
