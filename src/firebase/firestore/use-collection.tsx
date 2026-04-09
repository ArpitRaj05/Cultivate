'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

export function useCollection<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  const lastDataJsonRef = useRef<string>("");

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      lastDataJsonRef.current = "";
      return;
    }

    setIsLoading(true);
    setError(null);

    // Safety timeout
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 8000);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      { includeMetadataChanges: false },
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }

        const nextJson = JSON.stringify(results);
        if (nextJson !== lastDataJsonRef.current) {
          lastDataJsonRef.current = nextJson;
          setData(results);
        }
        
        setError(null);
        setIsLoading(false);
        clearTimeout(timer);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: 'collection_query',
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
  }, [memoizedTargetRefOrQuery]);
  
  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error('useCollection: memoizedTargetRefOrQuery was not properly memoized using useMemoFirebase');
  }
  return { data, isLoading, error };
}
