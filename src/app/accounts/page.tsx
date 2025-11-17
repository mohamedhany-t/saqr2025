
"use client";
import React from "react";
// This page is deprecated and its logic is now merged into the courier dashboard.
// It can be safely removed or kept for reference.
// We are redirecting to the main page to avoid confusion.
import { useRouter } from 'next/navigation';
import { Loader2 } from "lucide-react";

export default function DeprecatedAccountsPage() {
    const router = useRouter();
    React.useEffect(() => {
        router.replace('/');
    }, [router]);

    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>جاري إعادة التوجيه...</span>
            </div>
        </div>
    );
}
