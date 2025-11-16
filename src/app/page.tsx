
"use client";
import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

import type { Role } from "@/lib/types";
import { useUser, useFirestore } from "@/firebase";
import AdminDashboard from "@/components/dashboard/admin-dashboard";
import CourierDashboard from "@/components/dashboard/courier-dashboard";
import CompanyDashboard from "@/components/dashboard/company-dashboard";
import { Button } from "@/components/ui/button";
import { AppLayout }d from "@/components/layout/app-layout";

function PageContent() {
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
            // This is a fallback/setup logic for the very first login or if the user doc is missing
            // For the admin user specified
            if (user.email === "mhanyt21@gmail.com") {
              const adminData = {
                id: user.uid,
                email: user.email,
                role: 'admin',
                name: user.displayName || 'Admin',
                createdAt: serverTimestamp()
              };
              // Create the user and role documents if they don't exist
              if (!userDocSnap.exists()) {
                await setDoc(userDocRef, adminData);
                await setDoc(doc(firestore, 'roles_admin', user.uid), { email: user.email });
              }
              setRole('admin');
            } else {
              // Check role collections for other users
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
                // Create user document if it doesn't exist
                await setDoc(doc(firestore, `users/${user.uid}`), {
                  id: user.uid,
                  email: user.email,
                  name: user.displayName,
                  role: userRole,
                  createdAt: serverTimestamp()
                }, { merge: true });
                setRole(userRole);
              } else {
                setRole(null); // No role found
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
  
  if (isUserLoading || isLoadingRole) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  const renderDashboard = () => {
    switch (role) {
      case "admin":
        return <AdminDashboard role={role} />;
      case "company":
        return <CompanyDashboard role={role} />;
      case "courier":
        return <CourierDashboard role={role} />;
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

  return <AppLayout>{renderDashboard()}</AppLayout>
}

export default function DashboardRouterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <PageContent />
    </Suspense>
  );
}

