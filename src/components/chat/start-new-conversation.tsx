"use client";
import React, { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, getDocs, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
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
        // Admins can chat with couriers. Couriers can only chat with admins.
        const rolesToChatWith = currentUser.role === 'admin' ? ['courier', 'company'] : ['admin'];
        return query(collection(firestore, 'users'), where('role', 'in', rolesToChatWith));
    }, [firestore, currentUser.role]);

    const { data: users, isLoading } = useCollection<User>(usersQuery);

    const handleStartChat = async () => {
        if (!selectedUserId || !firestore) return;

        try {
            // Check if a chat already exists
            const participants = [currentUser.id, selectedUserId].sort();
            const q = query(
                collection(firestore, 'chats'),
                where('participants', '==', participants)
            );
            
            const existingChatsSnap = await getDocs(q).catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: `chats`,
                    operation: 'list',
                    requestResourceData: { note: `Query for existing chat between ${currentUser.id} and ${selectedUserId}` }
                });
                errorEmitter.emit('permission-error', permissionError);
                throw serverError; // Propagate error
            });
            
            if (!existingChatsSnap.empty) {
                // Chat already exists, select it
                onNewChat(existingChatsSnap.docs[0].id);
            } else {
                // Create a new chat
                const selectedUser = users?.find(u => u.id === selectedUserId);
                if (!selectedUser) return;

                const chatDocRefCollection = collection(firestore, 'chats');
                const newChatData = {
                    participants,
                    participantNames: {
                        [currentUser.id]: currentUser.name || currentUser.email,
                        [selectedUserId]: selectedUser.name || selectedUser.email,
                    },
                    lastMessage: "بدأت المحادثة",
                    lastMessageTimestamp: serverTimestamp(),
                    unreadCounts: {
                        [currentUser.id]: 0,
                        [selectedUserId]: 1,
                    },
                };
                
                const docRef = doc(chatDocRefCollection);
                const batch = writeBatch(firestore);

                batch.set(docRef, { ...newChatData, id: docRef.id });
                
                await batch.commit()
                  .catch(serverError => {
                    const permissionError = new FirestorePermissionError({
                        path: docRef.path,
                        operation: 'create',
                        requestResourceData: newChatData
                    });
                    errorEmitter.emit('permission-error', permissionError);
                    throw serverError;
                  });

                onNewChat(docRef.id);
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
                                 : (users?.map(user => (
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
                                        {user.name} ({user.role === 'admin' ? 'مسؤول' : user.role === 'company' ? 'شركة' : 'مندوب'})
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
