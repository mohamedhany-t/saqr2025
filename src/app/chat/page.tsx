
'use client';

import React, { useState } from 'react';
import { useUserProfile, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Conversation } from '@/lib/types';
import { AppLayout } from '@/components/layout/app-layout';
import { Loader2 } from 'lucide-react';
import { ConversationList } from '@/components/chat/conversation-list';
import { ChatWindow } from '@/components/chat/chat-window';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

function ChatPageContent({ searchTerm }: { searchTerm: string }) {
    const { userProfile, isProfileLoading } = useUserProfile();
    const firestore = useFirestore();
    
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

    const conversationsQuery = useMemoFirebase(() => {
        if (!userProfile || !firestore) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', userProfile.id)
        );
    }, [userProfile, firestore]);

    const { data: conversations, isLoading: conversationsLoading } = useCollection<Conversation>(conversationsQuery);

    if (isProfileLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!userProfile) {
        return <div className="text-center">غير مصرح لك بالدخول.</div>;
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                <ConversationList
                    conversations={conversations || []}
                    isLoading={conversationsLoading}
                    currentUserProfile={userProfile}
                    onSelectConversation={setSelectedConversation}
                    selectedConversationId={selectedConversation?.id}
                    searchTerm={searchTerm}
                />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
                {selectedConversation ? (
                    <ChatWindow
                        conversation={selectedConversation}
                        currentUserProfile={userProfile}
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-card">
                        <p>اختر محادثة لبدء الدردشة</p>
                    </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}

export default function ChatPage() {
    return (
        <AppLayout>
            <ChatPageContent searchTerm={''} />
        </AppLayout>
    );
}

    