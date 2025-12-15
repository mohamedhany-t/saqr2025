"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "أهلاً بك مرة أخرى! سيتم توجيهك إلى لوحة التحكم.",
      });
      router.replace('/'); // Use replace to prevent going back to login page
    } catch (error: any) {
      console.error(error);
      let description = "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      }
      toast({
        variant: "destructive",
        title: "خطأ في تسجيل الدخول",
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
                <CardTitle className="text-2xl font-headline mt-4">تسجيل الدخول</CardTitle>
                <CardDescription>
                  أدخل بريدك الإلكتروني وكلمة المرور للدخول إلى لوحة التحكم الخاصة بك.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleLogin} className="grid gap-4">
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
                    <div className="flex items-center">
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Link href="#" className="ms-auto inline-block text-sm underline">
                        نسيت كلمة المرور؟
                    </Link>
                    </div>
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
                    {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                </Button>
                </form>
                 <div className="mt-4 text-center text-sm">
                  لا تملك حسابًا؟ يجب على المسؤول إنشاء حساب لك.
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
