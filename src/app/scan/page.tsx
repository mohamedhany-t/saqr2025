
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc, query } from 'firebase/firestore';
import type { Shipment, Governorate, Company, User, ShipmentStatusConfig } from '@/lib/types';
import { Loader2, ArrowRight, ScanLine, X, CheckSquare, Trash2, Warehouse, Building, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { statusIcons, statusText, statusVariants } from '@/components/dashboard/shipments-table';
import { ShipmentFormSheet } from '@/components/shipments/shipment-form-sheet';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function ScanPage() {
    const [scannedShipmentIds, setScannedShipmentIds] = useState<Set<string>>(new Set());
    const [scannedShipments, setScannedShipments] = useState<Shipment[]>([]);
    const [lastScannedId, setLastScannedId] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingShipment, setEditingShipment] = useState<Shipment | undefined>(undefined);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selection, setSelection] = useState<Record<string, boolean>>({});
    
    const router = useRouter();
    const firestore = useFirestore();
    const { toast } = useToast();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Data fetching
    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]));
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]));
    const { data: courierUsers, isLoading: couriersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where => where('role', '==', 'courier')) : null, [firestore]));
    const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipment_statuses')) : null, [firestore]));

    const dataIsLoading = shipmentsLoading || governoratesLoading || companiesLoading || couriersLoading || statusesLoading;

    useEffect(() => {
        // Preload audio for quick playback
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio('/scan-beep.mp3');
            audioRef.current.load();
        }
    }, []);

    const playBeep = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.error("Audio play failed:", e));
        }
    };
    
    const processScan = useCallback(async (text: string) => {
        if (!text || !firestore) return;
        setIsLoading(true);
        
        let shipmentId = '';
        try {
            const url = new URL(text);
            shipmentId = url.searchParams.get('edit') || '';
        } catch (e) {
            // It might not be a URL, could be just the ID
            shipmentId = text.trim();
        }

        if (!shipmentId) {
            toast({ title: "باركود غير صالح", variant: "destructive" });
            setIsLoading(false);
            return;
        }

        if (scannedShipmentIds.has(shipmentId)) {
            toast({ title: "تم مسح هذه الشحنة بالفعل", variant: "default" });
            setLastScannedId(shipmentId); // Bring to top
            setIsLoading(false);
            return;
        }

        const shipment = allShipments?.find(s => s.id === shipmentId);

        if (shipment) {
            playBeep();
            setScannedShipmentIds(prev => new Set(prev).add(shipmentId));
            setScannedShipments(prev => [shipment, ...prev.filter(s => s.id !== shipmentId)]);
            setLastScannedId(shipmentId);
        } else {
            toast({ title: "لم يتم العثور على الشحنة", description: `لم يتم العثور على شحنة بالمعرف: ${shipmentId}`, variant: "destructive" });
        }
        setIsLoading(false);

    }, [firestore, scannedShipmentIds, allShipments, toast]);


    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            event.preventDefault();
            const text = event.clipboardData?.getData('text');
            if (text) {
                processScan(text);
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => {
            window.removeEventListener('paste', handlePaste);
        };
    }, [processScan]);

    useEffect(() => {
        // Focus the hidden input on mount to capture scanner input
        const input = document.getElementById('scanner-input');
        input?.focus();
        
        const handleClick = () => input?.focus();
        document.addEventListener('click', handleClick);

        return () => document.removeEventListener('click', handleClick);
    }, []);

    const handleSheetClose = () => {
        setIsSheetOpen(false);
        setEditingShipment(undefined);
    };

    const handleEditClick = (shipment: Shipment) => {
        setEditingShipment(shipment);
        setIsSheetOpen(true);
    };
    
    const handleSaveShipment = (data: Partial<Omit<Shipment, 'id'>>, id?: string) => {
         // This needs a proper implementation using server actions similar to admin dashboard
        console.log("Saving shipment", id, data);
        toast({ title: "ميزة الحفظ قيد الإنشاء" });
        handleSheetClose();
    }
    
    const selectedCount = Object.values(selection).filter(Boolean).length;
    
    const handleSelectAll = () => {
        if (selectedCount === scannedShipments.length) {
            setSelection({});
        } else {
            const newSelection: Record<string, boolean> = {};
            scannedShipments.forEach(s => newSelection[s.id] = true);
            setSelection(newSelection);
        }
    };
    
    const handleBulkUpdate = (update: Partial<Shipment>) => {
        // Needs a proper server action implementation
        const selectedIds = Object.keys(selection).filter(id => selection[id]);
        if (selectedIds.length === 0) {
            toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
            return;
        }
        toast({ title: `جاري تحديث ${selectedIds.length} شحنة...` });
        console.log("Bulk updating", selectedIds, "with", update);
        setSelection({});
    };

    if (dataIsLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    return (
        <div className="flex h-screen bg-muted/30 p-4 gap-4" dir="rtl">
            <main className="flex-1 bg-background rounded-lg shadow-lg flex flex-col">
                <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ScanLine className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-bold">محطة المسح المجمع</h1>
                    </div>
                     <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowRight className="me-2 h-4 w-4" />
                        العودة إلى لوحة التحكم
                    </Button>
                </div>
                 <div className="p-4 flex items-center gap-4 border-b">
                    <Button onClick={handleSelectAll} disabled={scannedShipments.length === 0}>
                        {selectedCount === scannedShipments.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                    </Button>
                    {selectedCount > 0 && (
                        <div className="flex items-center gap-2">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                     <Button variant="outline" size="sm" className="h-8 gap-1">
                                        <CheckSquare className="h-3.5 w-3.5" />
                                        <span>تغيير الحالة</span>
                                     </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    {statuses?.filter(s => s.enabled).map((status) => (
                                         <DropdownMenuItem key={status.id} onSelect={() => handleBulkUpdate({ status: status.id })}>
                                             {status.label}
                                         </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                             <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleBulkUpdate({ isWarehouseReturn: true })}>
                                <Warehouse className="me-2 h-3.5 w-3.5" />
                                تم الرجوع للمخزن
                            </Button>
                             <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleBulkUpdate({ isReturnedToCompany: true })}>
                                <Building className="me-2 h-3.5 w-3.5" />
                                تم الرجوع للشركة
                            </Button>
                             <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => handleBulkUpdate({ isArchivedForCompany: true })}>
                                <Archive className="me-2 h-3.5 w-3.5" />
                                أرشفة
                            </Button>
                            <Button variant="destructive" size="sm" className="h-8 gap-1" onClick={() => handleBulkUpdate({})}>
                                <Trash2 className="h-3.5 w-3.5" />
                                حذف
                            </Button>
                        </div>
                    )}
                 </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {scannedShipments.length === 0 ? (
                        <div className="text-center text-muted-foreground pt-20">
                            <p>في انتظار المسح... قم بتوجيه السكانر أو الصق رقم الشحنة.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {scannedShipments.map(shipment => (
                                <div key={shipment.id} className={`p-3 border rounded-lg flex items-center gap-4 transition-all duration-300 ${lastScannedId === shipment.id ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'}`}>
                                    <Checkbox 
                                        className="h-5 w-5"
                                        checked={selection[shipment.id] || false}
                                        onCheckedChange={(checked) => setSelection(prev => ({...prev, [shipment.id]: !!checked}))}
                                    />
                                    <div className="flex-1">
                                        <p className="font-bold">{shipment.recipientName}</p>
                                        <p className="text-sm text-muted-foreground">{shipment.address}, {governorates.find(g => g.id === shipment.governorateId)?.name}</p>
                                    </div>
                                    <Badge variant={statusVariants[shipment.status] || 'secondary'} className="flex items-center gap-1">
                                        {statusIcons[shipment.status]}
                                        <span>{statusText[shipment.status] || shipment.status}</span>
                                    </Badge>
                                    <Button variant="outline" size="sm" onClick={() => handleEditClick(shipment)}>تعديل</Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                 <input
                    id="scanner-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        const value = e.target.value;
                        setInputValue(value);
                        if (value.includes('\n') || value.length > 20) { // Assume scanner hits enter or input is long enough
                            processScan(value);
                            setInputValue('');
                        }
                    }}
                    onBlur={(e) => e.target.focus()} // Always keep focus
                    className="opacity-0 w-0 h-0 p-0 m-0 border-0"
                    aria-hidden="true"
                    tabIndex={-1}
                />
            </main>
            
            {editingShipment && (
                 <ShipmentFormSheet
                    open={isSheetOpen}
                    onOpenChange={setIsSheetOpen}
                    shipment={editingShipment}
                    onSave={handleSaveShipment}
                    governorates={governorates || []}
                    couriers={courierUsers || []}
                    companies={companies || []}
                    statuses={statuses || []}
                    role="admin"
                />
            )}
        </div>
    );
}

