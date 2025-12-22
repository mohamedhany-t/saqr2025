
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, User, Chat, ShipmentHistory, ShipmentStatusConfig } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, doc, getDoc, writeBatch, serverTimestamp, getDocs } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { ShipmentCard } from "@/components/shipments/shipment-card";
import { AlertTriangle, CheckSquare, DollarSign, MessageSquare, Check, X, ScanLine, FileUp, PlusCircle, Printer, GitCompareArrows, Loader2, User as UserIcon, Building, Warehouse } from "lucide-react";
import ChatInterface from "../chat/chat-interface";
import { Badge } from "../ui/badge";
import { differenceInDays, differenceInHours } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { sendPushNotification } from "@/lib/actions";
import Link from "next/link";
import { ShipmentFilters } from "./shipment-filters";
import type { ColumnFiltersState } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ImportResult, ImportProgressDialog } from "@/components/shipments/import-progress-dialog";
import { read, utils } from "xlsx";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useFirebaseApp } from "@/firebase";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";

const getSafeDate = (date: any): Date | null => {
    if (!date) return null;
    // Handle Firestore Timestamp
    if (typeof date.toDate === 'function') {
      return date.toDate();
    }
    // Handle JS Date object
    if (date instanceof Date) {
      return date;
    }
    // Handle ISO string or other date string formats
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
    return null;
  };

