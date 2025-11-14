"use client";

import React from 'react';
import Link from 'next/link';
import { Search, Package, Home, Users2, LineChart } from "lucide-react";

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

export function Header() {
  const user = { name: "Admin User", email: "admin@alsaqr.com", avatar: "/placeholder-user.jpg", role: "admin" };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
       <Link href="#" className="flex items-center gap-2 font-semibold">
          <Logo className="size-7 text-primary" />
          <h1 className="font-headline text-lg text-foreground">AlSaqr Logistics</h1>
        </Link>
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6 me-auto">
          <Link href="#" className="flex items-center gap-2 text-foreground transition-colors hover:text-foreground">
            <Home className="h-4 w-4" />
            <span>الرئيسية</span>
          </Link>
          <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">
            <Package className="h-4 w-4" />
            <span>الشحنات</span>
          </Link>
          {user.role === 'admin' && (
             <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">
                <Users2 className="h-4 w-4" />
                <span>المستخدمون</span>
             </Link>
          )}
          <Link href="#" className="text-muted-foreground transition-colors hover:text-foreground">
            <LineChart className="h-4 w-4" />
            <span>التقارير</span>
          </Link>
        </nav>
      <div className="relative flex-1 md:grow-0">
        <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="بحث في الشحنات..."
          className="w-full rounded-lg bg-background ps-8 md:w-[200px] lg:w-[320px]"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="overflow-hidden rounded-full"
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>حسابي</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>الإعدادات</DropdownMenuItem>
          <DropdownMenuItem>الدعم</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>تسجيل الخروج</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}