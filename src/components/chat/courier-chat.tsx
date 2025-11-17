"use client";

import React, { useState } from 'react';
import type { User } from '@/lib/types';
import { Button } from '../ui/button';
import { MessageSquare, X } from 'lucide-react';
import { ChatWindow } from './chat-window';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from '@/hooks/use-mobile';


interface CourierChatProps {
    courierUser: User | null;
}

// Mock admin user for now
const adminUser: User = {
    id: 'ADMIN_USER_ID', // A placeholder ID
    name: 'الإدارة',
    email: 'admin@alsaqr.com',
    role: 'admin',
    createdAt: new Date(),
}

export function CourierChat({ courierUser }: CourierChatProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobile();

    if (!courierUser) return null;

    const chatContent = (
        <ChatWindow 
            currentUser={courierUser}
            chatPartner={adminUser}
            chatId={courierUser.id}
        />
    );

    if (isMobile) {
        return (
            <>
                <Button 
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
                >
                    <MessageSquare className="h-7 w-7" />
                </Button>
                <Drawer open={isOpen} onOpenChange={setIsOpen}>
                    <DrawerContent className="h-[90vh] flex flex-col">
                        <DrawerHeader className="text-left">
                            <DrawerTitle>محادثة مع الإدارة</DrawerTitle>
                        </DrawerHeader>
                        <div className="flex-1 overflow-y-auto px-4">
                           {chatContent}
                        </div>
                    </DrawerContent>
                </Drawer>
            </>
        )
    }

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                 <div className="bg-card border rounded-lg shadow-xl w-96 h-[500px] flex flex-col">
                   {chatContent}
                </div>
            )}
            <Button 
                onClick={() => setIsOpen(!isOpen)}
                className="mt-4 h-14 w-14 rounded-full shadow-lg"
            >
                {isOpen ? <X className="h-7 w-7" /> : <MessageSquare className="h-7 w-7" />}
            </Button>
        </div>
    );
}