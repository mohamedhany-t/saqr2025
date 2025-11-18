
'use client';
import React from 'react';
import { Header } from '../dashboard/header';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const [searchTerm, setSearchTerm] = React.useState('');

    const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
             // Pass searchTerm to direct dashboard children
             if (['AdminDashboard', 'CompanyDashboard', 'CourierDashboard'].includes((child.type as any).name)) {
                return React.cloneElement(child, { searchTerm } as { searchTerm: string } & React.HTMLAttributes<HTMLElement>);
            }
        }
        return child;
    });
    
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <Header onSearchChange={setSearchTerm} />
           <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-8">
              {childrenWithProps}
           </main>
        </div>
    )
}

    