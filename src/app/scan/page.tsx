"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useUser, useUserProfile, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Shipment, Governorate, Company, User, ShipmentStatusConfig, ShipmentHistory } from '@/lib/types';
import { Loader2, ArrowRight, ScanLine, X, CheckSquare, Trash2, Warehouse, Building, Archive, QrCode, BellRing, RefreshCcw, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { statusIcons, statusText, statusVariants } from '@/components/dashboard/shipments-table';
import { ShipmentFormSheet } from '@/components/shipments/shipment-form-sheet';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { QRScannerDialog } from '@/components/shipments/qr-scanner-dialog';
import type { Html5QrcodeResult } from "html5-qrcode";

export default function ScanPage() {
    const [scannedShipmentIds, setScannedShipmentIds] = useState<Set<string>>(new Set());
    const [scannedShipments, setScannedShipments] = useState<Shipment[]>([]);
    const [lastScannedId, setLastScannedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [editingShipment, setEditingShipment] = useState<Shipment | undefined>(undefined);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selection, setSelection] = useState<Record<string, boolean>>({});
    
    // Use a ref to track scanned IDs immediately to prevent duplicates during rapid scanning
    const scannedRef = useRef<Set<string>>(new Set());

    const router = useRouter();
    const firestore = useFirestore();
    const { user: authUser } = useUser();
    const { userProfile: user } = useUserProfile();
    const { toast } = useToast();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Queries MUST be memoized to avoid infinite loops with useCollection
    const shipmentsQuery = useMemo(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]);
    const governoratesQuery = useMemo(() => firestore ? query(collection(firestore, 'governorates')) : null, [firestore]);
    const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies')) : null, [firestore]);
    const couriersQuery = useMemo(() => firestore ? query(collection(firestore, 'users'), where('role', '==', 'courier')) : null, [firestore]);
    const statusesQuery = useMemo(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]);

    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);
    const { data: courierUsers, isLoading: couriersLoading } = useCollection<User>(couriersQuery);
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);

    const dataIsLoading = shipmentsLoading || governoratesLoading || companiesLoading || couriersLoading || statusesLoading;

    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/scan-beep.mp3');
            audioRef.current.load();
        }
    }, []);

    const playBeep = () => {
        audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
    };
    
    const processScan = useCallback(async (text: string) => {
        if (!text || !firestore || !allShipments) return;
        
        let shipmentId = text.trim();
        try {
            const url = new URL(text);
            shipmentId = url.searchParams.get('edit') || url.pathname.split('/').pop() || text.trim();
        } catch (e) { /* Not a URL, use text as is */ }

        if (!shipmentId) {
            toast({ title: "باركود غير صالح", variant: "destructive" });
            return;
        }

        // Check against the ref for immediate feedback (prevents duplicates from rapid scanner triggers)
        if (scannedRef.current.has(shipmentId)) {
            setLastScannedId(shipmentId);
            return;
        }

        setIsLoading(true);

        const shipment = allShipments.find(s => s.id === shipmentId || s.shipmentCode === shipmentId);

        if (shipment) {
            // Check again with the actual shipment ID in case the code was used
            if (scannedRef.current.has(shipment.id)) {
                setLastScannedId(shipment.id);
                setIsLoading(false);
                return;
            }

            playBeep();
            scannedRef.current.add(shipment.id);
            
            // Add to scanned list only if it's not already there (double check)
            setScannedShipments(prev => {
                if (prev.some(s => s.id === shipment.id)) return prev;
                return [shipment, ...prev];
            });
            
            setScannedShipmentIds(prev => {
                const next = new Set(prev);
                next.add(shipment.id);
                return next;
            });
            
            setLastScannedId(shipment.id);
        } else {
            toast({ title: "لم يتم العثور على الشحنة", variant: "destructive" });
        }
        setIsLoading(false);
    }, [firestore, allShipments, toast]);

    const handleResetSession = () => {
        scannedRef.current.clear();
        setScannedShipmentIds(new Set());
        setScannedShipments([]);
        setLastScannedId(null);
        setSelection({});
        toast({ title: "تم إعادة تعيين الجلسة" });
    };

    const handleRemoveSelected = () => {
        const selectedIds = Object.keys(selection).filter(id => selection[id]);
        if (selectedIds.length === 0) return;
        
        selectedIds.forEach(id => scannedRef.current.delete(id));
        
        setScannedShipmentIds(prev => {
            const next = new Set(prev);
            selectedIds.forEach(id => next.delete(id));
            return next;
        });
        setScannedShipments(prev => prev.filter(s => !selectedIds.includes(s.id)));
        setSelection({});
        toast({ title: `تمت إزالة ${selectedIds.length} شحنة من القائمة` });
    };

    const handleBulkPrint = () => {
        const selectedIds = Object.keys(selection).filter(id => selection[id]);
        if (selectedIds.length === 0) return;
        selectedIds.forEach(id => {
            window.open(`/print/${id}`, '_blank');
        });
    };

    const handleSaveShipment = async (data: Partial<Omit<Shipment, 'id'>>, id?: string) => {
        if (!firestore || !authUser || !id) return;
        const shipmentRef = doc(firestore, 'shipments', id);
        try {
            await writeBatch(firestore).update(shipmentRef, { ...data, updatedAt: serverTimestamp() }).commit();
            toast({ title: 'تم تحديث الشحنة بنجاح' });
            setScannedShipments(prev => prev.map(s => s.id === id ? { ...s, ...data } as Shipment : s));
        } catch (error) {
            toast({ title: 'فشل تحديث الشحنة', variant: 'destructive' });
        }
        setIsSheetOpen(false);
        setEditingShipment(undefined);
    };
    
    const selectedCount = Object.values(selection).filter(Boolean).length;
    
    const handleSelectAll = () => {
        const newSelection = selectedCount === scannedShipments.length ? {} : Object.fromEntries(scannedShipments.map(s => [s.id, true]));
        setSelection(newSelection);
    };
    
    const handleBulkUpdate = async (update: Partial<Shipment>) => {
        if (!firestore || !authUser) return;
        const selectedIds = Object.keys(selection).filter(id => selection[id]);
        if (selectedIds.length === 0) {
            toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
            return;
        }
        toast({ title: `جاري تحديث ${selectedIds.length} شحنة...` });

        const batch = writeBatch(firestore);
        selectedIds.forEach(id => {
            batch.update(doc(firestore, 'shipments', id), { ...update, updatedAt: serverTimestamp() });
        });

        try {
            await batch.commit();
            toast({ title: `تم تحديث ${selectedIds.length} شحنة بنجاح` });
            setScannedShipments(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, ...update } as Shipment : s));
        } catch (error) {
            toast({ title: 'فشل التحديث المجمع', variant: 'destructive' });
        } finally {
            setSelection({});
        }
    };

    if (dataIsLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }
    
    const bulkActions = (
        <div className="flex flex-col gap-3 w-full" dir="rtl">
            {/* Top Row */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[#5ba4a4] font-bold text-lg">شحنات محددة {selectedCount}</span>
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="bg-white border-slate-200 h-10 px-3 gap-2 text-slate-700">
                                <CheckSquare className="h-4 w-4" />
                                <span>تغيير الحالة</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            {statuses?.filter(s => s.enabled).map((status) => (
                                <DropdownMenuItem key={status.id} onSelect={() => handleBulkUpdate({ status: status.id })}>
                                    {status.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {(user?.role === 'admin' || user?.role === 'customer-service') && (
                        <Button 
                            variant="outline" 
                            className="bg-white border-slate-200 h-10 px-3 gap-2 text-orange-500"
                            onClick={() => handleBulkUpdate({ 
                                status: 'Pending', 
                                assignedCourierId: '', 
                                reason: 'إعادة تعيين الشحنة عبر الماسح', 
                                isWarehouseReturn: false, 
                                isReturningToCompany: false, 
                                isReturnedToCompany: false, 
                                isArchivedForCompany: false, 
                                isArchivedForCourier: false, 
                                retryAttempt: false 
                            })}
                        >
                            <RefreshCcw className="h-4 w-4" />
                            <span>إعادة تعيين</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid 1 */}
            <div className="grid grid-cols-3 gap-2">
                {(user?.role === 'admin' || user?.role === 'customer-service') && (
                    <Button 
                        variant="outline" 
                        className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-blue-600 font-medium"
                        onClick={() => handleBulkUpdate({ retryAttempt: true })}
                    >
                        <BellRing className="h-4 w-4" />
                        <span>إعادة محاولة</span>
                    </Button>
                )}
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700">
                            <QrCode className="h-4 w-4" />
                            <span>تعيين مندوب</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
                        {courierUsers?.map(courier => (
                            <DropdownMenuItem key={courier.id} onSelect={() => handleBulkUpdate({ assignedCourierId: courier.id })}>
                                {courier.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                    variant="outline" 
                    className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700"
                    onClick={() => handleBulkUpdate({ isWarehouseReturn: true })}
                >
                    <Warehouse className="h-4 w-4" />
                    <span>للمخزن</span>
                </Button>
            </div>

            {/* Grid 2 */}
            <div className="grid grid-cols-3 gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700">
                            <Building className="h-4 w-4" />
                            <span>تعيين شركة</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
                        {companies?.map(company => (
                            <DropdownMenuItem key={company.id} onSelect={() => handleBulkUpdate({ companyId: company.id })}>
                                {company.name}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button 
                    variant="outline" 
                    className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700"
                    onClick={handleBulkPrint}
                >
                    <Printer className="h-4 w-4" />
                    <span>طباعة</span>
                </Button>

                <Button 
                    variant="outline" 
                    className="bg-white border-slate-100 h-14 flex-col gap-1 text-[11px] text-slate-700"
                    onClick={() => handleBulkUpdate({ isReturningToCompany: true, isWarehouseReturn: false })}
                >
                    <QrCode className="h-4 w-4" />
                    <span>توصيل للشركة</span>
                </Button>
            </div>

            {/* Bottom Row */}
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    className="flex-1 bg-white border-slate-100 h-14 gap-3 text-slate-700 font-medium"
                    onClick={() => handleBulkUpdate({ isReturnedToCompany: true, isReturningToCompany: false })}
                >
                    <Building className="h-5 w-5" />
                    <span>وصلت للشركة</span>
                </Button>
                <Button 
                    variant="destructive" 
                    className="w-14 h-14 p-0 bg-red-500 hover:bg-red-600"
                    onClick={handleRemoveSelected}
                >
                    <Trash2 className="h-6 w-6" />
                </Button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen flex-col bg-muted/30 p-2 md:p-4 gap-4" dir="rtl">
             <main className="flex-1 bg-background rounded-lg shadow-lg flex flex-col overflow-hidden">
                 <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <ScanLine className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-bold">محطة المسح</h1>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button variant="outline" onClick={() => setIsScannerOpen(true)}><QrCode className="me-2 h-4 w-4" />فتح الكاميرا</Button>
                         <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10" onClick={handleResetSession}><Trash2 className="me-2 h-4 w-4" />تفريغ القائمة</Button>
                         <Button variant="ghost" onClick={() => router.back()}><ArrowRight className="me-2 h-4 w-4" />عودة</Button>
                    </div>
                </div>
                <div className="p-4 flex-col sm:flex-row flex items-center gap-4 border-b">
                    <Button onClick={handleSelectAll} disabled={scannedShipments.length === 0} variant="outline" className="w-full sm:w-auto">
                        {selectedCount === scannedShipments.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                    </Button>
                    <div className="hidden md:flex items-center gap-2 flex-1">
                        {selectedCount > 0 && bulkActions}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {scannedShipments.length === 0 ? (
                        <div className="text-center text-muted-foreground pt-20">
                            <p>في انتظار المسح...</p>
                            <Button className="mt-4" variant="secondary" onClick={() => setIsScannerOpen(true)}><QrCode className="me-2 h-4 w-4" />استخدم كاميرا الهاتف للمسح</Button>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-64 md:pb-0">
                            {scannedShipments.map(shipment => (
                                <div key={shipment.id} className={`p-3 border rounded-lg flex items-center gap-4 transition-all duration-300 ${lastScannedId === shipment.id ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'}`}>
                                    <Checkbox className="h-5 w-5" checked={selection[shipment.id] || false} onCheckedChange={(checked) => setSelection(prev => ({...prev, [shipment.id]: !!checked}))} />
                                    <div className="flex-1">
                                        <p className="font-bold">{shipment.recipientName}</p>
                                        <p className="text-sm text-muted-foreground">{shipment.address}, {governorates?.find(g => g.id === shipment.governorateId)?.name}</p>
                                    </div>
                                    <Badge variant={statusVariants[shipment.status] || 'secondary'} className="flex items-center gap-1">{statusIcons[shipment.status]}<span>{statusText[shipment.status] || shipment.status}</span></Badge>
                                    <Button variant="outline" size="sm" onClick={() => { setEditingShipment(shipment); setIsSheetOpen(true); }}>تعديل</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {selectedCount > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-[0_-4px_10px_rgba(0,0,0,0.1)] z-50">
                    {bulkActions}
                </div>
            )}
            
            <QRScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={(text) => processScan(text)} continuous={true} />

            {editingShipment && <ShipmentFormSheet open={isSheetOpen} onOpenChange={setIsSheetOpen} shipment={editingShipment} onSave={handleSaveShipment} governorates={governorates || []} couriers={courierUsers || []} companies={companies || []} statuses={statuses || []} role="admin" />}
        </div>
    );
}
