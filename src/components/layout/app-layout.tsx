'use client';
import React from 'react';
import { Header } from '../dashboard/header';
import { Sidebar } from './sidebar';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const [searchTerm, setSearchTerm] = React.useState('');

    const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
            return React.cloneElement(child, { searchTerm } as { searchTerm: string } & React.HTMLAttributes<HTMLElement>);
        }
        return child;
    });

    return (
        <div className="flex min-h-screen w-full bg-muted/40" dir="rtl">
           <Sidebar />
           <div className="flex flex-col flex-1 sm:gap-4 sm:py-4 sm:pl-14">
             <Header onSearchChange={setSearchTerm} />
             <main className="flex-1">
                {childrenWithProps}
             </main>
           </div>
        </div>
    )
}
