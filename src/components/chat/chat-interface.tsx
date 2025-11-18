"use client";

import React from "react";
import { useUserProfile } from "@/firebase";
import { Loader2 } from "lucide-react";
import ChatWindow from "@/components/chat/chat-window";
import StartNewConversation from "@/components/chat/start-new-conversation";
import ConversationList from "@/components/chat/conversation-list";
import { Card, CardContent } from "@/components/ui/card";

export default function ChatInterface() {
    const { userProfile, isProfileLoading } = useUserProfile();
    const [activeChatId, setActiveChatId] = React.useState<string | null>(null);

    if (isProfileLoading || !userProfile) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
         <Card className="mt-4 h-[calc(100vh-20rem)]">
            <CardContent className="p-0 h-full">
                <div className="flex h-full">
                    <aside className="w-1/3 border-e flex flex-col">
                       <div className="p-4 border-b">
                            <h2 className="text-xl font-semibold">المحادثات</h2>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <ConversationList 
                                currentUser={userProfile}
                                onSelectChat={setActiveChatId}
                                activeChatId={activeChatId}
                            />
                        </div>
                        {userProfile.role === 'admin' && (
                            <div className="p-4 border-t">
                                <StartNewConversation 
                                    currentUser={userProfile} 
                                    onNewChat={setActiveChatId} 
                                />
                            </div>
                        )}
                    </aside>
                    <main className="flex-1 flex flex-col">
                        {activeChatId ? (
                            <ChatWindow 
                                chatId={activeChatId} 
                                currentUser={userProfile} 
                            />
                        ) : (
                            <div className="flex flex-1 items-center justify-center text-muted-foreground">
                                <p>اختر محادثة أو ابدأ واحدة جديدة.</p>
                            </div>
                        )}
                    </main>
                </div>
            </CardContent>
        </Card>
    );
}
