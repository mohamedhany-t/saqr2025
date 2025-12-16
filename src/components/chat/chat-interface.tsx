

"use client";

import React from "react";
import { useUserProfile } from "@/firebase";
import { ArrowRight, Loader2 } from "lucide-react";
import ChatWindow from "@/components/chat/chat-window";
import StartNewConversation from "@/components/chat/start-new-conversation";
import ConversationList from "@/components/chat/conversation-list";
import { Card, CardContent } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "../ui/button";

interface ChatInterfaceProps {
    initialChatId?: string | null;
}

export default function ChatInterface({ initialChatId }: ChatInterfaceProps) {
    const { userProfile, isProfileLoading } = useUserProfile();
    const [activeChatId, setActiveChatId] = React.useState<string | null>(initialChatId || null);
    const isMobile = useIsMobile();

    React.useEffect(() => {
        if(initialChatId) {
            setActiveChatId(initialChatId);
        }
    }, [initialChatId])

    if (isProfileLoading || !userProfile) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }
    
    // Mobile View Logic
    if (isMobile) {
        return (
            <Card className="mt-4 h-[calc(100vh-16rem)] w-full">
                <CardContent className="p-0 h-full">
                   {activeChatId ? (
                       <div className="h-full flex flex-col">
                            <div className="p-2 border-b flex items-center gap-2">
                                <Button variant="ghost" size="icon" onClick={() => setActiveChatId(null)}>
                                    <ArrowRight className="h-5 w-5" />
                                </Button>
                                <h2 className="text-lg font-semibold">الرسائل</h2>
                            </div>
                           <ChatWindow 
                                chatId={activeChatId} 
                                currentUser={userProfile} 
                            />
                       </div>
                   ) : (
                       <div className="h-full flex flex-col">
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
                       </div>
                   )}
                </CardContent>
            </Card>
        )
    }

    // Desktop View Logic
    return (
         <Card className="mt-4 h-[calc(100vh-20rem)]">
            <CardContent className="p-0 h-full">
                <div className="grid grid-cols-12 h-full">
                    <aside className="col-span-4 border-e flex flex-col">
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
                    <main className="col-span-8 flex flex-col">
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

    
