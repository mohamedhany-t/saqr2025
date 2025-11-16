import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import "./app/globals.css";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import LoginPage from './app/login/page';
import RegisterPage from './app/register/page';
import DashboardRouterPage from './app/page';
import PrintShipmentPage from './app/print/[shipmentId]/page';
import { useUser } from './firebase';
import { Loader2 } from 'lucide-react';

const metadata: Metadata = {
  title: "AlSaqr Logistics",
  description: "Efficient Shipment Management",
  manifest: "/manifest.json",
  icons: {
    icon: '/fav.png',
    apple: '/fav.png',
  },
};

function App() {
  return (
    <div lang="ar" dir="rtl">
        <div id="printable-area">
          <FirebaseClientProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/print/:shipmentId" element={
                        <ProtectedRoute>
                            <PrintShipmentPage />
                        </ProtectedRoute>
                    } />
                     <Route path="/" element={
                        <ProtectedRoute>
                            <DashboardRouterPage />
                        </ProtectedRoute>
                    } />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </Router>
          </FirebaseClientProvider>
        </div>
        <Toaster />
    </div>
  );
}

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const { user, isUserLoading } = useUser();

    if (isUserLoading) {
        return (
             <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return children;
}


export default App;
