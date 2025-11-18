
"use client";

import React, { useState } from 'react';
import type { User } from '@/lib/types';
import { Button } from '../ui/button';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { ChatWindow } from './chat-window';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from '@/hooks/use-mobile';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';


interface CourierChatProps {
    courierUser: User | null;
}


export function CourierChat({ courierUser }: CourierChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();
    const firestore = useFirestore();
    const { user } = useUser(); // Get the current user state

    const adminQuery = useMemoFirebase(() => {
        // Only run the query if firestore and a user are available
        if (!firestore || !user) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'admin'), limit(1));
    }, [firestore, user]);

    const { data: adminUsers, isLoading: isAdminLoading } = useCollection<User>(adminQuery);
    const adminUser = adminUsers?.[0];

    // Ensure we have a valid courierUser and adminUser before rendering the chat
    const canRenderChat = courierUser && adminUser && courierUser.id;

    const chatContent = (
        <>
            {isAdminLoading && <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {!isAdminLoading && !adminUser && <div className="flex items-center justify-center h-full text-muted-foreground">لم يتم العثور على حساب المسؤول.</div>}
            {canRenderChat && (
                <ChatWindow 
                    currentUser={courierUser}
                    chatPartner={adminUser}
                    chatId={courierUser.id}
                />
            )}
        </>
    );

    if (isMobile) {
        return (
            <>
                <Button 
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
                >
                    <MessageSquare className="h-7 w-7" />
                </Button>
                <Drawer open={isOpen} onOpenChange={setIsOpen}>
                    <DrawerContent className="h-[90vh] flex flex-col">
                        <DrawerHeader className="text-left">
                            <DrawerTitle>محادثة مع الإدارة</DrawerTitle>
                        </DrawerHeader>
                        <div className="flex-1 overflow-y-auto px-4">
                           {chatContent}
                        </div>
                    </DrawerContent>
                </Drawer>
            </>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                 <div className="bg-card border rounded-lg shadow-xl w-96 h-[500px] flex flex-col">
                   {chatContent}
                </div>
            )}
            <Button 
                onClick={() => setIsOpen(!isOpen)}
                className="mt-4 h-14 w-14 rounded-full shadow-lg"
            >
                {isOpen ? <X className="h-7 w-7" /> : <MessageSquare className="h-7 w-7" />}
            </Button>
        </div>
    );
}
