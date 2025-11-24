
"use client";
import React from "react";
import { StatsCards } from "@/components/dashboard/stats-cards";
import type { Role, Shipment, User, CourierPayment } from "@/lib/types";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";

interface CourierAccountsPageProps {
  role: Role | null;
}

export function CourierAccountsPage({ role }: CourierAccountsPageProps) {
  const { user } = useUser();
  const firestore = useFirestore();

  const shipmentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'shipments'), where("assignedCourierId", "==", user.uid));
  }, [firestore, user]);
  
  const { data: shipments, isLoading: shipmentsLoading } = useCollection<Shipment>(shipmentsQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'courier_payments'), where("courierId", "==", user.uid));
  }, [firestore, user]);

  const { data: payments, isLoading: paymentsLoading } = useCollection<CourierPayment>(paymentsQuery);


  if (shipmentsLoading || paymentsLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
        <h1 className="text-2xl font-bold mb-4">ملخص الحسابات</h1>
        <p className="text-muted-foreground mb-6">
            هنا يمكنك رؤية ملخص مالي لجميع شحناتك، بما في ذلك المبالغ المحصلة وعمولاتك والمدفوعات التي قمت بها.
        </p>
        <StatsCards shipments={shipments || []} payments={payments || []} role={role} />
    </div>
  );
}
