
"use client";
import React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import type { Chat, User } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { formatToCairoTime } from '@/lib/utils';

interface ConversationListProps {
    currentUser: User;
    onSelectChat: (chatId: string) => void;
    activeChatId: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({ currentUser, onSelectChat, activeChatId }) => {
    const firestore = useFirestore();

    const chatsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'chats'),
            where('participants', 'array-contains', currentUser.id)
            // The orderBy was removed to prevent the composite index error.
            // Sorting will now be handled client-side.
        );
    }, [firestore, currentUser.id]);

    const { data: chats, isLoading } = useCollection<Chat>(chatsQuery);

    const sortedChats = React.useMemo(() => {
        if (!chats) return [];
        // Sort chats by lastMessageTimestamp on the client-side
        return [...chats].sort((a, b) => {
            const timeA = a.lastMessageTimestamp?.toDate?.()?.getTime() || 0;
            const timeB = b.lastMessageTimestamp?.toDate?.()?.getTime() || 0;
            return timeB - timeA;
        });
    }, [chats]);

    const getOtherParticipant = (chat: Chat) => {
        const otherId = chat.participants.find(p => p !== currentUser.id);
        const name = otherId ? chat.participantNames[otherId] : 'مستخدم غير معروف';
        const avatarUrl = ''; // You might want to store avatar URLs in user profiles
        const fallback = name ? name.charAt(0).toUpperCase() : '?';
        return { name, avatarUrl, fallback };
    };
    
    if (isLoading) {
        return (
            <div className="p-2 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1 flex-1">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="overflow-y-auto">
            {sortedChats?.map(chat => {
                const { name, avatarUrl, fallback } = getOtherParticipant(chat);
                const timeAgo = chat.lastMessageTimestamp?.toDate ? 
                    formatDistanceToNow(chat.lastMessageTimestamp.toDate(), { addSuffix: true, locale: ar }) : '';
                const unreadCount = chat.unreadCounts?.[currentUser.id] || 0;

                return (
                    <div
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={cn(
                            "flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 border-b relative",
                            activeChatId === chat.id && "bg-muted"
                        )}
                    >
                        <Avatar>
                            <AvatarImage src={avatarUrl} alt={name} />
                            <AvatarFallback>{fallback}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold truncate">{name}</h3>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo}</span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{chat.lastMessage || '...'}</p>
                        </div>
                         {unreadCount > 0 && (
                            <Badge className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 justify-center p-0">{unreadCount}</Badge>
                        )}
                    </div>
                );
            })}
             {sortedChats?.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                    {currentUser.role === 'courier' ? 'لا توجد محادثات. يمكنك فقط الرد على المسؤول.' : 'لا توجد محادثات. ابدأ واحدة جديدة.'}
                </div>
            )}
        </div>
    );
};

export default ConversationList;
