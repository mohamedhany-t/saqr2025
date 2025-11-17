"use client";

import React, { useState } from 'react';
import type { User } from '@/lib/types';
import { ChatWindow } from './chat-window';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { MessageSquare } from 'lucide-react';

interface AdminChatProps {
    couriers: User[];
    adminUser: User | null;
}

export function AdminChat({ couriers, adminUser }: AdminChatProps) {
    const [selectedCourier, setSelectedCourier] = useState<User | null>(null);

    if (!adminUser) return null;

    return (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
            {/* Courier List */}
            <div className="col-span-1 flex flex-col border rounded-lg bg-card text-card-foreground">
                 <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold">المحادثات</h2>
                </div>
                <ScrollArea className="flex-1">
                    <nav className="grid gap-1 p-2">
                        {couriers.map(courier => (
                            <button
                                key={courier.id}
                                onClick={() => setSelectedCourier(courier)}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary w-full text-right',
                                    selectedCourier?.id === courier.id && 'bg-muted text-primary'
                                )}
                            >
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={courier.avatarUrl} alt={courier.name} />
                                    <AvatarFallback>{courier.name?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 truncate">
                                    <p className="font-semibold truncate">{courier.name}</p>
                                    <p className="text-xs truncate">{courier.email}</p>
                                </div>
                            </button>
                        ))}
                    </nav>
                </ScrollArea>
            </div>

            {/* Chat Window */}
            <div className="md:col-span-2 lg:col-span-3 h-full">
                {selectedCourier ? (
                    <ChatWindow
                        key={selectedCourier.id}
                        currentUser={adminUser}
                        chatPartner={selectedCourier}
                        chatId={selectedCourier.id}
                    />
                ) : (
                    <div className="flex flex-col h-full items-center justify-center bg-card rounded-lg border">
                         <MessageSquare className="h-16 w-16 text-muted-foreground/50" />
                        <h2 className="mt-4 text-xl font-semibold text-muted-foreground">ابدأ محادثة</h2>
                        <p className="mt-1 text-muted-foreground">اختر مندوباً من القائمة لبدء المحادثة.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
