
"use client";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { User } from "@/lib/types";
import { useUser, useUserProfile } from "@/firebase";
import AdminDashboard from "@/components/dashboard/admin-dashboard";
import CourierDashboard from "@/components/dashboard/courier-dashboard";
import CompanyDashboard from "@/components/dashboard/company-dashboard";
import { Header } from "@/components/dashboard/header";
import { PwaAndNotificationHandler } from "@/components/pwa-and-notification-handler";

function PageContent() {
  const { user: authUser, isUserLoading: isAuthLoading } = useUser();
  const { userProfile, isProfileLoading } = useUserProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const tab = searchParams.get('tab');
  const chatId = searchParams.get('chatId');


  const isLoading = isAuthLoading || isProfileLoading;
  
  React.useEffect(() => {
    if (!isAuthLoading && !authUser) {
      router.push('/login');
    }
  }, [authUser, isAuthLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const renderDashboard = () => {
    if (!authUser || !userProfile || !userProfile.role) {
      // This case covers when the user is authenticated but has no role document or role field.
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 flex-col gap-4 text-center p-4">
            <h1 className="text-2xl font-bold text-destructive">غير مصرح لك بالدخول</h1>
            <p className="max-w-md">
                ليس لديك الصلاحيات اللازمة لعرض هذه الصفحة. يرجى التواصل مع مسؤول النظام أو إعادة المحاولة.
            </p>
            <button className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md" onClick={() => router.push('/login')}>العودة لصفحة تسجيل الدخول</button>
        </div>
      );
    }
    
    const { role } = userProfile;
    
    const dashboardProps = {
      user: userProfile,
      role: role,
      searchTerm: searchTerm,
      initialTab: tab,
      initialChatId: chatId,
    };

    switch (role) {
      case "admin":
      case "customer-service":
        return <AdminDashboard {...dashboardProps} />;
      case "company":
        return <CompanyDashboard user={userProfile} role={role} searchTerm={searchTerm} />;
      case "courier":
        return <CourierDashboard user={userProfile} role={role} searchTerm={searchTerm} onSearchChange={setSearchTerm} />;
      default:
         return (
             <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <PwaAndNotificationHandler />
      <Header onSearchChange={setSearchTerm} searchTerm={searchTerm} />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        {renderDashboard()}
      </main>
    </div>
  )
}

export default function DashboardRouterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-muted/30"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
        <PageContent />
    </Suspense>
  );
}
