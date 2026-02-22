'use client';
import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Info, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { formatToCairoTime } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export function NotificationCenter() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [unreadCount, setUnreadCount] = useState(0);

    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'notifications'),
            where('recipientIds', 'array-contains', user.uid),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
    }, [firestore, user]);

    const { data: notifications, isLoading } = useCollection<any>(notificationsQuery);

    useEffect(() => {
        if (notifications && user) {
            const unread = notifications.filter((n: any) => !n.readBy?.includes(user.uid)).length;
            setUnreadCount(unread);
        }
    }, [notifications, user]);

    const markAllAsRead = async () => {
        if (!firestore || !user || !notifications) return;
        const batch = writeBatch(firestore);
        notifications.forEach((n: any) => {
            if (!n.readBy?.includes(user.uid)) {
                const ref = doc(firestore, 'notifications', n.id);
                batch.update(ref, {
                    readBy: [...(n.readBy || []), user.uid]
                });
            }
        });
        await batch.commit();
    };

    const markAsRead = async (id: string, readBy: string[]) => {
        if (!firestore || !user || readBy.includes(user.uid)) return;
        const ref = doc(firestore, 'notifications', id);
        await updateDoc(ref, {
            readBy: [...readBy, user.uid]
        });
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white font-bold animate-pulse">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="font-bold text-sm text-right">التنبيهات</h3>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-primary" onClick={markAllAsRead}>
                             تميز الكل كمقروء <CheckCheck className="mr-1 h-3 w-3" />
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[350px]">
                    {isLoading ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">جاري التحميل...</div>
                    ) : notifications?.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                            <Bell className="h-8 w-8 opacity-10" />
                            لا توجد تنبيهات حالياً
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications?.map((n: any) => {
                                const isRead = n.readBy?.includes(user?.uid);
                                return (
                                    <div 
                                        key={n.id} 
                                        className={`p-4 border-b cursor-pointer transition-colors hover:bg-muted/50 ${!isRead ? 'bg-primary/5' : ''}`}
                                        onClick={() => markAsRead(n.id, n.readBy || [])}
                                    >
                                        <div className="flex gap-3 text-right" dir="rtl">
                                            <div className={`mt-1 rounded-full p-1.5 h-fit ${n.type === 'alert' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                {n.type === 'alert' ? <AlertCircle className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />}
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-sm leading-tight ${!isRead ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{n.title}</p>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                                                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                                    <Clock className="h-2.5 w-2.5" /> {formatToCairoTime(n.createdAt)}
                                                </p>
                                            </div>
                                            {!isRead && <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-2 border-t bg-muted/20">
                    <Button variant="ghost" size="sm" className="w-full text-[11px] h-8" disabled>
                        مركز التنبيهات
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
