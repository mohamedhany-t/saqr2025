
"use client";
import React, { Suspense } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";

import type { Role } from "@/lib/types";
import { useUser, useFirestore } from "@/firebase";
import { AppLayout } from "@/components/layout/app-layout";
import { CourierAccountsPage } from "@/components/dashboard/courier-accounts";

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
            setRole(null); // No role found
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

  const renderContent = () => {
    if (role === "courier") {
      return <CourierAccountsPage role={role} />;
    }
    // Redirect other roles or show an error
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 flex-col gap-4 text-center p-4">
            <h1 className="text-2xl font-bold text-destructive">غير مصرح لك بالدخول</h1>
            <p className="max-w-md">
                هذه الصفحة مخصصة للمناديب فقط.
            </p>
            <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md" onClick={() => router.push('/')}>العودة للرئيسية</button>
        </div>
    );
  }

  return <AppLayout>{renderContent()}</AppLayout>
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <PageContent />
    </Suspense>
  );
}
