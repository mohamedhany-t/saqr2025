
'use client';
import React from 'react';
import { Header } from '../dashboard/header';

interface AppLayoutProps {
    children: React.ReactNode;
    onSearchChange: (term: string) => void;
}

export function AppLayout({ children, onSearchChange }: AppLayoutProps) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <Header onSearchChange={onSearchChange} />
           {children}
        </div>
    )
}
