
'use client';
import React from 'react';
import { useUser } from '@/firebase';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = React.useState("");

    // This component now acts as a simple wrapper.
    // The actual layout (Header, main content) is handled inside each dashboard.
    // We pass the searchTerm to the children dashboards.
    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           {React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, { searchTerm } as any);
                }
                return child;
            })}
        </div>
    )
}
