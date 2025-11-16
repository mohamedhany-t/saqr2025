
"use client";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, SubClient, Governorate, Courier, ShipmentStatus, User } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { Header } from "@/components/dashboard/header";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, query, where, updateDoc, getDoc, writeBatch } from "firebase/firestore";

export default function CourierDashboard() {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const role: Role = 'courier';

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

  const companiesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'companies');
  }, [firestore, user]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const subClientsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'subclients');
  }, [firestore, user]);
  const { data: subClients } = useCollection<SubClient>(subClientsQuery);

  const governoratesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'governorates');
  }, [firestore, user]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const deliveryCompaniesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'deliveryCompanies');
  }, [firestore, user]);
  const { data: deliveryCompanies } = useCollection<Company>(deliveryCompaniesQuery);

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

    // Always include status, reason, and collectedAmount if they are in the form data
    if (shipment.status !== undefined) dataToUpdate.status = shipment.status;
    if (shipment.reason !== undefined) dataToUpdate.reason = shipment.reason;
    const collectedAmount = shipment.collectedAmount !== undefined ? Number(shipment.collectedAmount) : originalShipmentData.collectedAmount || 0;
    if (shipment.collectedAmount !== undefined) dataToUpdate.collectedAmount = collectedAmount;

    const newStatus = shipment.status || originalShipmentData.status;

    // Recalculate paid amount and commission based on the new status
    const calculatedFields = calculateCommissionAndPaidAmount(newStatus, originalShipmentData.totalAmount, collectedAmount, commissionRate);
    Object.assign(dataToUpdate, calculatedFields);

    if (Object.keys(dataToUpdate).length <= 1) { // Only updatedAt
        toast({ title: "لا توجد تغييرات للحفظ", variant: "default"});
        setShipmentSheetOpen(false);
        return;
    }

    const docRef = doc(firestore, 'shipments', id);
    
    updateDoc(docRef, dataToUpdate)
      .then(() => {
        toast({
          title: "تم تحديث الشحنة",
          description: `تم تحديث حالة الشحنة بنجاح`,
        });
        setShipmentSheetOpen(false);
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
        
        // Only allow status and reason from the bulk update dropdown
        const allowedUpdates: Partial<Shipment> = {};
        if (update.status) allowedUpdates.status = update.status;
        if (update.reason) allowedUpdates.reason = update.reason;

        if (Object.keys(allowedUpdates).length === 0) {
            return; // Skip if no valid fields to update
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
            </TabsList>
          </div>
          <StatsCards shipments={shipments || []} role={role} companies={companies || []} />
          <TabsContent value="all-shipments">
            <ShipmentsTable 
              shipments={filteredShipments} 
              isLoading={shipmentsLoading}
              governorates={governorates || []}
              companies={companies || []}
              deliveryCompanies={deliveryCompanies || []}
              couriers={couriers || []}
              subClients={subClients || []}
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
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
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
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
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
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
                onEdit={openShipmentForm}
                onBulkUpdate={handleBulkUpdateShipments}
                role={role}
             />
          </TabsContent>
        </Tabs>
      </main>
       <ShipmentFormSheet
        open={isShipmentSheetOpen}
        onOpenChange={setShipmentSheetOpen}
        onSave={handleSaveShipment}
        shipment={editingShipment}
        governorates={governorates || []}
        companies={companies || []}
        subClients={subClients || []}
        couriers={users?.filter(u => u.role === 'courier') || []}
        role={role}
      >
        {/* This component is now controlled programmatically, so no trigger child is needed here. */}
        <div />
      </ShipmentFormSheet>
    </div>
  );
}
