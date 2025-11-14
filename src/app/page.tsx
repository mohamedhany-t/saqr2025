"use client";
import React from "react";
import {
  Package,
  Home,
  Users2,
  LineChart,
  Settings,
  PlusCircle,
  FileUp,
} from "lucide-react";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons";
import { Header } from "@/components/dashboard/header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShipmentsTable } from "@/components/dashboard/shipments-table";
import { mockUsers, mockShipments } from "@/lib/placeholder-data";
import type { Role } from "@/lib/types";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { UsersTable } from "@/components/dashboard/users-table";
import { ShipmentFormSheet } from "@/components/shipments/shipment-form-sheet";

function SidebarNav() {
  const { isMobile } = useSidebar();
  const [activeTab, setActiveTab] = React.useState("dashboard");

  // In a real app, you'd get the user from an auth context
  const user = { name: "Admin User", email: "admin@alsaqr.com", role: "admin", avatar: "/placeholder-user.jpg" };

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      side="right"
      className="border-l"
    >
      <SidebarHeader className="h-16 flex items-center gap-2.5 px-4 justify-between">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <Logo className="size-7 text-primary" />
          <h2 className="font-headline text-lg font-semibold text-sidebar-foreground">
            AlSaqr Logistics
          </h2>
        </div>
        <Logo className="size-7 text-primary hidden group-data-[collapsible=icon]:block" />
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="الرئيسية"
              isActive={activeTab === "dashboard"}
              onClick={() => setActiveTab("dashboard")}
            >
              <Home />
              <span>الرئيسية</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="الشحنات"
              isActive={activeTab === "shipments"}
              onClick={() => setActiveTab("shipments")}
            >
              <Package />
              <span>الشحنات</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user.role === 'admin' && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="المستخدمون"
                isActive={activeTab === "users"}
                onClick={() => setActiveTab("users")}
              >
                <Users2 />
                <span>المستخدمون</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="التقارير"
              isActive={activeTab === "analytics"}
              onClick={() => setActiveTab("analytics")}
            >
              <LineChart />
              <span>التقارير</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <Separator />
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-medium text-sm text-sidebar-foreground">
              {user.name}
            </span>
            <span className="text-xs text-sidebar-foreground/70">{user.email}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardPage() {
  const [role] = React.useState<Role>("admin");
  const [isShipmentSheetOpen, setShipmentSheetOpen] = React.useState(false);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen w-full bg-background">
        <SidebarNav />
        <SidebarInset className="bg-muted/30">
          <Header onAddShipment={() => setShipmentSheetOpen(true)} />
          <main className="p-4 sm:px-6 sm:py-0">
            <Tabs defaultValue="all-shipments">
              <div className="flex items-center">
                <TabsList>
                  <TabsTrigger value="all-shipments">الكل</TabsTrigger>
                  <TabsTrigger value="in-transit">قيد التوصيل</TabsTrigger>
                  <TabsTrigger value="delivered">تم التوصيل</TabsTrigger>
                  <TabsTrigger value="returned">مرتجعات</TabsTrigger>
                </TabsList>
                <div className="ms-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-1">
                    <FileUp className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      استيراد
                    </span>
                  </Button>
                  <ShipmentFormSheet open={isShipmentSheetOpen} onOpenChange={setShipmentSheetOpen}>
                     <Button size="sm" className="h-8 gap-1">
                        <PlusCircle className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                          شحنة جديدة
                        </span>
                      </Button>
                  </ShipmentFormSheet>
                </div>
              </div>
              <StatsCards />
              <TabsContent value="all-shipments">
                <ShipmentsTable shipments={mockShipments} />
              </TabsContent>
              <TabsContent value="in-transit">
                 <ShipmentsTable shipments={mockShipments.filter(s => s.status === 'In-Transit')} />
              </TabsContent>
               <TabsContent value="delivered">
                 <ShipmentsTable shipments={mockShipments.filter(s => s.status === 'Delivered')} />
              </TabsContent>
               <TabsContent value="returned">
                 <ShipmentsTable shipments={mockShipments.filter(s => s.status === 'Returned')} />
              </TabsContent>
            </Tabs>
             {role === "admin" && (
                <div className="mt-8">
                    <h2 className="text-2xl font-headline font-semibold mb-4">إدارة المستخدمين</h2>
                    <UsersTable users={mockUsers} />
                </div>
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