const ProblemShipmentList = ({ title, icon, shipments, onEdit, children }: { title: string, icon: React.ReactNode, shipments: Shipment[], onEdit: (s: Shipment) => void, children?: (shipment: Shipment) => React.ReactNode }) => {
    if (shipments.length === 0) {
        return null;
    }
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {icon}
                    {title} ({shipments.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {shipments.map(s => (
                        <div key={s.id} className="border p-3 rounded-lg flex justify-between items-center bg-muted/30">
                            {children ? children(s) : <p>تفاصيل الشحنة {s.recipientName}</p>}
                            <Button variant="secondary" size="sm" onClick={() => onEdit(s)}>مراجعة</Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

const PrintCenterPage = ({
    shipments,
    isLoading,
    governorates,
    companies,
    courierUsers,
    statuses,
    onEdit,
    role,
    onGenericBulkUpdate,
  }: {
    shipments: Shipment[];
    isLoading: boolean;
    governorates: Governorate[];
    companies: Company[];
    courierUsers: User[];
    statuses: ShipmentStatusConfig[];
    onEdit: (shipment: Shipment) => void;
    role: Role | null;
    onGenericBulkUpdate: (selectedRows: Shipment[], update: Partial<Shipment>) => void;
  }) => {
    const unprintedShipments = React.useMemo(() => shipments.filter(s => !s.isLabelPrinted), [shipments]);
    const printedShipments = React.useMemo(() => shipments.filter(s => s.isLabelPrinted), [shipments]);
    const { toast } = useToast();
  
    const handlePrintAndUpdate = async (selectedRows: Shipment[]) => {
      if (selectedRows.length === 0) {
        toast({ title: 'لم يتم تحديد أي شحنات', variant: 'destructive' });
        return;
      }
      // Step 1: Update Firestore
      await onGenericBulkUpdate(selectedRows, { isLabelPrinted: true });
  
      // Step 2: Open print window
      const ids = selectedRows.map(row => row.id);
      const printUrl = `/print/bulk?ids=${ids.join(',')}`;
      window.open(printUrl, '_blank', 'width=800,height=600');
    };
  
    return (
      <Tabs defaultValue="unprinted">
        <TabsList>
          <TabsTrigger value="unprinted">جاهزة للطباعة ({unprintedShipments.length})</TabsTrigger>
          <TabsTrigger value="printed">تمت طباعتها ({printedShipments.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="unprinted">
          <ShipmentsTable
            shipments={unprintedShipments}
            isLoading={isLoading}
            governorates={governorates}
            companies={companies}
            couriers={courierUsers}
            statuses={statuses}
            onEdit={onEdit}
            role={role}
            onBulkUpdate={onGenericBulkUpdate}
            onBulkPrint={handlePrintAndUpdate}
          />
        </TabsContent>
        <TabsContent value="printed">
          <ShipmentsTable
            shipments={printedShipments}
            isLoading={isLoading}
            governorates={governorates}
            companies={companies}
            couriers={courierUsers}
            statuses={statuses}
            onEdit={onEdit}
            role={role}
            onBulkUpdate={onGenericBulkUpdate}
            onBulkPrint={handlePrintAndUpdate}
          />
        </TabsContent>
      </Tabs>
    );
  };

interface CustomerServiceDashboardProps {
  user: User;
  role: Role;
  searchTerm: string;
}

export default function CustomerServiceDashboard({ user, role, searchTerm }: CustomerServiceDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const { toast } = useToast();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user: authUser } = useUser();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showExitConfirm, setShowExitConfirm] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [processingShipments, setProcessingShipments] = React.useState<Set<string>>(new Set());


  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (window.location.pathname === '/') {
        event.preventDefault();
        setShowExitConfirm(true);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleExitConfirm = (exit: boolean) => {
    setShowExitConfirm(false);
    if (exit) {
      window.close();
    } else {
      window.history.pushState(null, '', window.location.href);
    }
  };

  // --- Data Fetching ---
  const allShipmentsForStatsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipments'));
  }, [firestore]);
  const { data: allShipmentsForStats, isLoading: allShipmentsLoading } = useCollection<Shipment>(allShipmentsForStatsQuery);
  
  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'shipments')); // Customer service sees all shipments
  }, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'governorates'));
  }, [firestore, user]);
  const { data: governorates, isLoading: governoratesLoading } = useCollection<Governorate>(governoratesQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'companies'));
  }, [firestore, user]);
  const { data: companies, isLoading: companiesLoading } = useCollection<Company>(companiesQuery);

  const couriersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'), where("role", "==", "courier"));
  }, [firestore, user]);
  const { data: courierUsers, isLoading: couriersLoading } = useCollection<User>(couriersQuery);

  const statusesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'shipment_statuses'));
  }, [firestore]);
  const { data: statuses, isLoading: statusesLoading } = useCollection<ShipmentStatusConfig>(statusesQuery);
  
  const chatsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.id) return null;
    return query(
      collection(firestore, 'chats'),
      where('participants', 'array-contains', user.id)
    );
  }, [firestore, user?.id]);

  const { data: chats } = useCollection<Chat>(chatsQuery);
  
  const totalUnreadCount = React.useMemo(() => {
    if (!chats || !user?.id) return 0;
    return chats.reduce((sum, chat) => sum + (chat.unreadCounts?.[user.id] || 0), 0);
  }, [chats, user?.id]);

  // --- Event Handlers & Effects ---
  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
          setEditingShipment({ id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment);
          setShipmentSheetOpen(true);
        }
      };
      fetchShipment();
    }
  }, [searchParams, firestore, router, pathname]);

  const handleSheetOpenChange = (open: boolean) => {
    setShipmentSheetOpen(open);
    if (!open) {
      setEditingShipment(undefined);
      const newParams = new URLSearchParams(searchParams.toString());
      if (newParams.has('edit')) {
        newParams.delete('edit');
        router.replace(`${pathname}?${newParams.toString()}`);
      }
    }
  };

  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const parseExcelDate = (excelDate: any): Date | null => {
    if (!excelDate) return null;
    if (excelDate instanceof Date && !isNaN(excelDate.getTime())) {
      return excelDate;
    }
    if (typeof excelDate === 'number') {
      const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    if (typeof excelDate === 'string') {
      const date = new Date(excelDate);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !firestore || !authUser || !companies || !governorates) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = e.target?.result;
            const workbook = read(data, { type: 'binary', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = utils.sheet_to_json<any>(worksheet);

            const result: ImportResult = {
                added: 0,
                updated: 0,
                rejected: 0,
                total: json.length,
                errors: [],
                processing: true,
                shipmentsToUpdate: [],
            };
            setImportResult(result);

            const functions = getFunctions(app);
            const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

            for (const row of json) {
                // --- Data Extraction and Validation from sheet ---
                const recipientName = String(row['المرسل اليه'] || 'بدون اسم').trim();
                let recipientPhone = String(row['التليفون']?.toString() || '').trim();
                if (recipientPhone.length === 10 && recipientPhone.startsWith("1")) {
                    recipientPhone = "0" + recipientPhone;
                }
                const governorateName = String(row['المحافظة'] || '').trim();
                const companyNameFromSheet = row['الشركة']?.toString().trim() || row['العميل']?.toString().trim();
                const codeFromSheet = row['كود الشحنة'] || row['رقم الشحنة'];
                const shipmentCodeValue = codeFromSheet ? String(codeFromSheet).trim() : null;
                const orderNumberValue = row['رقم الطلب']?.toString().trim();

                // Find company and governorate IDs
                const foundCompany = companies.find(c => c.name === companyNameFromSheet);
                const foundGovernorate = governorates.find(g => g.name === governorateName);

                // Validation checks
                if (!recipientPhone || !foundCompany || !foundGovernorate) {
                    let reason = "بيانات أساسية مفقودة";
                    if (!foundCompany) reason = `شركة "${companyNameFromSheet}" غير موجودة`;
                    if (!foundGovernorate) reason = `محافظة "${governorateName}" غير موجودة`;
                    result.rejected++;
                    result.errors.push({ ...row, 'سبب الرفض': reason });
                    setImportResult({ ...result });
                    continue;
                }

                // --- Match Existing Shipment ---
                let existingDoc = null;
                if (shipmentCodeValue) {
                    const q = query(collection(firestore, 'shipments'), where("shipmentCode", "==", shipmentCodeValue));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) existingDoc = snapshot.docs[0];
                }
                if (!existingDoc && orderNumberValue) {
                    const q = query(collection(firestore, 'shipments'), where("orderNumber", "==", orderNumberValue), where("companyId", "==", foundCompany.id));
                    const snapshot = await getDocs(q);
                    if (!snapshot.empty) existingDoc = snapshot.docs[0];
                }
                if (!existingDoc) {
                    const q = query(collection(firestore, 'shipments'), where("recipientName", "==", recipientName), where("recipientPhone", "==", recipientPhone), where("companyId", "==", foundCompany.id));
                    const snapshot = await getDocs(q);
                     if (!snapshot.empty) existingDoc = snapshot.docs[0];
                }

                // --- Prepare Shipment Data ---
                const deliveryDate = parseExcelDate(row['تاريخ التسليم للمندوب']);
                const creationDate = parseExcelDate(row['التاريخ']);
                const totalAmountValue = row['الاجمالي'] || row['الاجمالى'] || '0';
                
                const shipmentData: Partial<Omit<Shipment, 'id'>> = {
                    shipmentCode: shipmentCodeValue || generateShipmentCode(),
                    senderName: row['الراسل'] || row['العميل الفرعي'],
                    orderNumber: orderNumberValue,
                    recipientName: recipientName,
                    recipientPhone: recipientPhone,
                    governorateId: foundGovernorate.id,
                    address: String(row['العنوان'] || 'N/A').trim(),
                    totalAmount: parseFloat(String(totalAmountValue).replace(/[^0-9.]/g, '')),
                    status: 'Pending',
                    reason: String(row['السبب'] || ''),
                    deliveryDate: deliveryDate || new Date(),
                    companyId: foundCompany.id,
                };

                const cleanShipmentData = Object.fromEntries(Object.entries(shipmentData).filter(([_, v]) => v !== undefined && v !== null && v !== ''));

                // --- Create or Update ---
                if (!existingDoc) {
                    const newDocRef = doc(collection(firestore, "shipments"));
                    await handleShipmentUpdateFn({ 
                        shipmentId: newDocRef.id, 
                        ...cleanShipmentData, 
                        createdAt: creationDate ? creationDate.toISOString() : new Date().toISOString() 
                    });
                    result.added++;
                } else {
                    const existingShipment = existingDoc.data() as Shipment;
                    // Don't override status or courier if already assigned
                    if (existingShipment.assignedCourierId) {
                      delete cleanShipmentData.status;
                      delete cleanShipmentData.assignedCourierId;
                    }
                    await handleShipmentUpdateFn({ shipmentId: existingDoc.id, ...cleanShipmentData });
                    result.updated++;
                }
                setImportResult({ ...result });
            }

            setImportResult(prev => prev ? { ...prev, processing: false } : null);

        } catch (error: any) {
            console.error("Error importing file:", error);
            setImportResult(prev => prev ? { ...prev, processing: false, finalError: "حدث خطأ أثناء معالجة الملف. يرجى التحقق من تنسيق الملف." } : null);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveShipment = async (data: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !authUser || !app) {
        toast({ title: "خطأ في المصادقة", variant: "destructive" });
        return;
    }

    try {
        const functions = getFunctions(app);
        const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

        const payload: any = {
            shipmentId: id,
            ...data,
        };

        if (!id) {
            const newDocRef = doc(collection(firestore, "shipments"));
            payload.shipmentId = newDocRef.id;
        }

        await handleShipmentUpdateFn(payload);

        toast({
            title: id ? "تم تحديث الشحنة" : "تم حفظ الشحنة",
            description: "تمت العملية بنجاح",
        });

        handleSheetOpenChange(false);
        
        if (data.assignedCourierId && (!editingShipment || data.assignedCourierId !== editingShipment.assignedCourierId)) {
            const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?edit=${payload.shipmentId}` : `/?edit=${payload.shipmentId}`;
            sendPushNotification({
                recipientId: data.assignedCourierId,
                title: 'شحنة جديدة',
                body: `تم تعيين شحنة جديدة لك: ${data.recipientName}`,
                url: notificationUrl,
            }).catch(console.error);
        }
    } catch (error: any) {
        console.error("Error saving shipment via cloud function:", error);
        toast({
            title: "فشل تحديث الشحنة",
            description: error.message || "حدث خطأ غير متوقع.",
            variant: "destructive",
        });
    }
};

 const handleGenericBulkUpdate = async (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !authUser || !app) return;
    
    if (selectedRows.length === 0) {
        toast({ title: 'لم يتم تحديد أي شحنات' });
        return;
    }
  
    const functions = getFunctions(app);
    const handleShipmentUpdateFn = httpsCallable(functions, 'handleShipmentUpdate');

    toast({ title: `جاري تحديث ${selectedRows.length} شحنة...` });

    const updatePromises = selectedRows.map(row => 
        handleShipmentUpdateFn({ shipmentId: row.id, ...update })
          .catch(error => ({ error, shipmentId: row.id }))
    );

    const results = await Promise.all(updatePromises);
    const failedUpdates = results.filter(res => res && 'error' in res);

    if (failedUpdates.length > 0) {
        toast({ title: `فشل تحديث ${failedUpdates.length} شحنة`, variant: "destructive" });
        console.error("Bulk update failures:", failedUpdates);
    } else {
        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    }
  
    if (update.assignedCourierId && selectedRows.length > 0) {
      const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '/';
      await sendPushNotification({
        recipientId: update.assignedCourierId,
        title: 'شحنات جديدة',
        body: `تم تعيين ${selectedRows.length} شحنة جديدة لك.`,
        url: notificationUrl,
      });
    }
  };

    const handlePriceChangeDecision = async (shipment: Shipment, approved: boolean) => {
        if (!firestore || !authUser || processingShipments.has(shipment.id)) return;
        
        setProcessingShipments(prev => new Set(prev).add(shipment.id));

        let updatePayload: any = {};
        if (approved) {
            updatePayload = {
                totalAmount: shipment.requestedAmount,
                status: 'In-Transit',
                reason: `تمت الموافقة على تعديل السعر من ${shipment.totalAmount} إلى ${shipment.requestedAmount}.`,
                isPriceChangeDecision: true,
            };
        } else {
            updatePayload = {
                status: 'PriceChangeRejected',
                reason: `تم رفض طلب تعديل سعر (السعر المقترح: ${shipment.requestedAmount}).`,
                isPriceChangeDecision: true,
            };
        }

        try {
            await handleSaveShipment(updatePayload, shipment.id);

            if (shipment.assignedCourierId) {
                const notificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/?edit=${shipment.id}` : `/?edit=${shipment.id}`;
                const message = approved 
                    ? `تمت الموافقة على طلب تعديل سعر شحنة ${shipment.recipientName}.`
                    : `تم رفض طلب تعديل سعر شحنة ${shipment.recipientName}.`;
                await sendPushNotification({
                    recipientId: shipment.assignedCourierId,
                    title: 'تحديث بخصوص طلب تعديل السعر',
                    body: message,
                    url: notificationUrl,
                });
            }
        } catch (error) {
            // Error toast is already handled in handleSaveShipment
        } finally {
            setProcessingShipments(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }
    };
  
  const filteredShipments = React.useMemo(() => {
    if (!shipments) return [];
    
    let baseShipments = shipments;

    if (columnFilters.length > 0) {
        baseShipments = baseShipments.filter(shipment => {
            return columnFilters.every(filter => {
                const value = (shipment as any)[filter.id];
                const filterValue = filter.value as string[];
                if (Array.isArray(filterValue) && filterValue.length > 0) {
                    return filterValue.includes(value);
                }
                return true;
            });
        });
    }

    if (!searchTerm) return baseShipments;
    
    const lowercasedTerm = searchTerm.toLowerCase();
    return baseShipments.filter(shipment =>
      String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.trackingNumber || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [shipments, searchTerm, columnFilters]);

  // --- Problem Inbox Data ---
  const returnedShipmentsNeedingAction = React.useMemo(() => allShipmentsForStats?.filter(s => s.status === 'Returned' && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [allShipmentsForStats]);
  const longPostponedShipments = React.useMemo(() => {
      return allShipmentsForStats?.filter(s => {
          const updatedAt = getSafeDate(s.updatedAt);
          return s.status === 'Postponed' && updatedAt && differenceInDays(new Date(), updatedAt) > 3 && !s.isArchivedForCompany && !s.isArchivedForCourier;
      }) || [];
  }, [allShipmentsForStats]);
  const staleInTransitShipments = React.useMemo(() => {
      return allShipmentsForStats?.filter(s => {
          const updatedAt = getSafeDate(s.updatedAt);
          return s.status === 'In-Transit' && updatedAt && differenceInHours(new Date(), updatedAt) > 24 && !s.isArchivedForCompany && !s.isArchivedForCourier;
      }) || [];
  }, [allShipmentsForStats]);
  const priceChangeRequests = React.useMemo(() => allShipmentsForStats?.filter(s => s.status === 'PriceChangeRequested' && !s.isArchivedForCompany && !s.isArchivedForCourier) || [], [allShipmentsForStats]);
  const returnsWithCouriers = React.useMemo(() => shipments?.filter(s => (statuses?.filter(st => st.isReturnedStatus).map(st => st.id).includes(s.status) || s.isExchange) && !s.isWarehouseReturn && !s.isReturnedToCompany && !s.isReturningToCompany) || [], [shipments, statuses]);
  
  const problemCount = returnedShipmentsNeedingAction.length + longPostponedShipments.length + staleInTransitShipments.length + priceChangeRequests.length;


  const listIsLoading = shipmentsLoading || governoratesLoading || companiesLoading || couriersLoading || statusesLoading;

  // --- Render Functions ---
  const renderShipmentList = (shipmentList: Shipment[], isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 bg-card rounded-lg border">
              <div className="w-full h-8 bg-muted rounded animate-pulse" />
              <div className="w-full h-4 bg-muted rounded animate-pulse mt-3" />
              <div className="w-1/2 h-4 bg-muted rounded animate-pulse mt-2" />
            </div>
          ))}
        </div>
      );
    }
    if (shipmentList.length === 0) {
      return <div className="text-center py-10 text-muted-foreground">لا توجد شحنات في هذه الفئة.</div>;
    }
    return (
      <div className="space-y-3 mt-4">
        {shipmentList.map(shipment => (
          <ShipmentCard
            key={shipment.id}
            shipment={shipment}
            statusConfig={statuses?.find(sc => sc.id === shipment.status)}
            governorateName={governorates?.find(g => g.id === shipment.governorateId)?.name || ''}
            companyName={companies?.find(c => c.id === shipment.companyId)?.name || ''}
            onEdit={openShipmentForm} // Opens a read-only view
          />
        ))}
      </div>
    );
  };

  const renderDesktopTable = (shipmentList: Shipment[], isLoading: boolean) => (
    <ShipmentsTable
      shipments={shipmentList}
      isLoading={isLoading}
      governorates={governorates || []}
      companies={companies || []}
      couriers={courierUsers || []}
      statuses={statuses || []}
      onEdit={openShipmentForm}
      onBulkUpdate={handleGenericBulkUpdate}
      role={role}
    />
  );
  
  const getShipmentsByStatus = (status: string | string[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return filteredShipments.filter(s => statuses.includes(s.status));
  };

  const generateShipmentCode = () => {
    const date = new Date();
    const dateString = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `SK-${dateString}-${randomNum}`;
};

  return (
    <div className="flex flex-col w-full">
      <Tabs defaultValue="shipments">
        <div className="flex items-center">
             <TabsList className="flex-nowrap overflow-x-auto justify-start">
                <TabsTrigger value="shipments">الشحنات</TabsTrigger>
                <TabsTrigger value="returns-with-couriers">مرتجعات لدى المندوب</TabsTrigger>
                <TabsTrigger value="print-center">
                    <Printer className="w-4 h-4 me-2"/>
                    مركز الطباعة
                </TabsTrigger>
                <TabsTrigger value="problem-inbox" className="relative">
                صندوق المشاكل
                {problemCount > 0 && (
                    <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{problemCount}</Badge>
                )}
                </TabsTrigger>
                <TabsTrigger value="chat" className="relative">
                    <MessageSquare className="me-2 h-4 w-4" />
                    <span>الدردشة</span>
                    {totalUnreadCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>
                    )}
                </TabsTrigger>
            </TabsList>
             <div className="ms-auto flex items-center gap-2">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".xlsx, .xls"
                />
                <Button variant="outline" size="sm" onClick={handleImportClick}>
                    <FileUp className="h-4 w-4 me-2" />
                    <span className="sr-only sm:not-sr-only">استيراد</span>
                </Button>
                <Button size="sm" onClick={() => openShipmentForm()}>
                    <PlusCircle className="h-4 w-4 me-2" />
                    <span className="sr-only sm:not-sr-only">شحنة جديدة</span>
                </Button>
            </div>
        </div>
        <StatsCards shipments={allShipmentsForStats || []} role={role} />
        <TabsContent value="shipments">
          <Tabs defaultValue="all-shipments">
            <div className="flex items-center gap-4 flex-wrap mt-4">
               <ShipmentFilters
                  governorates={governorates || []}
                  companies={companies || []}
                  courierUsers={courierUsers || []}
                  statuses={statuses || []}
                  onFiltersChange={setColumnFilters}
                />
            </div>
            <TabsList className="flex-nowrap overflow-x-auto justify-start mt-4">
              <TabsTrigger value="all-shipments">الكل</TabsTrigger>
              <TabsTrigger value="pending">قيد الانتظار</TabsTrigger>
              <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
              <TabsTrigger value="delivered">تم التسليم</TabsTrigger>
              <TabsTrigger value="postponed">المؤجلة</TabsTrigger>
              <TabsTrigger value="returned">مرتجعات</TabsTrigger>
            </TabsList>
            <TabsContent value="all-shipments" className="mt-4">
              {isMobile ? renderShipmentList(filteredShipments, listIsLoading) : renderDesktopTable(filteredShipments, listIsLoading)}
            </TabsContent>
            <TabsContent value="pending" className="mt-4">
              {isMobile ? renderShipmentList(getShipmentsByStatus('Pending'), listIsLoading) : renderDesktopTable(getShipmentsByStatus('Pending'), listIsLoading)}
            </TabsContent>
            <TabsContent value="in-transit" className="mt-4">
              {isMobile ? renderShipmentList(getShipmentsByStatus('In-Transit'), listIsLoading) : renderDesktopTable(getShipmentsByStatus('In-Transit'), listIsLoading)}
            </TabsContent>
            <TabsContent value="delivered" className="mt-4">
              {isMobile ? renderShipmentList(getShipmentsByStatus(['Delivered']), listIsLoading) : renderDesktopTable(getShipmentsByStatus(['Delivered']), listIsLoading)}
            </TabsContent>
            <TabsContent value="postponed" className="mt-4">
              {isMobile ? renderShipmentList(getShipmentsByStatus('Postponed'), listIsLoading) : renderDesktopTable(getShipmentsByStatus('Postponed'), listIsLoading)}
            </TabsContent>
            <TabsContent value="returned" className="mt-4">
              {isMobile ? renderShipmentList(getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']), listIsLoading) : renderDesktopTable(getShipmentsByStatus(['Returned', 'Cancelled', 'Refused (Unpaid)', 'Evasion (Phone)', 'Partially Delivered', 'Evasion (Delivery Attempt)', 'Refused (Paid)']), listIsLoading)}
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="returns-with-couriers">
          <ShipmentsTable 
            shipments={returnsWithCouriers}
            isLoading={listIsLoading}
            governorates={governorates || []}
            companies={companies || []}
            couriers={courierUsers || []}
            statuses={statuses || []}
            onEdit={openShipmentForm}
            role={role}
            onBulkUpdate={handleGenericBulkUpdate}
            activeTab="returns-with-couriers"
            />
        </TabsContent>
        <TabsContent value="print-center">
             <PrintCenterPage 
                shipments={shipments || []}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                courierUsers={courierUsers || []}
                statuses={statuses || []}
                onEdit={openShipmentForm}
                role={role}
                onGenericBulkUpdate={handleGenericBulkUpdate}
            />
        </TabsContent>
        <TabsContent value="problem-inbox">
            <div className="mt-4 space-y-6">
                <ProblemShipmentList title="طلبات تعديل أسعار" icon={<DollarSign className="h-5 w-5 text-yellow-500" />} shipments={priceChangeRequests} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                        const courierName = courierUsers?.find(c => c.id === s.assignedCourierId)?.name;
                        const requestedAmountString = s.requestedAmount ? s.requestedAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' }) : 'N/A';
                        const isProcessing = processingShipments.has(s.id);
                        return (
                            <div>
                                <p className="font-bold">{s.recipientName} - <span className="text-sm text-muted-foreground">بواسطة {courierName}</span></p>
                                <div className="text-sm text-muted-foreground flex items-center gap-4">
                                    <span>السعر الحالي: <span className="font-mono">{s.totalAmount.toLocaleString('ar-EG', { style: 'currency', currency: 'EGP' })}</span></span>
                                    <span className="font-bold text-primary">←</span>
                                    <span>السعر المقترح: <span className="font-mono font-bold text-primary">{requestedAmountString}</span></span>
                                </div>
                                <p className="text-xs text-amber-600 mt-1">السبب: {s.amountChangeReason || 'لم يذكر'}</p>
                                <div className="mt-2 flex gap-2">
                                    <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => handlePriceChangeDecision(s, true)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 className="me-2 h-4 w-4 animate-spin"/> : <Check className="me-2 h-4 w-4" />} موافقة
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => handlePriceChangeDecision(s, false)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 className="me-2 h-4 w-4 animate-spin"/> : <X className="me-2 h-4 w-4" />} رفض
                                    </Button>
                                </div>
                            </div>
                        );
                    }}
                </ProblemShipmentList>
                <ProblemShipmentList title="مرتجعات بحاجة لقرار" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} shipments={returnedShipmentsNeedingAction} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                         const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                         const govName = governorates?.find(g => g.id === s.governorateId)?.name || "N/A";
                        return (<div>
                            <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                            <p className="text-sm text-muted-foreground">{s.address}, {govName}</p>
                        </div>)
                    }}
                </ProblemShipmentList>
                <ProblemShipmentList title="شحنات مؤجلة لفترة طويلة" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} shipments={longPostponedShipments} onEdit={openShipmentForm}>
                     {(s: Shipment) => {
                         const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                         const lastUpdateDate = getSafeDate(s.updatedAt);
                         const daysAgo = lastUpdateDate ? differenceInDays(new Date(), lastUpdateDate) : 0;
                        return (<div>
                            <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                            <p className="text-xs text-amber-600">مؤجلة منذ {daysAgo} أيام</p>
                        </div>)
                    }}
                </ProblemShipmentList>
                <ProblemShipmentList title="شحنات متأخرة عند المناديب" icon={<AlertTriangle className="h-5 w-5 text-destructive" />} shipments={staleInTransitShipments} onEdit={openShipmentForm}>
                    {(s: Shipment) => {
                         const companyName = companies?.find(c => c.id === s.companyId)?.name || "N/A";
                        return (<div>
                            <p className="font-bold">{s.recipientName} - <span className="text-primary">{companyName}</span></p>
                            <p className="text-xs text-red-600">لم يتم تحديثها منذ أكثر من 24 ساعة</p>
                        </div>)
                    }}
                </ProblemShipmentList>
                {problemCount === 0 && (
                <div className="flex flex-col items-center justify-center text-center py-16 bg-muted/40 rounded-lg">
                    <CheckSquare className="h-16 w-16 text-green-500 mb-4" />
                    <h3 className="text-2xl font-bold">لا توجد مشاكل حاليًا</h3>
                    <p className="text-muted-foreground mt-2">صندوق المشاكل فارغ. كل الأمور تسير على ما يرام!</p>
                </div>
                )}
          </div>
        </TabsContent>
        <TabsContent value="chat">
           <ChatInterface />
        </TabsContent>
      </Tabs>
      
      <AlertDialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الخروج</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد أنك تريد الخروج من التطبيق؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleExitConfirm(false)}>البقاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExitConfirm(true)}>الخروج</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShipmentFormSheet
        open={isShipmentSheetOpen}
        onOpenChange={handleSheetOpenChange}
        onSave={handleSaveShipment}
        shipment={editingShipment}
        governorates={governorates || []}
        couriers={courierUsers || []}
        companies={companies || []}
        statuses={statuses || []}
        role={role}
      >
        <div />
      </ShipmentFormSheet>
      {importResult && (
        <ImportProgressDialog
          result={importResult}
          onClose={() => setImportResult(null)}
        />
      )}
    </div>
  );
}
