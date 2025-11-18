
'use client';

import React, { useState } from 'react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import type { User, Conversation, Role } from '@/lib/types';
import { AppLayout } from '@/components/layout/app-layout';
import { Loader2 } from 'lucide-react';
import { ConversationList } from '@/components/chat/conversation-list';
import { ChatWindow } from '@/components/chat/chat-window';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

function ChatPageContent({ searchTerm }: { searchTerm: string }) {
    const { user: currentUser, isUserLoading } = useUser();
    const firestore = useFirestore();
    
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

    const userDocRef = useMemoFirebase(() => {
        if (!currentUser) return null;
        return doc(firestore, `users/${currentUser.uid}`);
    }, [currentUser, firestore]);
    const { data: userProfile, isLoading: isRoleLoading } = useDoc<User>(userDocRef);
    const role = userProfile?.role;
    
    const conversationsQuery = useMemoFirebase(() => {
        if (!currentUser || !firestore) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', currentUser.uid)
        );
    }, [currentUser, firestore]);

    const { data: conversations, isLoading: conversationsLoading } = useCollection<Conversation>(conversationsQuery);

    if (isUserLoading || isRoleLoading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!currentUser || !role) {
        return <div className="text-center">غير مصرح لك بالدخول.</div>;
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                <ConversationList
                    conversations={conversations || []}
                    isLoading={conversationsLoading}
                    currentUser={currentUser}
                    onSelectConversation={setSelectedConversation}
                    selectedConversationId={selectedConversation?.id}
                    role={role}
                    searchTerm={searchTerm}
                />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70}>
                {selectedConversation ? (
                    <ChatWindow
                        conversation={selectedConversation}
                        currentUser={currentUser}
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
