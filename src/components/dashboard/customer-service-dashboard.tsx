
"use client";
import React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, User, Chat, ShipmentHistory, ShipmentStatusConfig } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, getDoc } from "firebase/firestore";
import { useIsMobile } from "@/hooks/use-mobile";
import { ShipmentCard } from "@/components/shipments/shipment-card";
import { MessageSquare } from "lucide-react";
import ChatInterface from "../chat/chat-interface";
import { Badge } from "../ui/badge";

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
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Data Fetching ---
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

  const handleSaveShipment = () => {
    // Customer service does not save/edit shipments.
    toast({
      title: "غير مصرح لك",
      description: "دور خدمة العملاء لا يمتلك صلاحية تعديل الشحنات.",
      variant: "destructive",
    });
    handleSheetOpenChange(false);
  };
  
  const filteredShipments = React.useMemo(() => {
    if (!shipments) return [];
    if (!searchTerm) return shipments;
    const lowercasedTerm = searchTerm.toLowerCase();
    return shipments.filter(shipment =>
      String(shipment.shipmentCode || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.orderNumber || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.recipientName || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.recipientPhone || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.trackingNumber || '').toLowerCase().includes(lowercasedTerm) ||
      String(shipment.address || '').toLowerCase().includes(lowercasedTerm)
    );
  }, [shipments, searchTerm]);

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
      role={role}
    />
  );
  
  const getShipmentsByStatus = (status: string | string[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return filteredShipments.filter(s => statuses.includes(s.status));
  };

  return (
    <div className="flex flex-col w-full">
      <Tabs defaultValue="shipments">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shipments">الشحنات</TabsTrigger>
            <TabsTrigger value="chat" className="relative">
                <MessageSquare className="me-2 h-4 w-4" />
                <span>الدردشة</span>
                {totalUnreadCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 justify-center p-0">{totalUnreadCount}</Badge>
                )}
            </TabsTrigger>
        </TabsList>
        <StatsCards shipments={shipments || []} role={role} />
        <TabsContent value="shipments">
          <Tabs defaultValue="all-shipments">
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
        <TabsContent value="chat">
           <ChatInterface />
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
