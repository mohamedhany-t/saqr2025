
'use client';
import React from 'react';
import { Header } from '../dashboard/header';

interface AppLayoutProps {
    children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
    const [searchTerm, setSearchTerm] = React.useState('');

    // This is a bit of a trick to pass the search term down to the children
    // without having to pass it as a prop explicitly to each dashboard.
    // The children are cloned and the searchTerm prop is added.
    const childrenWithProps = React.Children.map(children, child => {
        if (React.isValidElement(child)) {
            return React.cloneElement(child, { searchTerm } as any);
        }
        return child;
    });

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <Header onSearchChange={setSearchTerm} />
           {childrenWithProps}
        </div>
    )
}
