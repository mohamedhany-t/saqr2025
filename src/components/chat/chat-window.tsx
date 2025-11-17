"use client";

import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useFirestore, useCollection, useUser } from '@/firebase';
import type { User, ChatMessage } from '@/lib/types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface ChatWindowProps {
    currentUser: User;
    chatPartner: User;
    chatId: string;
}

export function ChatWindow({ currentUser, chatPartner, chatId }: ChatWindowProps) {
    const firestore = useFirestore();
    const [newMessage, setNewMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const messagesCollectionRef = collection(firestore, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesCollectionRef, orderBy('createdAt', 'asc'));

    const { data: messages, isLoading } = useCollection<ChatMessage>(messagesQuery);
    
     useEffect(() => {
        if (scrollAreaRef.current) {
            // A slight delay to ensure the DOM is updated before scrolling
            setTimeout(() => {
                if (scrollAreaRef.current) {
                   scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
                }
            }, 100);
        }
    }, [messages]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedMessage = newMessage.trim();
        if (!trimmedMessage) return;

        await addDoc(messagesCollectionRef, {
            text: trimmedMessage,
            senderId: currentUser.id,
            senderName: currentUser.name,
            createdAt: serverTimestamp(),
            imageUrl: null,
        });

        setNewMessage('');
    };

    const handleFileUpload = () => {
        // TODO: Implement image upload to Firebase Storage
        alert('Image upload functionality will be implemented in the next step.');
    };

    return (
        <Card className="flex flex-col h-full border-0 md:border">
            <CardHeader className="flex flex-row items-center p-3 border-b">
                <div className="flex items-center space-x-2 space-x-reverse">
                    <Avatar>
                        <AvatarImage src={chatPartner.avatarUrl} alt={chatPartner.name} />
                        <AvatarFallback>{chatPartner.name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-semibold">{chatPartner.name}</span>
                         <span className="text-xs text-muted-foreground">
                           {chatPartner.role === 'admin' ? "متصل" : "مندوب"}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent ref={scrollAreaRef} className="flex-1 p-4 space-y-4 overflow-y-auto">
                 {isLoading && <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                {!isLoading && messages?.map(msg => (
                    <div
                        key={msg.id}
                        className={cn(
                            'flex items-end gap-2',
                            msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                        )}
                    >
                        {msg.senderId !== currentUser.id && (
                             <Avatar className="h-8 w-8">
                                <AvatarImage src={chatPartner.avatarUrl} alt={chatPartner.name} />
                                <AvatarFallback>{chatPartner.name?.[0]}</AvatarFallback>
                            </Avatar>
                        )}
                        <div
                            className={cn(
                                'max-w-xs rounded-lg px-3 py-2 text-sm md:max-w-md',
                                msg.senderId === currentUser.id
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                            )}
                        >
                            <p>{msg.text}</p>
                            {msg.createdAt?.toDate && (
                                 <p className={cn(
                                    "text-xs mt-1",
                                     msg.senderId === currentUser.id ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                                 )}>
                                     {msg.createdAt.toDate().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                 </p>
                            )}
                        </div>
                    </div>
                ))}
                 {!isLoading && messages?.length === 0 && (
                    <div className="text-center text-muted-foreground py-10">
                        لا توجد رسائل. ابدأ المحادثة.
                    </div>
                 )}
            </CardContent>
            <CardFooter className="p-3 border-t">
                <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
                    <Input
                        type="text"
                        placeholder="اكتب رسالة..."
                        className="flex-1"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                     <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="h-5 w-5" />
                        <span className="sr-only">إرفاق ملف</span>
                    </Button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept="image/*" />
                    <Button type="submit" size="icon">
                        <Send className="h-5 w-5" />
                         <span className="sr-only">إرسال</span>
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}