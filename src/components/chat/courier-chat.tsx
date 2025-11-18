
"use client";

import React, { useState, useEffect } from 'react';
import type { User, Chat } from '@/lib/types';
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

    const adminQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'admin'), limit(1));
    }, [firestore]);

    const { data: adminUsers, isLoading: isAdminLoading } = useCollection<User>(adminQuery);
    const adminUser = adminUsers?.[0];

    const chatQuery = useMemoFirebase(() => {
        if (!firestore || !courierUser?.id) return null;
        return query(collection(firestore, 'chats'), where('participants', 'array-contains', courierUser.id), limit(1));
    }, [firestore, courierUser]);
    
    const { data: chats, isLoading: isChatLoading } = useCollection<Chat>(chatQuery);
    const activeChat = chats?.[0];

    const canRenderChat = courierUser && adminUser && activeChat;
    const isLoading = isAdminLoading || isChatLoading;

    const chatContent = (
        <>
            {isLoading && <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {!isLoading && !adminUser && <div className="flex items-center justify-center h-full text-muted-foreground">لم يتم العثور على حساب المسؤول.</div>}
            {!isLoading && adminUser && !activeChat && <div className="flex items-center justify-center h-full text-muted-foreground">لا توجد محادثة، يرجى التواصل مع الإدارة.</div>}
            {canRenderChat && (
                <ChatWindow 
                    currentUser={courierUser}
                    chatPartner={adminUser}
                    chatId={activeChat.id}
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
