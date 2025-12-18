
'use client';

import { useState, useEffect, DependencyList } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  DocumentReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field and a 'ref' to a given type T. */
export type WithIdAndRef<T> = T & { id: string, ref: DocumentReference };

/**
 * Interface for the return value of the useCollection hook.
 * @template T Type of the document data.
 */
export interface UseCollectionResult<T> {
  data: WithIdAndRef<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

// A simplified helper to get the path from a query or ref
const getPathFromRefOrQuery = (refOrQuery: CollectionReference | Query): string => {
    if (refOrQuery.type === 'collection') {
        return (refOrQuery as CollectionReference).path;
    }
    // This is a simplified approach. A more robust one might be needed for complex queries.
    // @ts-ignore - _query is an internal but useful property
    const pathSegments = refOrQuery?._query?.path?.segments;
    return pathSegments ? pathSegments.join('/') : '';
}

/**
 * React hook to subscribe to a Firestore collection or query in real-time.
 * 
 * IMPORTANT: You MUST memoize the `refOrQuery` parameter using `useMemo` or `useMemoFirebase`
 * from the provider. Failure to do so will result in infinite loops.
 * 
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} refOrQuery -
 * The Firestore CollectionReference or Query. If null/undefined, the hook will not fetch data.
 * @returns {UseCollectionResult<T>} Object with data, isLoading, error.
 */
export function useCollection<T = any>(
    refOrQuery: CollectionReference<DocumentData> | Query<DocumentData> | null | undefined,
): UseCollectionResult<T> {
  
  const [data, setData] = useState<WithIdAndRef<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    // If the reference is not ready, reset state and do nothing.
    if (!refOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      refOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results = snapshot.docs.map(doc => {
            const docData = doc.data();
            // Manually convert Timestamps to Dates for all fields
            const dataWithDates: { [key: string]: any } = {};
            for (const key in docData) {
                if (docData[key]?.toDate) {
                    dataWithDates[key] = docData[key].toDate();
                } else {
                    dataWithDates[key] = docData[key];
                }
            }
            return { 
                ...(dataWithDates as T), 
                id: doc.id,
                ref: doc.ref // Include the document reference
            };
        });
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        console.error("useCollection error:", err);

        const path = getPathFromRefOrQuery(refOrQuery);
        
        // Create the rich, contextual error for better debugging.
        const permissionError = new FirestorePermissionError({
          operation: 'list',
          path: path,
        });

        // Set the local error state for the component to use.
        setError(permissionError);
        setData(null);
        setIsLoading(false);

        // Emit the error globally so it can be caught by the app's error boundary.
        errorEmitter.emit('permission-error', permissionError);
      }
    );

    // Cleanup function to unsubscribe from the listener when the component unmounts
    // or when the query/reference changes.
    return () => unsubscribe();
  }, [refOrQuery]); // The effect re-runs whenever the query/reference object changes.

  return { data, isLoading, error };
}
