
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

const createChatId = (uid1: string, uid2: string): string => {
    // Ensure both uids are valid strings before sorting and joining
    if (!uid1 || !uid2) {
        console.error("Attempted to create a chat ID with an undefined UID.", {uid1, uid2});
        return ''; // Return an empty or invalid ID to prevent Firestore errors
    }
    return [uid1, uid2].sort().join('_');
};

export function CourierChat({ courierUser }: CourierChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const isMobile = useIsMobile();
    const firestore = useFirestore();

    const adminQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'admin'), limit(1));
    }, [firestore]);

    const { data: adminUsers, isLoading: isAdminLoading } = useCollection<User>(adminQuery);
    const adminUser = adminUsers?.[0];

    useEffect(() => {
        // Only create the chat ID if both user objects and their IDs are present
        if (courierUser?.id && adminUser?.id) {
            const chatId = createChatId(courierUser.id, adminUser.id);
            setActiveChatId(chatId);
        } else {
            setActiveChatId(null);
        }
    }, [courierUser, adminUser]);

    const canRenderChat = courierUser && adminUser && activeChatId;
    const isLoading = isAdminLoading || !adminUser || !courierUser;

    const chatContent = (
        <>
            {isLoading && <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
            {!isLoading && !adminUser && <div className="flex items-center justify-center h-full text-muted-foreground">لم يتم العثور على حساب المسؤول.</div>}
            {canRenderChat && (
                <ChatWindow 
                    currentUser={courierUser}
                    chatPartner={adminUser}
                    chatId={activeChatId}
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
