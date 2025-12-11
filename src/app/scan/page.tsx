
"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, getDoc, query, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Shipment, Governorate, Company, User, ShipmentStatusConfig, ShipmentHistory } from '@/lib/types';
import { Loader2, ArrowRight, ScanLine, X, CheckSquare, Trash2, Warehouse, Building, Archive, QrCode, MoreVertical, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { statusIcons, statusText, statusVariants } from '@/components/dashboard/shipments-table';
import { ShipmentFormSheet } from '@/components/shipments/shipment-form-sheet';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { QRScannerDialog } from '@/components/shipments/qr-scanner-dialog';
import type { Html5QrcodeResult } from "html5-qrcode";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

export default function ScanPage() {
    const [scannedShipmentIds, setScannedShipmentIds] = useState<Set<string>>(new Set());
    const [scannedShipments, setScannedShipments] = useState<Shipment[]>([]);
    const [lastScannedId, setLastScannedId] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingShipment, setEditingShipment] = useState<Shipment | undefined>(undefined);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [selection, setSelection] = useState<Record<string, boolean>>({});
    
    const router = useRouter();
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Data fetching
    const { data: allShipments, isLoading: shipmentsLoading } = useCollection<Shipment>(useMemoFirebase(() => firestore ? query(collection(firestore, 'shipments')) : null, [firestore]));
    const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]));
    const { data: companies, isLoading: companiesLoading } = useCollection<Company>(useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]));
    const { data: courierUsers, isLoading: couriersLoading } = useCollection<User>(useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), where('role', '==', 'courier')) : null, [firestore]));
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
            // Check if the scanned text is a URL from our QR codes
            const url = new URL(text);
            if (url.searchParams.has('edit')) {
                shipmentId = url.searchParams.get('edit') || '';
            } else {
                 // Fallback for other QR code formats that might just have the ID
                shipmentId = text.trim().split('/').pop() || '';
            }
        } catch (e) {
            // It's not a URL, so it must be the shipment code or ID itself
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

        // Search by ID first
        let shipment = allShipments?.find(s => s.id === shipmentId);
        
        // If not found by ID, search by shipmentCode
        if (!shipment) {
            shipment = allShipments?.find(s => s.shipmentCode === shipmentId);
        }

        if (shipment) {
            playBeep();
            setScannedShipmentIds(prev => new Set(prev).add(shipment!.id));
            setScannedShipments(prev => [shipment!, ...prev.filter(s => s.id !== shipment!.id)]);
            setLastScannedId(shipment.id);
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
    
    const handleSaveShipment = async (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
        if (!firestore || !user || !id) return;
        const shipmentRef = doc(firestore, 'shipments', id);
        try {
            await writeBatch(firestore).update(shipmentRef, { ...data, updatedAt: serverTimestamp() }).commit();
            toast({ title: 'تم تحديث الشحنة بنجاح' });
            setScannedShipments(prev => prev.map(s => s.id === id ? { ...s, ...data } as Shipment : s));
        } catch (error) {
            console.error('Failed to save shipment:', error);
            toast({ title: 'فشل تحديث الشحنة', variant: 'destructive' });
        }
        handleSheetClose();
    };
    
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
    
    const handleBulkUpdate = async (update: Partial<Shipment>) => {
        if (!firestore || !user) return;
        const selectedIds = Object.keys(selection).filter(id => selection[id]);
        if (selectedIds.length === 0) {
            toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
            return;
        }
        toast({ title: `جاري تحديث ${selectedIds.length} شحنة...` });

        const batch = writeBatch(firestore);
        selectedIds.forEach(id => {
            const shipmentRef = doc(firestore, 'shipments', id);
            batch.update(shipmentRef, { ...update, updatedAt: serverTimestamp() });
             if (update.status) {
                const historyRef = doc(collection(shipmentRef, 'history'));
                const historyEntry: Omit<ShipmentHistory, 'id'> = {
                    status: update.status,
                    reason: 'تحديث جماعي عبر الماسح',
                    updatedBy: user.displayName || user.email || 'Admin',
                    userId: user.uid,
                };
                batch.set(historyRef, historyEntry);
            }
        });

        try {
            await batch.commit();
            toast({ title: `تم تحديث ${selectedIds.length} شحنة بنجاح` });
            // Optimistically update local state
            setScannedShipments(prev => prev.map(s => selectedIds.includes(s.id) ? { ...s, ...update } as Shipment : s));
        } catch (error) {
            console.error('Bulk update failed:', error);
            toast({ title: 'فشل التحديث المجمع', variant: 'destructive' });
        } finally {
            setSelection({});
        }
    };

    const handleScanSuccess = (decodedText: string, decodedResult: Html5QrcodeResult) => {
        processScan(decodedText);
        // Do not close the scanner to allow for continuous scanning.
        // setIsScannerOpen(false);
    };

    if (dataIsLoading) {
        return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
    }

    const bulkActions = (
      <div className="flex flex-wrap items-center gap-2">
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
          <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        <span>تعيين مندوب</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                {(courierUsers || []).map(courier => (
                        <DropdownMenuItem key={courier.id} onSelect={() => handleBulkUpdate({ assignedCourierId: courier.id })}>
                            {courier.name}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1">
                        <Building className="h-3.5 w-3.5" />
                        <span>تعيين شركة</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                {(companies || []).map(company => (
                        <DropdownMenuItem key={company.id} onSelect={() => handleBulkUpdate({ companyId: company.id })}>
                            {company.name}
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
      </div>
  );

    return (
        <div className="flex h-screen flex-col md:flex-row bg-muted/30 p-2 md:p-4 gap-4" dir="rtl">
             <main className="flex-1 bg-background rounded-lg shadow-lg flex flex-col overflow-hidden">
                 <div className="p-4 border-b flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                        <ScanLine className="h-6 w-6 text-primary" />
                        <h1 className="text-xl font-bold">محطة المسح المجمع</h1>
                    </div>
                     <div className="flex items-center gap-2">
                         <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
                            <QrCode className="me-2 h-4 w-4" />
                            مسح بالكاميرا
                        </Button>
                        <Button variant="ghost" onClick={() => router.back()}>
                            <ArrowRight className="me-2 h-4 w-4" />
                            العودة للوحة التحكم
                        </Button>
                    </div>
                </div>
                <div className="p-4 flex-col sm:flex-row flex items-center gap-4 border-b">
                    <Button onClick={handleSelectAll} disabled={scannedShipments.length === 0}>
                        {selectedCount === scannedShipments.length ? "إلغاء تحديد الكل" : "تحديد الكل"}
                    </Button>
                    <div className="hidden md:flex items-center gap-2">
                        {selectedCount > 0 && bulkActions}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {scannedShipments.length === 0 ? (
                        <div className="text-center text-muted-foreground pt-20">
                            <p>في انتظار المسح... قم بتوجيه السكانر أو الصق رقم الشحنة.</p>
                            <Button className="mt-4" onClick={() => setIsScannerOpen(true)}>
                                <QrCode className="me-2 h-4 w-4" />
                                أو استخدم كاميرا الهاتف
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3 pb-20 md:pb-0">
                            {scannedShipments.map(shipment => (
                                <div key={shipment.id} className={`p-3 border rounded-lg flex items-center gap-4 transition-all duration-300 ${lastScannedId === shipment.id ? 'bg-primary/10 ring-2 ring-primary' : 'bg-card'}`}>
                                    <Checkbox 
                                        className="h-5 w-5"
                                        checked={selection[shipment.id] || false}
                                        onCheckedChange={(checked) => setSelection(prev => ({...prev, [shipment.id]: !!checked}))}
                                    />
                                    <div className="flex-1">
                                        <p className="font-bold">{shipment.recipientName}</p>
                                        <p className="text-sm text-muted-foreground">{shipment.address}, {governorates?.find(g => g.id === shipment.governorateId)?.name}</p>
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

            {/* Mobile Bulk Actions Toolbar */}
            {selectedCount > 0 && (
                <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t p-2 shadow-lg flex items-center justify-between gap-2 z-50">
                    <span className="text-sm font-semibold">{selectedCount} محددة</span>
                    {bulkActions}
                </div>
            )}
            
            <QRScannerDialog 
                open={isScannerOpen} 
                onOpenChange={setIsScannerOpen} 
                onScanSuccess={handleScanSuccess} 
                continuous={true}
            />

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

    