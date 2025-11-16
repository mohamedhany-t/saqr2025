

"use client";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, Governorate, Courier, ShipmentStatus, User } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { Header } from "@/components/dashboard/header";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser, useDoc } from "@/firebase";
import { collection, serverTimestamp, doc, query, where, updateDoc, getDoc, writeBatch } from "firebase/firestore";

interface CourierDashboardProps {
  shipmentToEdit?: Shipment | null;
  isEditSheetOpen?: boolean;
  onEditSheetOpenChange?: (open: boolean) => void;
}

export default function CourierDashboard({ shipmentToEdit, isEditSheetOpen, onEditSheetOpenChange }: CourierDashboardProps) {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const role: Role = 'courier';

  React.useEffect(() => {
    if (shipmentToEdit && isEditSheetOpen !== undefined && onEditSheetOpenChange) {
      setEditingShipment(shipmentToEdit);
      setShipmentSheetOpen(true);
    }
  }, [shipmentToEdit, isEditSheetOpen, onEditSheetOpenChange]);

  const handleLocalSheetOpenChange = (open: boolean) => {
    if (onEditSheetOpenChange && editingShipment?.id === shipmentToEdit?.id) {
      onEditSheetOpenChange(open);
    }
    setShipmentSheetOpen(open);
    if (!open) {
      setEditingShipment(undefined);
    }
  };

  const userQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: courierUser } = useDoc<User>(userQuery);


  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'shipments'), where("assignedCourierId", "==", user.uid));
  }, [firestore, user]);
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'governorates');
  }, [firestore, user]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const couriersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'couriers');
  }, [firestore, user]);
  const { data: couriers } = useCollection<Courier>(couriersQuery);
  
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, user]);
  const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);

  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };
  
  const calculateCommissionAndPaidAmount = (status: ShipmentStatus, totalAmount: number, collectedAmount: number, commissionRate: number) => {
    const update: { paidAmount?: number; courierCommission?: number, collectedAmount?: number } = {};
    switch (status) {
        case 'Delivered':
            update.paidAmount = totalAmount;
            update.courierCommission = commissionRate;
            update.collectedAmount = totalAmount; 
            break;
        case 'Partially Delivered':
            update.paidAmount = collectedAmount;
            update.courierCommission = commissionRate;
            break;
        case 'Evasion':
            update.paidAmount = 0;
            update.courierCommission = commissionRate;
            update.collectedAmount = 0;
            break;
        default: // Returned, Cancelled, etc.
            update.paidAmount = 0;
            update.courierCommission = 0;
            update.collectedAmount = 0;
            break;
    }
    return update;
  }

  const handleSaveShipment = async (shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !id || !user || !courierUser) return;

    const originalShipmentDocSnap = await getDoc(doc(firestore, 'shipments', id));
    if (!originalShipmentDocSnap.exists()) {
        toast({ title: "Shipment not found", variant: "destructive" });
        return;
    }
    const originalShipmentData = originalShipmentDocSnap.data() as Shipment;

    const commissionRate = courierUser.commissionRate || 0;

    const dataToUpdate: { [key: string]: any } = {
        updatedAt: serverTimestamp(),
    };

    if (shipment.status !== undefined) dataToUpdate.status = shipment.status;
    if (shipment.reason !== undefined) dataToUpdate.reason = shipment.reason;
    const collectedAmount = shipment.collectedAmount !== undefined ? Number(shipment.collectedAmount) : originalShipmentData.collectedAmount || 0;
    if (shipment.collectedAmount !== undefined) dataToUpdate.collectedAmount = collectedAmount;

    const newStatus = shipment.status || originalShipmentData.status;

    const calculatedFields = calculateCommissionAndPaidAmount(newStatus, originalShipmentData.totalAmount, collectedAmount, commissionRate);
    Object.assign(dataToUpdate, calculatedFields);

    if (Object.keys(dataToUpdate).length <= 1) { // Only updatedAt
        toast({ title: "لا توجد تغييرات للحفظ", variant: "default"});
        handleLocalSheetOpenChange(false);
        return;
    }

    const docRef = doc(firestore, 'shipments', id);
    
    updateDoc(docRef, dataToUpdate)
      .then(() => {
        toast({
          title: "تم تحديث الشحنة",
          description: `تم تحديث حالة الشحنة بنجاح`,
        });
        handleLocalSheetOpenChange(false);
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: dataToUpdate
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleBulkUpdateShipments = (selectedRows: Shipment[], update: Partial<Shipment>) => {
    if (!firestore || !courierUser) return;
    if (selectedRows.length === 0) {
        toast({ title: "لم يتم تحديد أي شحنات", variant: "destructive" });
        return;
    }

    const commissionRate = courierUser.commissionRate || 0;
    const batch = writeBatch(firestore);

    selectedRows.forEach(row => {
        const docRef = doc(firestore, "shipments", row.id);
        
        let finalUpdate: { [key: string]: any } = { updatedAt: serverTimestamp() };
        
        const allowedUpdates: Partial<Shipment> = {};
        if (update.status) allowedUpdates.status = update.status;
        if (update.reason) allowedUpdates.reason = update.reason;

        if (Object.keys(allowedUpdates).length === 0) {
            return;
        }

        const newStatus = allowedUpdates.status || row.status;
        const calculatedFields = calculateCommissionAndPaidAmount(newStatus, row.totalAmount, row.collectedAmount || 0, commissionRate);

        Object.assign(finalUpdate, allowedUpdates, calculatedFields);
        
        batch.update(docRef, finalUpdate);
    });

    batch.commit().then(() => {
        toast({ title: `تم تحديث ${selectedRows.length} شحنة بنجاح` });
    }).catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: 'shipments',
            operation: 'update',
            requestResourceData: { update, note: `Bulk update of ${selectedRows.length} documents.` }
        });
        errorEmitter.emit('permission-error', permissionError);
    });
};

  
  const filteredShipments = React.useMemo(() => {
    if (!shipments) return [];
    if (!searchTerm) return shipments;
    return shipments.filter(shipment => 
        shipment.shipmentCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.recipientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.trackingNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [shipments, searchTerm]);


  return (
    <div className="min-h-screen w-full bg-muted/30">
      <Header onSearchChange={setSearchTerm}/>
      <main className="p-4 sm:px-6 sm:py-0">
        <Tabs defaultValue="all-shipments">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="all-shipments">الكل</TabsTrigger>
              <TabsTrigger value="in-transit" className="hidden sm:flex">قيد التوصيل</TabsTrigger>
              <TabsTrigger value="delivered" className="hidden sm:flex">تم التوصيل</TabsTrigger>
              <TabsTrigger value="returned" className="hidden sm:flex">مرتجعات</TabsTrigger>
              <TabsTrigger value="returned-to-sender" className="hidden sm:flex">مرتجع للراسل</TabsTrigger>
            </TabsList>
          </div>
          <StatsCards shipments={shipments || []} role={role} />
          <TabsContent value="all-shipments">
            <ShipmentsTable 
              shipments={filteredShipments} 
              isLoading={shipmentsLoading}
              governorates={governorates || []}
              companies={[]}
              couriers={couriers || []}
              onEdit={openShipmentForm}
              onBulkUpdate={handleBulkUpdateShipments}
              role={role}
            />
          </TabsContent>
          <TabsContent value="in-transit">
             <ShipmentsTable 
                shipments={filteredShipments.filter(s => s.status === 'In-Transit')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={[]}
                couriers={couriers || []}
                onEdit={openShipmentForm}
                onBulkUpdate={handleBulkUpdateShipments}
                role={role}
             />
          </TabsContent>
           <TabsContent value="delivered">
             <ShipmentsTable 
                shipments={filteredShipments.filter(s => s.status === 'Delivered' || s.status === 'Partially Delivered')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={[]}
                couriers={couriers || []}
                onEdit={openShipmentForm}
                onBulkUpdate={handleBulkUpdateShipments}
                role={role}
             />
          </TabsContent>
           <TabsContent value="returned">
             <ShipmentsTable 
                shipments={filteredShipments.filter(s => s.status === 'Returned' || s.status === 'Cancelled' || s.status === 'Evasion')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={[]}
                couriers={couriers || []}
                onEdit={openShipmentForm}
                onBulkUpdate={handleBulkUpdateShipments}
                role={role}
             />
          </TabsContent>
           <TabsContent value="returned-to-sender">
             <ShipmentsTable 
                shipments={filteredShipments.filter(s => s.status === 'Returned to Sender')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={[]}
                couriers={couriers || []}
                onEdit={openShipmentForm}
                onBulkUpdate={handleBulkUpdateShipments}
                role={role}
             />
          </TabsContent>
        </Tabs>
      </main>
       <ShipmentFormSheet
        open={isShipmentSheetOpen}
        onOpenChange={handleLocalSheetOpenChange}
        onSave={handleSaveShipment}
        shipment={editingShipment}
        governorates={governorates || []}
        couriers={users?.filter(u => u.role === 'courier') || []}
        role={role}
      >
        <div />
      </ShipmentFormSheet>
    </div>
  );
}
