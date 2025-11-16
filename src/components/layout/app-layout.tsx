
'use client';
import React from 'react';
import { Sidebar } from '../ui/sidebar';
import { Header } from '../dashboard/header';
import type { Role } from '@/lib/types';
import { SidebarContent } from './sidebar';

interface AppLayoutProps {
    children: React.ReactNode;
    role: Role | null;
}

export function AppLayout({ children, role }: AppLayoutProps) {
    const [searchTerm, setSearchTerm] = React.useState("");

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <Sidebar>
                <SidebarContent />
            </Sidebar>
            <div className="flex flex-col sm:gap-4 sm:py-4 sm:ps-14">
                <Header onSearchChange={setSearchTerm} />
                {React.cloneElement(children as React.ReactElement, { searchTerm })}
            </div>
        </div>
    )
}
