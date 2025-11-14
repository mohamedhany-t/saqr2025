
"use client";
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import type { Role, Shipment, Company, SubClient, Governorate, Courier, ShipmentStatus } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";
import { Header } from "@/components/dashboard/header";
import { useToast } from "@/hooks/use-toast";
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from "@/firebase";
import { collection, serverTimestamp, doc, query, where, updateDoc } from "firebase/firestore";

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

  const companiesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'companies') : null, [firestore]);
  const { data: companies } = useCollection<Company>(companiesQuery);

  const subClientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'subclients') : null, [firestore]);
  const { data: subClients } = useCollection<SubClient>(subClientsQuery);

  const governoratesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'governorates') : null, [firestore]);
  const { data: governorates } = useCollection<Governorate>(governoratesQuery);

  const deliveryCompaniesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'deliveryCompanies') : null, [firestore]);
  const { data: deliveryCompanies } = useCollection<Company>(deliveryCompaniesQuery);

  const couriersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'couriers') : null, [firestore]);
  const { data: couriers } = useCollection<Courier>(couriersQuery);

  const openShipmentForm = (shipment?: Shipment) => {
    setEditingShipment(shipment);
    setShipmentSheetOpen(true);
  };

  const handleSaveShipment = (shipment: Partial<Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>>, id?: string) => {
    if (!firestore || !id) return;

    // Couriers can only update status and reason
    const dataToUpdate: { status?: ShipmentStatus; reason?: string; updatedAt: any } = {
        updatedAt: serverTimestamp(),
    };
    if (shipment.status) {
        dataToUpdate.status = shipment.status;
    }
    if (shipment.reason) {
        dataToUpdate.reason = shipment.reason;
    }
    
    if (Object.keys(dataToUpdate).length === 1) { // Only updatedAt
        toast({ title: "لا توجد تغييرات للحفظ", variant: "destructive"});
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
                shipments={filteredShipments.filter(s => s.status === 'Delivered')}
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
        couriers={couriers || []}
        role={role}
      >
        {/* This component is now controlled programmatically, so no trigger child is needed here. */}
        <div />
      </ShipmentFormSheet>
    </div>
  );
}

    