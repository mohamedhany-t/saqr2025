
'use client';
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { User, Role, Conversation } from '@/lib/types';
import { PlusCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { ScrollArea } from '../ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface StartNewConversationProps {
    role: Role;
    onConversationStarted: (conversation: Conversation) => void;
    existingConversations: Conversation[];
}

export function StartNewConversation({ role, onConversationStarted, existingConversations }: StartNewConversationProps) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);

    const targetRole = role === 'admin' ? 'courier' : 'admin';

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', targetRole));
    }, [firestore, targetRole]);
    const { data: users, isLoading } = useCollection<User>(usersQuery);

    const handleSelectUser = async (user: User) => {
        if (!currentUser || !firestore || !currentUser.email) return;

        // Check if conversation already exists
        const existingConv = existingConversations.find(c => c.participantIds.includes(user.id));
        if (existingConv) {
            onConversationStarted(existingConv);
            setIsOpen(false);
            return;
        }

        const conversationId = [currentUser.uid, user.id].sort().join('_');
        const convRef = doc(firestore, 'conversations', conversationId);
        const batch = writeBatch(firestore);

        const newConversationData: Conversation = {
            id: conversationId,
            participantIds: [currentUser.uid, user.id],
            participantDetails: {
                [currentUser.uid]: {
                    name: currentUser.displayName || currentUser.email,
                    role: role,
                    avatarUrl: currentUser.photoURL || '',
                },
                [user.id]: {
                    name: user.name || user.email,
                    role: user.role,
                    avatarUrl: user.avatarUrl || '',
                }
            },
            lastMessageText: "بدأت المحادثة",
            lastMessageAt: serverTimestamp(),
            lastMessageSenderId: currentUser.uid,
            unreadCounts: {
                [currentUser.uid]: 0,
                [user.id]: 1,
            },
        };

        batch.set(convRef, newConversationData);
        
        try {
            await batch.commit();
            onConversationStarted(newConversationData);
            setIsOpen(false);
            toast({ title: "بدأت المحادثة", description: `يمكنك الآن الدردشة مع ${user.name}` });
        } catch (error) {
            console.error("Error starting conversation: ", error);
            toast({ title: "خطأ", description: "لم نتمكن من بدء المحادثة.", variant: "destructive" });
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="me-2 h-4 w-4" />
                    محادثة جديدة
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>بدء محادثة جديدة</DialogTitle>
                    <DialogDescription>
                        اختر {targetRole === 'admin' ? 'مسؤولاً' : 'مندوباً'} لبدء الدردشة.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-72">
                    <div className="space-y-2">
                        {isLoading && <p>جاري تحميل المستخدمين...</p>}
                        {users?.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleSelectUser(user)}
                                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                            >
                                <Avatar>
                                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <p className="font-semibold">{user.name}</p>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

