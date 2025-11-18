
'use client';

import React from 'react';
import type { Conversation, User as UserProfile } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

interface ConversationListProps {
    conversations: Conversation[];
    isLoading: boolean;
    currentUserProfile: UserProfile;
    onSelectConversation: (conversation: Conversation) => void;
    selectedConversationId?: string;
    searchTerm: string;
}

const getOtherParticipant = (conversation: Conversation, currentUserId: string) => {
    const otherId = conversation.participantIds.find(id => id !== currentUserId);
    return otherId ? conversation.participantDetails[otherId] : null;
};

const ConversationItem = ({ conv, currentUserProfile, isSelected, onSelect }: { conv: Conversation, currentUserProfile: UserProfile, isSelected: boolean, onSelect: () => void }) => {
    const otherParticipant = getOtherParticipant(conv, currentUserProfile.id);
    const unreadCount = conv.unreadCounts?.[currentUserProfile.id] || 0;
    
    const timeAgo = conv.lastMessageAt?.toDate ? formatDistanceToNow(conv.lastMessageAt.toDate(), { addSuffix: true, locale: ar }) : '';

    return (
        <div
            onClick={onSelect}
            className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                isSelected ? "bg-accent" : "hover:bg-muted"
            )}
        >
            <Avatar>
                <AvatarImage src={otherParticipant?.avatarUrl} alt={otherParticipant?.name} />
                <AvatarFallback>{otherParticipant?.name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <div className="flex justify-between items-center">
                    <h4 className="font-semibold truncate">{otherParticipant?.name}</h4>
                    <p className="text-xs text-muted-foreground">{timeAgo}</p>
                </div>
                <div className="flex justify-between items-start">
                    <p className="text-sm text-muted-foreground truncate">{conv.lastMessageText || '...'}</p>
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="flex-shrink-0">{unreadCount}</Badge>
                    )}
                </div>
            </div>
        </div>
    );
};

export function ConversationList({ conversations, isLoading, currentUserProfile, onSelectConversation, selectedConversationId, searchTerm }: ConversationListProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    // Fetch all admins and couriers for creating new conversations
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', 'in', ['admin', 'courier']));
    }, [firestore]);
    const { data: users, isLoading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const handleCreateConversation = async (otherUser: UserProfile) => {
        if (!firestore || !currentUserProfile) return;

        // Check if a conversation already exists
        const otherUserId = otherUser.id;
        const existingConversation = conversations.find(c => c.participantIds.includes(otherUserId));

        if (existingConversation) {
            onSelectConversation(existingConversation);
            return;
        }

        // Create new conversation
        const conversationId = [currentUserProfile.id, otherUserId].sort().join('_');
        const batch = writeBatch(firestore);
        const convRef = doc(firestore, 'conversations', conversationId);
        
        const currentUserDetails = {
             name: currentUserProfile.name || currentUserProfile.email,
             role: currentUserProfile.role,
             avatarUrl: currentUserProfile.avatarUrl || '',
        };

        const newConversation: Conversation = {
            id: conversationId,
            participantIds: [currentUserProfile.id, otherUserId],
            participantDetails: {
                [currentUserProfile.id]: currentUserDetails,
                [otherUser.id]: { name: otherUser.name || otherUser.email, role: otherUser.role, avatarUrl: otherUser.avatarUrl || '' }
            },
            lastMessageAt: serverTimestamp(),
            lastMessageText: "بدأت المحادثة",
            unreadCounts: { [currentUserProfile.id]: 0, [otherUser.id]: 1 },
            lastMessageSenderId: currentUserProfile.id,
        };

        batch.set(convRef, newConversation);

        try {
            await batch.commit();
            onSelectConversation(newConversation);
            toast({ title: "بدأت المحادثة", description: `يمكنك الآن الدردشة مع ${otherUser.name}.` });
        } catch (error) {
            console.error("Error creating conversation:", error);
            toast({ title: "خطأ", description: "لم نتمكن من بدء المحادثة.", variant: "destructive" });
        }
    };

    const targetRole = currentUserProfile.role === 'admin' ? 'courier' : 'admin';
    const potentialContacts = users?.filter(u => u.role === targetRole && u.id !== currentUserProfile.id) || [];
    
    const filteredConversations = conversations.filter(conv => {
        const other = getOtherParticipant(conv, currentUserProfile.id);
        if (!other) return false;
        return other.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex flex-col h-full bg-muted/50 border-e">
            <div className="p-4 border-b">
                <h3 className="text-xl font-bold">المحادثات</h3>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-1">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            </div>
                        ))
                    ) : (
                        filteredConversations.map(conv => (
                            <ConversationItem
                                key={conv.id}
                                conv={conv}
                                currentUserProfile={currentUserProfile}
                                isSelected={conv.id === selectedConversationId}
                                onSelect={() => onSelectConversation(conv)}
                            />
                        ))
                    )}
                </div>
            </ScrollArea>
             <div className="p-2 border-t">
                <h4 className="px-2 py-1 text-sm font-semibold text-muted-foreground">جهات اتصال جديدة</h4>
                <ScrollArea className="h-48">
                    {usersLoading ? <p>جاري التحميل...</p> : potentialContacts.map(user => (
                         <div key={user.id} onClick={() => handleCreateConversation(user)} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted cursor-pointer">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.avatarUrl} />
                                <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{user.name}</span>
                         </div>
                    ))}
                </ScrollArea>
            </div>
        </div>
    );
}

    