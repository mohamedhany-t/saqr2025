
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
             // Pass searchTerm to direct dashboard children
             if (['AdminDashboard', 'CompanyDashboard', 'CourierDashboard'].includes((child.type as any).name)) {
                return React.cloneElement(child, { searchTerm } as { searchTerm: string } & React.HTMLAttributes<HTMLElement>);
            }
        }
        return child;
    });
    
    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
           <Sidebar />
           <div className="flex flex-col">
               <Header onSearchChange={setSearchTerm} />
               <main className="flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-8">
                  {childrenWithProps}
               </main>
            </div>
        </div>
    )
}
