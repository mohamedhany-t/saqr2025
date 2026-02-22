'use client';

import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * A client-side component that listens for globally emitted Firestore permission errors.
 *
 * In a development environment, it throws the error to leverage Next.js's
 * development error overlay, which provides a rich, interactive debugging experience.
 *
 * In a production environment, it displays a user-friendly toast notification
 * to inform the user of the failure without crashing the application.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: Error) => {
      // In development, always throw to get the rich overlay
      if (process.env.NODE_ENV === 'development') {
        console.error('Firebase/Permission Error caught by listener (DEV):', error);
        throw error;
      }
      
      // In production, only show toast for actual FirestorePermissionError
      if (error instanceof FirestorePermissionError) {
        console.error('Firestore Permission Error caught by listener (PROD):', error);
        toast({
          variant: 'destructive',
          title: 'حدث خطأ في الصلاحيات',
          description: 'ليس لديك الإذن الكافي لتنفيذ هذا الإجراء. يرجى التواصل مع المسؤول.',
        });
      } else {
        // For other generic errors in production, just log them without showing a toast.
        // This prevents showing a scary permission error toast for non-permission issues.
        console.error('Generic Error caught by listener (PROD):', error);
      }
    };

    // Subscribe to the 'permission-error' event.
    errorEmitter.on('permission-error', handleError);

    // Clean up the subscription when the component unmounts.
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]); // The effect depends on the toast function.

  // This component does not render any UI itself.
  return null;
}
