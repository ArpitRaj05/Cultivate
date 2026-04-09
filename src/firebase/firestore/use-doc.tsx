'use client';
    
import { useState, useEffect, useRef } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type WithId<T> = T & { id: string };

export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useDoc<T = any>(
  memoizedDocRef: (DocumentReference<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseDocResult<T> {
  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const lastDataJsonRef = useRef<string>("");

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      lastDataJsonRef.current = "";
      return;
    }

    setIsLoading(true);
    setError(null);

    // Safety timeout to prevent permanent hang
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 8000);

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      { includeMetadataChanges: false },
      (snapshot: DocumentSnapshot<DocumentData>) => {
        const rawData = snapshot.exists() ? snapshot.data() : null;
        const nextJson = JSON.stringify(rawData);

        if (nextJson !== lastDataJsonRef.current) {
          lastDataJsonRef.current = nextJson;
          setData(rawData ? { ...(rawData as T), id: snapshot.id } : null);
        }
        
        setError(null);
        setIsLoading(false);
        clearTimeout(timer);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });
        setError(contextualError);
        setData(null);
        setIsLoading(false);
        clearTimeout(timer);
      }
    );

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [memoizedDocRef?.path]);

  if (memoizedDocRef && !memoizedDocRef.__memo) {
    throw new Error('useDoc: memoizedDocRef was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error };
}
