
"use client";

import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import type { User, Chat } from '@/lib/types';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { ChatWindow } from './chat-window';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useCollection } from '@/firebase/firestore/use-collection';

interface AdminChatProps {
    couriers: User[];
    adminUser: User | null;
}

const createChatId = (uid1: string, uid2: string): string => {
    if (!uid1 || !uid2) {
        console.error("Attempted to create a chat ID with a missing UID.", { uid1, uid2 });
        return ''; 
    }
    return [uid1, uid2].sort().join('_');
};

export function AdminChat({ couriers, adminUser }: AdminChatProps) {
    const firestore = useFirestore();
    const [selectedCourier, setSelectedCourier] = useState<User | null>(null);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);

    const chatsQuery = useMemoFirebase(() => {
        if (!firestore || !adminUser?.id) return null;
        // This is the crucial fix: The query MUST have a 'where' clause
        // to match the security rule `allow list: if request.query.where...`
        return query(
            collection(firestore, 'chats'),
            where('participants', 'array-contains', adminUser.id)
        );
    }, [firestore, adminUser?.id]);

    const { data: chats } = useCollection<Chat>(chatsQuery);

    const handleCourierSelect = async (courier: User) => {
        if (!adminUser || !adminUser.id || !courier.id) {
            console.error("Cannot select courier, admin or courier ID is missing.");
            return;
        }

        setSelectedCourier(courier);

        const chatId = createChatId(adminUser.id, courier.id);
        const existingChat = chats?.find(c => c.id === chatId);

        if (existingChat) {
            setActiveChat(existingChat);
        } else {
            const chatDocRef = doc(firestore, 'chats', chatId);
            
            const newChatData: Omit<Chat, 'id'> = {
                participants: [adminUser.id, courier.id],
                participantInfo: {
                    [adminUser.id]: { name: adminUser.name || adminUser.email || "Admin", role: "admin" },
                    [courier.id]: { name: courier.name || courier.email || "Courier", role: "courier" }
                },
                lastMessage: "بدأت المحادثة",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastMessageAt: serverTimestamp(),
            };

            const docDataForState: Chat = {
                id: chatId,
                participants: [adminUser.id, courier.id],
                participantInfo: {
                    [adminUser.id]: { name: adminUser.name || adminUser.email || "Admin", role: "admin" },
                    [courier.id]: { name: courier.name || courier.email || "Courier", role: "courier" }
                },
                lastMessage: "بدأت المحادثة",
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessageAt: new Date(),
            }

            await setDoc(chatDocRef, newChatData);
            setActiveChat(docDataForState);
        }
    };
    
    if (!adminUser) return null;

    return (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
            {/* Courier List */}
            <div className="col-span-1 flex flex-col border rounded-lg bg-card text-card-foreground">
                 <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">المحادثات</h2>
                </div>
                <ScrollArea className="flex-1">
                    <nav className="grid gap-1 p-2">
                        {couriers.map(courier => (
                            <button
                                key={courier.id}
                                onClick={() => handleCourierSelect(courier)}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary w-full text-right',
                                    selectedCourier?.id === courier.id && 'bg-muted text-primary'
                                )}
                            >
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={courier.avatarUrl} alt={courier.name} />
                                    <AvatarFallback>{courier.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <p className="font-semibold truncate">{courier.name}</p>
                                    <p className="text-xs truncate">{courier.email}</p>
                                </div>
                            </button>
                        ))}
                    </nav>
                </ScrollArea>
            </div>

            {/* Chat Window */}
            <div className="md:col-span-2 lg:col-span-3 h-full">
                {activeChat && selectedCourier && adminUser ? (
                    <ChatWindow
                        key={activeChat.id}
                        currentUser={adminUser}
                        chatPartner={selectedCourier}
                        chatId={activeChat.id}
                    />
                ) : (
                    <div className="flex flex-col h-full items-center justify-center bg-card rounded-lg border">
                         <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
                        <h2 className="mt-4 text-xl font-semibold text-muted-foreground">ابدأ محادثة</h2>
                        <p className="mt-1 text-muted-foreground">اختر مندوباً من القائمة لبدء المحادثة.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
