
"use client";
import React, { Suspense } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import type { Role, Shipment } from "@/lib/types";
import { useUser, useFirestore } from "@/firebase";
import AdminDashboard from "@/components/dashboard/admin-dashboard";
import CourierDashboard from "@/components/dashboard/courier-dashboard";
import CompanyDashboard from "@/components/dashboard/company-dashboard";
import { Button } from "@/components/ui/button";

export default function DashboardRouterPage() {
  const [role, setRole] = React.useState<Role | null>(null);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // State for handling shipment editing via URL
  const [editingShipmentFromUrl, setEditingShipmentFromUrl] = React.useState<Shipment | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);

  // Effect to fetch shipment data if 'edit' param is in the URL
  React.useEffect(() => {
    const editShipmentId = searchParams.get('edit');
    if (editShipmentId && firestore) {
      const fetchShipment = async () => {
        const shipmentDocRef = doc(firestore, 'shipments', editShipmentId);
        const shipmentSnap = await getDoc(shipmentDocRef);
        if (shipmentSnap.exists()) {
          setEditingShipmentFromUrl({ id: shipmentSnap.id, ...shipmentSnap.data() } as Shipment);
          setIsEditSheetOpen(true); // Signal to open the sheet
        } else {
          console.warn("Shipment to edit not found");
          navigate('/', { replace: true }); // Use replace to avoid breaking back button
        }
      };
      fetchShipment();
    }
  }, [searchParams, firestore, navigate]);

  // Handler to close the sheet and clean up the URL
  const handleSheetOpenChange = (open: boolean) => {
    setIsEditSheetOpen(open);
    if (!open) {
      setEditingShipmentFromUrl(null);
      navigate('/', { replace: true });
    }
  };
  
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      navigate('/login');
    }
  }, [user, isUserLoading, navigate]);

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

      const dashboardProps = {
        shipmentToEdit: editingShipmentFromUrl,
        isEditSheetOpen: isEditSheetOpen,
        onEditSheetOpenChange: handleSheetOpenChange
      };

      switch (role) {
        case "admin":
          return <AdminDashboard {...dashboardProps} />;
        case "company":
            return <CompanyDashboard {...dashboardProps} />;
        case "courier":
          return <CourierDashboard {...dashboardProps} />;
        default:
          return (
            <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 flex-col gap-4 text-center p-4">
                <h1 className="text-2xl font-bold text-destructive">غير مصرح لك بالدخول</h1>
                <p className="max-w-md">
                    ليس لديك الصلاحيات اللازمة لعرض هذه الصفحة. قد يكون السبب أن حسابك لا يمتلك الدور المناسب أو أنك تحاول الوصول إلى بيانات لا تخصك. يرجى التواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ.
                </p>
                <Button onClick={() => navigate('/login')}>العودة لصفحة تسجيل الدخول</Button>
            </div>
          );
      }
  }

  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <PageContent />
    </Suspense>
  );
}
