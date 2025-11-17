
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
            // Asserting the type of child.props to include searchTerm
            return React.cloneElement(child, { searchTerm } as { searchTerm: string } & React.HTMLAttributes<HTMLElement>);
        }
        return child;
    });

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
           <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
             <Header onSearchChange={setSearchTerm} />
             {childrenWithProps}
           </main>
        </div>
    )
}
