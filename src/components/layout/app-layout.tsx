
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
            // Check if the child is one of the dashboard components we want to pass props to
            if (['AdminDashboard', 'CompanyDashboard', 'CourierDashboard'].includes((child.type as any).name)) {
                return React.cloneElement(child, { searchTerm } as { searchTerm: string } & React.HTMLAttributes<HTMLElement>);
            }
        }
        return child;
    });

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <Sidebar />
           <div className="flex flex-col sm:gap-4 sm:py-4 sm:ps-14">
             <Header onSearchChange={setSearchTerm} />
             <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
                {childrenWithProps}
             </main>
           </div>
        </div>
    )
}
