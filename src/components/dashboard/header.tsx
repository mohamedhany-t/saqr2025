
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


export function Header({ onSearchChange, searchTerm }: { onSearchChange: (term: string) => void, searchTerm: string }) {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  }

  // Fallback values for user while loading
  const displayName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userEmail = user?.email || "";
  const displayInitial = displayName?.charAt(0).toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
       <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="#"
            className="flex items-center gap-2 text-lg font-semibold md:text-base text-primary"
          >
            <Logo className="h-6 w-6" />
            <span className="sr-only">AlSaqr Logistics</span>
          </Link>
          <Link
            href="#"
            className="text-foreground transition-colors hover:text-foreground"
          >
            لوحة التحكم
          </Link>
        </nav>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <form className="ml-auto flex-1 sm:flex-initial">
            <div className="relative">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="بحث في الشحنات..."
                className="pr-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                onChange={(e) => onSearchChange(e.target.value)}
                value={searchTerm}
              />
            </div>
          </form>
          <InstallPwaButton />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button
                variant="secondary"
                size="icon"
                className="rounded-full"
            >
                <Avatar>
                    <AvatarImage src={user?.photoURL || undefined} alt={displayName} />
                    <AvatarFallback>{displayInitial}</AvatarFallback>
                </Avatar>
                <span className="sr-only">Toggle user menu</span>
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{displayName}</p>
                        <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>الإعدادات</DropdownMenuItem>
                <DropdownMenuItem disabled>الدعم</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                    تسجيل الخروج
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
       </div>
    </header>
  );
}
