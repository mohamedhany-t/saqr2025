
"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, PanelLeft } from "lucide-react";
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';

import { Input } from "@/components/ui/input";
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
import { InstallPwaButton } from '../install-pwa-button';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { SidebarContent } from '../layout/sidebar';

export function Header({ onSearchChange }: { onSearchChange: (term: string) => void }) {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  }

  // Fallback values for user while loading
  const displayName = user?.displayName || user?.email?.split('@')[0] || "User";
  const displayInitial = displayName?.charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
       <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="sm:hidden">
                <PanelLeft className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="sm:max-w-xs p-0">
               <SidebarContent />
            </SheetContent>
        </Sheet>
        <div className="relative ms-auto flex-1 md:grow-0">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
            type="search"
            placeholder="بحث..."
            className="w-full rounded-lg bg-background pr-8 md:w-[200px] lg:w-[336px]"
            onChange={(e) => onSearchChange(e.target.value)}
            />
        </div>
        <InstallPwaButton />
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
            >
                <Avatar>
                <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
                <AvatarFallback>{displayInitial}</AvatarFallback>
                </Avatar>
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
            <DropdownMenuLabel>حسابي</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>الإعدادات</DropdownMenuItem>
            <DropdownMenuItem disabled>الدعم</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>تسجيل الخروج</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </header>
  );
}
