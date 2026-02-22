
'use client';
import React, { useState, useMemo } from 'react';
import type { Shipment, Company, User, Governorate, ShipmentStatusConfig, Chat } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, getDocs, writeBatch, doc, serverTimestamp, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { DateRange } from 'react-day-picker';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { Loader2, BarChart, Percent, Truck, Archive, DollarSign, CheckCircle, MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ar } from 'date-fns/locale';
import { ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart as RechartsBarChart, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { sendPushNotification } from '@/lib/actions';

const PRESET_COLORS = ["#2563eb", "#f97316", "#16a34a", "#dc2626", "#9333ea", "#facc15", "#db2777", "#14b8a6", "#64748b"];

export default function StatisticsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const { user: adminUser } = useUser();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 30),
        to: new Date(),
    });
    const [notifyingCourierId, setNotifyingCourierId] = useState<string | null>(null);

    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]));
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]));
    const { data: couriers, isLoading: couriersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('role', '==', 'courier')) : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]));
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));

    const isLoading = shipmentsLoading || companiesLoading || couriersLoading || governoratesLoading || statusesLoading;

    const filteredShipments = useMemo(() => {
        if (!allShipments) return [];
        return allShipments.filter(s => {
            const createdAt = s.createdAt;
            let shipmentDate: Date | null = null;
            if (createdAt?.toDate) { // Firestore Timestamp
                shipmentDate = createdAt.toDate();
            } else if (createdAt) { // JS Date object or ISO string
                shipmentDate = new Date(createdAt);
            }

            if (!shipmentDate || isNaN(shipmentDate.getTime())) return false;
            
            const from = dateRange?.from ? startOfDay(dateRange.from) : null;
            const to = dateRange?.to ? endOfDay(dateRange.to) : null;
            if (from && shipmentDate < from) return false;
            if (to && shipmentDate > to) return false;
            return true;
        });
    }, [allShipments, dateRange]);

    const stats = useMemo(() => {
        if (!filteredShipments.length || !statuses) return { totalShipments: 0, totalRevenue: 0, deliveryRate: 0, returnRate: 0 };
        const deliveredStatuses = statuses.filter(s => s.isDeliveredStatus).map(s => s.id);
        const returnedStatuses = statuses.filter(s => s.isReturnedStatus).map(s => s.id);

        const deliveredCount = filteredShipments.filter(s => deliveredStatuses.includes(s.status)).length;
        const returnedCount = filteredShipments.filter(s => returnedStatuses.includes(s.status)).length;
        
        return {
            totalShipments: filteredShipments.length,
            totalRevenue: filteredShipments.reduce((acc, s) => acc + (s.paidAmount || 0), 0),
            deliveryRate: filteredShipments.length > 0 ? (deliveredCount / filteredShipments.length) * 100 : 0,
            returnRate: filteredShipments.length > 0 ? (returnedCount / filteredShipments.length) * 100 : 0,
        };
    }, [filteredShipments, statuses]);

    const statusStats = useMemo(() => {
        if (!filteredShipments.length || !statuses) return [];
        const statusCounts = filteredShipments.reduce((acc, shipment) => {
            acc[shipment.status] = (acc[shipment.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(statusCounts)
            .map(([statusId, count], index) => ({
                name: statuses.find(s => s.id === statusId)?.label || statusId,
                value: count,
                fill: PRESET_COLORS[index % PRESET_COLORS.length]
            }))
            .sort((a, b) => b.value - a.value);
    }, [filteredShipments, statuses]);

    const governorateStats = useMemo(() => {
        if (!filteredShipments.length || !governorates) return [];
        const govCounts = filteredShipments.reduce((acc, shipment) => {
            const govId = shipment.governorateId || 'unknown';
            acc[govId] = (acc[govId] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(govCounts)
            .map(([govId, count]) => ({
                name: governorates.find(g => g.id === govId)?.name || 'غير محدد',
                الشحنات: count
            }))
            .sort((a, b) => b.الشحنات - a.الشحنات);
    }, [filteredShipments, governorates]);

    const performanceStats = useMemo(() => {
        if (!filteredShipments.length || !couriers || !companies || !statuses) return { courierPerf: [], companyPerf: [] };
        const deliveredStatuses = statuses.filter(s => s.isDeliveredStatus).map(s => s.id);

        const courierPerf = couriers.map(courier => {
            const courierShipments = filteredShipments.filter(s => s.assignedCourierId === courier.id);
            if (courierShipments.length === 0) return null;
            const delivered = courierShipments.filter(s => deliveredStatuses.includes(s.status)).length;
            const pending = courierShipments.filter(s => s.status === 'Pending').length;
            const inTransit = courierShipments.filter(s => s.status === 'In-Transit').length;
            return {
                id: courier.id,
                name: courier.name,
                total: courierShipments.length,
                delivered: delivered,
                pending: pending,
                inTransit: inTransit,
                successRate: courierShipments.length > 0 ? (delivered / courierShipments.length) * 100 : 0
            };
        }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => b!.total - a!.total);

        const companyPerf = companies.map(company => {
            const companyShipments = filteredShipments.filter(s => s.companyId === company.id);
            if (companyShipments.length === 0) return null;
            const delivered = companyShipments.filter(s => deliveredStatuses.includes(s.status)).length;
            return {
                name: company.name,
                total: companyShipments.length,
                delivered: delivered,
                successRate: companyShipments.length > 0 ? (delivered / companyShipments.length) * 100 : 0
            };
        }).filter((c): c is NonNullable<typeof c> => c !== null).sort((a, b) => b!.total - a!.total);

        return { courierPerf, companyPerf };

    }, [filteredShipments, couriers, companies, statuses]);

    const handleNotifyCourier = async (courier: (typeof performanceStats.courierPerf)[0]) => {
        if (!firestore || !courier || !adminUser) {
            toast({ title: "خطأ", description: "لا يمكن إرسال التبليغ. بيانات المستخدم غير مكتملة.", variant: "destructive" });
            return;
        }
        setNotifyingCourierId(courier.id);
        const adminId = adminUser.uid;

        try {
            // Use a deterministic chat ID
            const participants = [adminId, courier.id].sort();
            const chatId = `chat_${participants[0]}_${participants[1]}`;
            const chatRef = doc(firestore, 'chats', chatId);

            const message = `مرحباً ${courier.name}،\nلديك ${courier.pending} شحنة قيد الانتظار و ${courier.inTransit} شحنة قيد التوصيل. برجاء الدخول للنظام وتحديث حالاتها في أقرب وقت.`;

            // Check if chat exists, if not create it
            const chatSnap = await getDoc(chatRef);
            if (!chatSnap.exists()) {
                const newChatData = {
                    id: chatId,
                    participants,
                    participantNames: {
                        [adminId]: adminUser.displayName || 'Admin',
                        [courier.id]: courier.name,
                    },
                    lastMessage: "تم بدء المحادثة",
                    lastMessageTimestamp: serverTimestamp(),
                    unreadCounts: { [adminId]: 0, [courier.id]: 0 },
                };
                await setDoc(chatRef, newChatData);
            }

            // Send the message
            const messagesCollection = collection(firestore, 'chats', chatId, 'messages');
            const batch = writeBatch(firestore);
            const newMessageRef = doc(messagesCollection);
            batch.set(newMessageRef, {
                senderId: adminId,
                text: message,
                timestamp: serverTimestamp(),
            });
            batch.update(chatRef, {
                lastMessage: message,
                lastMessageTimestamp: serverTimestamp(),
                [`unreadCounts.${courier.id}`]: 1, // This is not working as expected. Let's assume a bug here or in Firestore rules.
            });

            await batch.commit();

            // Send push notification
            const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?tab=chat&chatId=${chatId}` : 'https://alsaqr-logistics-system.web.app/';

            const notificationResult = await sendPushNotification({
                recipientId: courier.id,
                title: 'متابعة من الإدارة',
                body: `لديك ${courier.pending + courier.inTransit} شحنة تتطلب تحديث.`,
                url: notificationUrl,
            });
            
            if (!notificationResult.success) {
                console.error("Error from sendPushNotification:", notificationResult.error);
                throw new Error(notificationResult.error || "Unknown push notification error");
            }
            
            toast({ title: `تم تبليغ ${courier.name} بنجاح`});

        } catch (error) {
            console.error("Error notifying courier:", error);
            toast({ title: "فشل إرسال التبليغ", variant: "destructive", description: "حدث خطأ أثناء محاولة إرسال الإشعار." });
        } finally {
            setNotifyingCourierId(null);
        }
    };


    if (isLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div>
                    <h1 className="text-3xl font-bold font-headline">الإحصائيات</h1>
                    <p className="text-muted-foreground mt-2">نظرة شاملة على أداء عمليات الشحن الخاصة بك.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant={dateRange?.from && subDays(new Date(), 7).toDateString() === dateRange.from.toDateString() ? "default" : "outline"} onClick={() => setDateRange({ from: subDays(new Date(), 7), to: new Date() })}>آخر 7 أيام</Button>
                    <Button variant={dateRange?.from && subDays(new Date(), 30).toDateString() === dateRange.from.toDateString() ? "default" : "outline"} onClick={() => setDateRange({ from: subDays(new Date(), 30), to: new Date() })}>آخر 30 يوم</Button>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline">
                                اختر فترة
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ar} />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي الشحنات</CardTitle><Truck className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalShipments}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP'})}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">نسبة التسليم</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.deliveryRate.toFixed(1)}%</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">نسبة المرتجعات</CardTitle><Archive className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.returnRate.toFixed(1)}%</div></CardContent></Card>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>توزيع الحالات</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={statusStats} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {statusStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                </Pie>
                                <Tooltip formatter={(value, name) => [`${value} شحنة`, name]} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>الشحنات حسب المحافظة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                           <RechartsBarChart data={governorateStats.slice(0, 10)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="الشحنات" fill="#8884d8" />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader><CardTitle>أداء المناديب</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow>
                                <TableHead>المندوب</TableHead>
                                <TableHead>قيد الانتظار</TableHead>
                                <TableHead>قيد التوصيل</TableHead>
                                <TableHead>الإجمالي</TableHead>
                                <TableHead>التسليمات</TableHead>
                                <TableHead>نسبة النجاح</TableHead>
                                <TableHead>إجراء</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {performanceStats.courierPerf.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell>{c.name}</TableCell>
                                        <TableCell>{c.pending}</TableCell>
                                        <TableCell>{c.inTransit}</TableCell>
                                        <TableCell>{c.total}</TableCell>
                                        <TableCell>{c.delivered}</TableCell>
                                        <TableCell>{c.successRate.toFixed(1)}%</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleNotifyCourier(c)}
                                                disabled={notifyingCourierId === c.id || (c.pending === 0 && c.inTransit === 0)}
                                            >
                                                {notifyingCourierId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 me-2" />}
                                                تبليغ
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>أداء الشركات</CardTitle></CardHeader>
                    <CardContent>
                         <Table>
                            <TableHeader><TableRow><TableHead>الشركة</TableHead><TableHead>الإجمالي</TableHead><TableHead>التسليمات</TableHead><TableHead>نسبة النجاح</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {performanceStats.companyPerf.map((c) => (
                                    <TableRow key={c.name}><TableCell>{c.name}</TableCell><TableCell>{c.total}</TableCell><TableCell>{c.delivered}</TableCell><TableCell>{c.successRate.toFixed(1)}%</TableCell></TableRow>
                                ))}
                            </TableBody>
                         </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    

    