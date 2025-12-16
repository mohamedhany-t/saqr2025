
"use client";
import React, { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, getDocs, serverTimestamp, writeBatch, doc, setDoc } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Check, ChevronsUpDown, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface StartNewConversationProps {
    currentUser: User;
    onNewChat: (chatId: string) => void;
}

const StartNewConversation: React.FC<StartNewConversationProps> = ({ currentUser, onNewChat }) => {
    const [open, setOpen] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState('');
    const firestore = useFirestore();
    const { toast } = useToast();

    // Fetch potential chat partners based on role
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        let rolesToChatWith: string[] = [];
        if (currentUser.role === 'admin' || currentUser.role === 'customer-service') {
            rolesToChatWith = ['courier', 'company', 'admin', 'customer-service'];
        } else { // Courier and Company can only chat with Admin and customer-service
             rolesToChatWith = ['admin', 'customer-service'];
        }
        return query(collection(firestore, 'users'), where('role', 'in', rolesToChatWith));
    }, [firestore, currentUser.role]);

    const { data: users, isLoading } = useCollection<User>(usersQuery);

    const handleStartChat = async () => {
        if (!selectedUserId || !firestore) return;

        try {
            // Use a deterministic chat ID
            const participants = [currentUser.id, selectedUserId].sort();
            const chatId = `chat_${participants[0]}_${participants[1]}`;
            const chatRef = doc(firestore, 'chats', chatId);

            // Check if a chat already exists by its ID
            const chatSnap = await getDocs(query(collection(firestore, 'chats'), where('id', '==', chatId)));
            
            if (!chatSnap.empty) {
                // Chat already exists, select it
                onNewChat(chatSnap.docs[0].id);
            } else {
                // Create a new chat
                const selectedUser = users?.find(u => u.id === selectedUserId);
                if (!selectedUser) return;

                const newChatData = {
                    id: chatId,
                    participants,
                    participantNames: {
                        [currentUser.id]: currentUser.name || currentUser.email,
                        [selectedUserId]: selectedUser.name || selectedUser.email,
                    },
                    lastMessage: "بدأت المحادثة",
                    lastMessageTimestamp: serverTimestamp(),
                    unreadCounts: {
                        [currentUser.id]: 0,
                        [selectedUserId]: 0,
                    },
                };
                
                await setDoc(chatRef, newChatData)
                  .catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: chatRef.path,
                        operation: 'create',
                        requestResourceData: newChatData
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    throw serverError;
                  });

                onNewChat(chatId);
            }
            
            setSelectedUserId('');
            setOpen(false);
        } catch (error) {
            console.error("Error starting chat:", error);
            toast({
                title: "خطأ في بدء المحادثة",
                description: "لم نتمكن من بدء المحادثة. قد يكون السبب مشكلة في الصلاحيات.",
                variant: "destructive"
            });
        }
    };

    return (
        <div className="flex gap-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        {selectedUserId
                            ? users?.find(u => u.id === selectedUserId)?.name
                            : "اختر مستخدم..."}
                        <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                    <Command>
                        <CommandInput placeholder="ابحث عن مستخدم..." />
                        <CommandList>
                            <CommandEmpty>لم يتم العثور على مستخدمين.</CommandEmpty>
                            <CommandGroup>
                                {isLoading ? (<CommandItem>جاري التحميل...</CommandItem>)
                                 : (users?.filter(u => u.id !== currentUser.id).map(user => (
                                    <CommandItem
                                        key={user.id}
                                        value={user.id}
                                        onSelect={(currentValue) => {
                                            setSelectedUserId(currentValue === selectedUserId ? "" : currentValue);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "me-2 h-4 w-4",
                                                selectedUserId === user.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {user.name} ({user.role === 'admin' ? 'مسؤول' : user.role === 'company' ? 'شركة' : user.role === 'customer-service' ? 'خدمة عملاء' : 'مندوب'})
                                    </CommandItem>
                                )))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <Button onClick={handleStartChat} disabled={!selectedUserId}>
                <MessageSquarePlus className="h-4 w-4" />
            </Button>
        </div>
    );
};

export default StartNewConversation;
