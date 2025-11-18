
"use client";
import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

import type { Role, User } from "@/lib/types";
import { useUser, useFirestore, useDoc } from "@/firebase";
import AdminDashboard from "@/components/dashboard/admin-dashboard";
import CourierDashboard from "@/components/dashboard/courier-dashboard";
import CompanyDashboard from "@/components/dashboard/company-dashboard";
import { AppLayout } from "@/components/layout/app-layout";

function PageContent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // Use the useDoc hook for a real-time, cleaner user profile fetching
  const userDocRef = React.useMemo(() => {
    if (!user || !firestore) return null;
    return doc(firestore, `users/${user.uid}`);
  }, [user, firestore]);

  const { data: userProfile, isLoading: isRoleLoading } = useDoc<User>(userDocRef);

  const role = userProfile?.role ?? null;
  
  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || (user && isRoleLoading)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const renderContent = () => {
    if (!user) {
        // This case is handled by the useEffect redirect, but it's good practice
        // to have a fallback render.
        return (
             <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    switch (role) {
      case "admin":
        return <AdminDashboard role={role} />;
      case "company":
        return <CompanyDashboard role={role} />;
      case "courier":
        return <CourierDashboard role={role} />;
      default:
        // This case covers when the user is authenticated but has no role document or role field.
        return (
          <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 flex-col gap-4 text-center p-4">
              <h1 className="text-2xl font-bold text-destructive">غير مصرح لك بالدخول</h1>
              <p className="max-w-md">
                  ليس لديك الصلاحيات اللازمة لعرض هذه الصفحة. يرجى التواصل مع مسؤول النظام.
              </p>
              <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md" onClick={() => router.push('/login')}>العودة لصفحة تسجيل الدخول</button>
          </div>
        );
    }
  }

  return <AppLayout>{renderContent()}</AppLayout>
}

export default function DashboardRouterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <PageContent />
    </Suspense>
  );
}
