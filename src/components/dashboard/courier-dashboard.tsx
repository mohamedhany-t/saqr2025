
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
import { collection, serverTimestamp, doc, query, where, updateDoc, getDoc } from "firebase/firestore";

export default function CourierDashboard() {
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);
  const [editingShipment, setEditingShipment] = React.useState<Shipment | undefined>(undefined);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const role: Role = 'courier';

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

 const handleSaveShipment = async (shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !id || !user) return;

    const originalShipmentDocSnap = await getDoc(doc(firestore, 'shipments', id));
    if (!originalShipmentDocSnap.exists()) {
        toast({ title: "Shipment not found", variant: "destructive" });
        return;
    }
    const originalShipmentData = originalShipmentDocSnap.data() as Shipment;

    const courierUserDoc = await getDoc(doc(firestore, 'users', user.uid));
    const commissionRate = courierUserDoc.data()?.commissionRate || 0;

    const dataToUpdate: { [key: string]: any } = {
        updatedAt: serverTimestamp(),
    };

    if (shipment.status && shipment.status !== originalShipmentData.status) {
        dataToUpdate.status = shipment.status;
        
        if (shipment.status === 'Delivered') {
            dataToUpdate.paidAmount = originalShipmentData.totalAmount;
            dataToUpdate.courierCommission = commissionRate;
        } else if (shipment.status === 'Partially Delivered') {
            const collectedAmount = Number(shipment.collectedAmount) || 0;
            dataToUpdate.paidAmount = collectedAmount;
            dataToUpdate.courierCommission = commissionRate;
        } else if (shipment.status === 'Evasion') {
            dataToUpdate.paidAmount = 0;
            dataToUpdate.courierCommission = commissionRate;
        } else {
            dataToUpdate.paidAmount = 0;
            dataToUpdate.courierCommission = 0;
        }
    }
    if (shipment.reason !== undefined) {
        dataToUpdate.reason = shipment.reason;
    }
    if (shipment.collectedAmount !== undefined) {
        dataToUpdate.collectedAmount = Number(shipment.collectedAmount);
    }
    
    // Specifically check for status change to 'Delivered' to update paidAmount
    if(shipment.status === 'Delivered'){
        dataToUpdate.paidAmount = originalShipmentData.totalAmount;
    }


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
                role={role}
             />
          </TabsContent>
           <TabsContent value="returned">
             <ShipmentsTable 
                shipments={filteredShipments.filter(s => s.status === 'Returned')}
                isLoading={shipmentsLoading}
                governorates={governorates || []}
                companies={companies || []}
                deliveryCompanies={deliveryCompanies || []}
                couriers={couriers || []}
                subClients={subClients || []}
                onEdit={openShipmentForm}
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

    