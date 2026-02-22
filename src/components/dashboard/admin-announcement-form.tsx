'use client';
import React, { useState } from 'react';
import { Send, Users, User, Info, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { sendPushNotification } from '@/lib/actions';

export function AdminAnnouncementForm() {
    const [message, setMessage] = useState('');
    const [title, setTitle] = useState('');
    const [type, setType] = useState('info'); // info or alert
    const [target, setTarget] = useState('all'); // all or specific
    const [selectedCourier, setSelectedCourier] = useState('');
    const [isSending, setIsSending] = useState(false);
    
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const couriersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('role', '==', 'courier'));
    }, [firestore]);
    const { data: couriers } = useCollection<any>(couriersQuery);

    const handleSend = async () => {
        if (!message.trim() || !title.trim() || !firestore) return;
        setIsSending(true);

        try {
            let recipientIds: string[] = [];
            if (target === 'all') {
                recipientIds = couriers?.map(c => c.id) || [];
            } else if (selectedCourier) {
                recipientIds = [selectedCourier];
            }

            if (recipientIds.length === 0) throw new Error("لم يتم العثور على مستلمين");

            // 1. Save to Notifications Collection
            await addDoc(collection(firestore, 'notifications'), {
                title,
                body: message,
                type,
                createdAt: serverTimestamp(),
                recipientIds,
                readBy: [],
                createdBy: 'الإدارة'
            });

            // 2. Send Push Notification
            const pushPromises = recipientIds.map(id => 
                sendPushNotification({
                    recipientId: id,
                    title: `📢 ${title}`,
                    body: message,
                    url: '/'
                })
            );

            await Promise.all(pushPromises);

            toast({ title: 'تم إرسال التنبيه بنجاح' });
            setMessage('');
            setTitle('');
        } catch (error: any) {
            toast({ title: 'فشل الإرسال', description: error.message, variant: 'destructive' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Card className="border-primary/20 shadow-sm overflow-hidden bg-primary/5">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-primary">
                    <Send className="h-5 w-5" />
                    مركز بث التنبيهات للمناديب
                </CardTitle>
                <CardDescription>إرسال رسالة فورية تظهر كإشعار للمناديب</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold mr-1">نوع التنبيه</label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger className="h-9 bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="info">💡 معلومة عادية</SelectItem>
                                <SelectItem value="alert">⚠️ تحذير مهم</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold mr-1">المستهدفين</label>
                        <Select value={target} onValueChange={setTarget}>
                            <SelectTrigger className="h-9 bg-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">👥 جميع المناديب</SelectItem>
                                <SelectItem value="specific">👤 مندوب محدد</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {target === 'specific' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-bold mr-1">اختر المندوب</label>
                        <Select value={selectedCourier} onValueChange={setSelectedCourier}>
                            <SelectTrigger className="h-9 bg-white">
                                <SelectValue placeholder="اختر مندوباً..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]">
                                {couriers?.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="space-y-1.5">
                    <Input 
                        placeholder="عنوان التنبيه (مثال: عطل فني في السيستم)" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="h-9 bg-white font-bold"
                    />
                </div>

                <div className="space-y-1.5">
                    <Textarea 
                        placeholder="اكتب نص الرسالة هنا..." 
                        className="min-h-[80px] bg-white resize-none"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                    />
                </div>

                <Button 
                    className="w-full h-10 gap-2 font-bold shadow-md" 
                    onClick={handleSend} 
                    disabled={isSending || !message.trim() || !title.trim() || (target === 'specific' && !selectedCourier)}
                >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    بث التنبيه الآن
                </Button>
            </CardContent>
        </Card>
    );
}

function Loader2(props: any) {
    return <Info {...props} className="animate-spin" />;
}
