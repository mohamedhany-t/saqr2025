
'use client';
import React from 'react';
import { Header } from '../dashboard/header';
import { usePathname } from 'next/navigation';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const [searchTerm, setSearchTerm] = React.useState('');
    const pathname = usePathname();

    const isChatPage = pathname.startsWith('/chat');

    const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
             // Pass searchTerm to direct dashboard children or chat page
             if (['AdminDashboard', 'CompanyDashboard', 'CourierDashboard', 'ChatPageContent'].includes((child.type as any).name)) {
                return React.cloneElement(child, { searchTerm } as { searchTerm: string } & React.HTMLAttributes<HTMLElement>);
            }
        }
        return child;
    });
    
    const mainContentClasses = isChatPage
    ? "flex-1 flex flex-col p-0 md:p-0"
    : "flex flex-col flex-1 gap-4 p-4 md:gap-8 md:p-8";

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <Header onSearchChange={setSearchTerm} />
           <main className={mainContentClasses}>
              {childrenWithProps}
           </main>
        </div>
    )
}
