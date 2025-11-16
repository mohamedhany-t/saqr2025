
"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <Logo className="size-7 text-primary" />
        <h1 className="text-xl font-semibold font-headline">AlSaqr Logistics</h1>
      </div>
      <div className="relative ms-auto flex-1 md:grow-0">
        <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="بحث..."
          className="w-full rounded-lg bg-background ps-8 md:w-[200px] lg:w-[336px]"
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
