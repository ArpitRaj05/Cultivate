'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Global throttle map to prevent write storms
const writeThrottleMap = new Map<string, string>();
const lastWriteTimeMap = new Map<string, number>();
const HEARTBEAT_INTERVAL = 20000; // 20s heartbeat for presence/status

/** Non-blocking setDoc with an optional throttle */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  setDoc(docRef, data, options || {}).catch(async (e) => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: options && 'merge' in options ? 'update' : 'create',
        requestResourceData: data,
      }));
    }
  });
}

/** Non-blocking addDoc */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  return addDoc(colRef, data).catch(async (e) => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: colRef.path,
        operation: 'create',
        requestResourceData: data,
      }));
    }
  });
}

/** 
 * Non-blocking updateDoc with a state-aware throttle.
 * CRITICAL: Progress updates (minutes) ALWAYS bypass the throttle for real-time accuracy.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const now = Date.now();
  const path = docRef.path;
  
  // Progress fields MUST always bypass throttle
  const progressFields = ['todayMinutes', 'weeklyMinutes', 'monthlyMinutes', 'monthlyMinutesGoal'];
  const hasProgressUpdate = progressFields.some(field => field in data);
  
  // Presence/Status fields candidates for throttling
  const isPresenceUpdate = 'status' in data || 'isStudying' in data || 'lastActive' in data;
  
  if (isPresenceUpdate && !hasProgressUpdate) {
    const currentStateString = JSON.stringify({ status: data.status, isStudying: data.isStudying });
    const lastStateString = writeThrottleMap.get(path);
    const lastWriteTime = lastWriteTimeMap.get(path) || 0;

    // If intent has changed (User clicked stop/start), ALWAYS bypass
    if (currentStateString !== lastStateString) {
      writeThrottleMap.set(path, currentStateString);
      lastWriteTimeMap.set(path, now);
    } else {
      // Periodic heartbeats only every 20s
      if (now - lastWriteTime < HEARTBEAT_INTERVAL) {
        return;
      }
      lastWriteTimeMap.set(path, now);
    }
  }

  updateDoc(docRef, data).catch(async (e) => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data,
      }));
    }
  });
}

/** Non-blocking deleteDoc */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef).catch(async (e) => {
    if (e.code === 'permission-denied') {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      }));
    }
  });
}
