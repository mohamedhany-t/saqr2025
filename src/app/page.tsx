
"use client";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import type { Role } from "@/lib/types";
import { useUser, useFirestore } from "@/firebase";
import AdminDashboard from "@/components/dashboard/admin-dashboard";
import CourierDashboard from "@/components/dashboard/courier-dashboard";
import CompanyDashboard from "@/components/dashboard/company-dashboard";
import { Button } from "@/components/ui/button";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";

function EditShipmentHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editShipmentId = searchParams.get('edit');
    const firestore = useFirestore();
    
    const [isOpen, setIsOpen] = React.useState(false);
    const [editingShipment, setEditingShipment] = React.useState(null);
    const [isLoading, setIsLoading] = React.useState(true);

    React.useEffect(() => {
        if (editShipmentId && firestore) {
            const fetchShipment = async () => {
                setIsLoading(true);
                const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
                const shipmentSnap = await getDoc(shipmentDocRef);
                if (shipmentSnap.exists()) {
                    setEditingShipment({ id: shipmentSnap.id, ...shipmentSnap.data() } as any);
                    setIsOpen(true);
                } else {
                    console.warn("Shipment to edit not found");
                    // Optionally clear the URL param
                    router.replace('/', undefined);
                }
                setIsLoading(false);
            };
            fetchShipment();
        } else {
            setIsLoading(false);
        }
    }, [editShipmentId, firestore, router]);
    
    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            // When sheet is closed, remove the 'edit' query param
             router.replace('/', undefined);
        }
    };
    
    // This component doesn't render anything itself, just manages the sheet state
    // We could render a loader, but the main page already has one.
    // The actual Sheet is rendered in the main DashboardRouterPage component.
    // For now, this is a placeholder to show the logic.
    return null;
}


export default function DashboardRouterPage() {
  const [role, setRole] = React.useState<Role | null>(null);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  React.useEffect(() => {
    if (user && firestore) {
      const checkRole = async () => {
        setIsLoadingRole(true);
        const userDocRef = doc(firestore, `users/${user.uid}`);
        
        try {
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists() && userDocSnap.data().role) {
            setRole(userDocSnap.data().role);
          } else {
            // This logic is primarily for the initial admin setup
            if (user.email === "mhanyt21@gmail.com") {
              const adminData = {
                id: user.uid,
                email: user.email,
                role: 'admin',
                name: 'Admin',
                createdAt: serverTimestamp()
              };
              if (!userDocSnap.exists()) {
                await setDoc(userDocRef, adminData);
                await setDoc(doc(firestore, 'roles_admin', user.uid), { email: user.email });
              }
              setRole('admin');
            } else {
              // For other users, check role collections if user doc is incomplete
              let userRole: Role | null = null;
              const adminSnap = await getDoc(doc(firestore, `roles_admin/${user.uid}`));
              if (adminSnap.exists()) userRole = 'admin';
              else {
                const companySnap = await getDoc(doc(firestore, `roles_company/${user.uid}`));
                if (companySnap.exists()) userRole = 'company';
                else {
                    const courierSnap = await getDoc(doc(firestore, `roles_courier/${user.uid}`));
                    if (courierSnap.exists()) userRole = 'courier';
                }
              }

              if (userRole) {
                await setDoc(doc(firestore, `users/${user.uid}`), {
                  id: user.uid,
                  email: user.email,
                  role: userRole,
                  createdAt: serverTimestamp()
                }, { merge: true });
                setRole(userRole);
              } else {
                setRole(null); 
              }
            }
          }
        } catch (error) {
            console.error("Error fetching user role:", error);
            setRole(null);
        } finally {
            setIsLoadingRole(false);
        }
      };

      checkRole();
    }
  }, [user, firestore]);
  
  const PageContent = () => {
      if (isUserLoading || isLoadingRole) {
        return (
          <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        );
      }

      switch (role) {
        case "admin":
          return <AdminDashboard />;
        case "company":
            return <CompanyDashboard />;
        case "courier":
          return <CourierDashboard />;
        default:
          return (
            <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 flex-col gap-4 text-center p-4">
                <h1 className="text-2xl font-bold text-destructive">غير مصرح لك بالدخول</h1>
                <p className="max-w-md">
                    ليس لديك الصلاحيات اللازمة لعرض هذه الصفحة. قد يكون السبب أن حسابك لا يمتلك الدور المناسب أو أنك تحاول الوصول إلى بيانات لا تخصك. يرجى التواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ.
                </p>
                <Button onClick={() => router.push('/login')}>العودة لصفحة تسجيل الدخول</Button>
            </div>
          );
      }
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <EditShipmentHandler />
        <PageContent />
    </Suspense>
  );
}
