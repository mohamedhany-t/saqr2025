"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';

// This page is currently not used directly by users. 
// Account creation is handled by the admin.
// It's kept for potential future use or direct access if needed.
export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({
        title: "تم إنشاء الحساب بنجاح",
        description: "سيتم تحويلك إلى لوحة التحكم.",
      });
      router.push('/');
    } catch (error: any) {
      console.error(error);
      let description = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
      if (error.code === 'auth/email-already-in-use') {
        description = "هذا البريد الإلكتروني مستخدم بالفعل.";
      } else if (error.code === 'auth/weak-password') {
        description = "كلمة المرور ضعيفة جدًا. يجب أن تتكون من 6 أحرف على الأقل."
      }
      toast({
        variant: "destructive",
        title: "خطأ في إنشاء الحساب",
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="mx-auto max-w-sm w-full">
            <CardHeader className="text-center">
                <Logo className="mx-auto size-10 text-primary" />
                <CardTitle className="text-2xl font-headline mt-4">إنشاء حساب جديد</CardTitle>
                <CardDescription>
                  هذه الصفحة مخصصة للاستخدام الداخلي. يتم إنشاء حسابات المستخدمين بواسطة المسؤول.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleRegister} className="grid gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                    id="email"
                    type="email"
                    placeholder="m@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input 
                        id="password" 
                        type="password" 
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        dir="ltr"
                    />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
                </Button>
                </form>
                <div className="mt-4 text-center text-sm">
                لديك حساب بالفعل؟{" "}
                <Link href="/login" className="underline">
                    تسجيل الدخول
                </Link>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
