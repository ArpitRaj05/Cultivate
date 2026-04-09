"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase'
import { collection, query, where, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, DoorOpen, Leaf, Check, Users, Play, UserPlus, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { useIsMobile } from '@/hooks/use-mobile'

export default function StudyRoomPage() {
  const { roomCode } = useParams()
  const { user, isUserLoading } = useUser()
  const db = useFirestore()
  const router = useRouter()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const [room, setRoom] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isLeaving, setIsLeaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  
  const userProfileRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(userProfileRef)

  const profileDataRef = useRef<any>(null)
  const prevRoomRef = useRef<any>(null)

  useEffect(() => {
    if (profile) profileDataRef.current = profile
  }, [profile])

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/')
  }, [user, isUserLoading, router])

  // Get UIDs of participants to fetch their profiles dynamically (fixes 1MB error)
  const participantUids = useMemo(() => {
    if (!room?.participants) return []
    return room.participants.map((p: any) => p.uid).slice(0, 30)
  }, [room?.participants])

  const participantProfilesQuery = useMemoFirebase(() => {
    if (participantUids.length === 0) return null
    return query(collection(db, 'users'), where('id', 'in', participantUids))
  }, [db, participantUids.join(',')])

  const { data: participantProfiles } = useCollection(participantProfilesQuery)

  // Map profile images to participants
  const participantsWithProfiles = useMemo(() => {
    if (!room?.participants) return []
    return room.participants.map((p: any) => {
      const fullProfile = participantProfiles?.find(pro => pro.id === p.uid)
      return {
        ...p,
        profileImageUrl: fullProfile?.profileImageUrl || '',
      }
    })
  }, [room?.participants, participantProfiles])

  // Instant Add Participant Logic - Slim data only
  useEffect(() => {
    if (!room || !user || !profile || isLeaving) return
    const isAlreadyIn = (room.participants || []).some((p: any) => p.uid === user.uid)
    if (!isAlreadyIn) {
      const roomRef = doc(db, 'studyRooms', room.id)
      updateDoc(roomRef, {
        participants: [
          ...room.participants,
          {
            uid: user.uid,
            displayName: profile.firstName,
            joinedAt: new Date().toISOString()
          }
        ]
      }).catch(e => console.error("Auto-join failed", e))
    }
  }, [room?.id, user?.uid, !!profile, isLeaving])

  useEffect(() => {
    if (!roomCode || !db || !user) return
    const roomsRef = collection(db, 'studyRooms')
    const q = query(roomsRef, where('roomCode', '==', roomCode))
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const roomDoc = snapshot.docs[0]
        const roomData = { ...roomDoc.data(), id: roomDoc.id }
        setRoom(roomData)
      } else if (!isLeaving) {
        toast({ variant: "destructive", title: "Room Closed" })
        router.push('/')
      }
      setLoading(false)
    }, (error) => {
      console.error("Room listener error:", error);
    })
    return () => unsubscribe()
  }, [roomCode, db, router, toast, user?.uid, isLeaving])

  const bankMinutes = useCallback((lastStatus: string, lastStartTime: string, durationMinutes: number) => {
    if (lastStatus !== 'focus' || !lastStartTime) return

    const start = new Date(lastStartTime).getTime()
    const now = Date.now()
    const elapsedMs = now - start
    
    const maxMs = (durationMinutes + 2) * 60 * 1000
    const actualMs = Math.min(elapsedMs, maxMs)
    const mins = Math.floor(actualMs / 60000)

    if (mins < 1) return

    const currentProfile = profileDataRef.current
    if (!user || !db || !userProfileRef || !currentProfile) return

    const nowObj = new Date()
    const todayStr = nowObj.toISOString().split('T')[0]
    const day = (nowObj.getDay() + 6) % 7
    const monday = new Date(nowObj)
    monday.setDate(nowObj.getDate() - day)
    monday.setHours(0, 0, 0, 0)
    const weekId = monday.toISOString().split('T')[0]
    const monthId = nowObj.toISOString().substring(0, 7)
    
    const updates: any = {
      todayMinutes: currentProfile.lastDateUpdated !== todayStr ? mins : (currentProfile.todayMinutes || 0) + mins,
      lastDateUpdated: todayStr,
      weeklyMinutes: currentProfile.lastWeekUpdated !== weekId ? mins : (currentProfile.weeklyMinutes || 0) + mins,
      lastWeekUpdated: weekId,
      monthlyMinutes: currentProfile.lastMonthUpdated !== monthId ? mins : (currentProfile.monthlyMinutes || 0) + mins,
      lastMonthUpdated: monthId,
      lastActive: nowObj.toISOString()
    }

    const sessionsRef = collection(db, 'users', user.uid, 'focusSessions')
    addDocumentNonBlocking(sessionsRef, {
      userId: user.uid,
      sessionType: 'Room',
      startTime: lastStartTime,
      endTime: nowObj.toISOString(),
      durationMinutes: mins,
      isCompleted: true
    })

    updateDocumentNonBlocking(userProfileRef, updates)
  }, [user, db, userProfileRef])

  useEffect(() => {
    if (!room || !prevRoomRef.current) {
      prevRoomRef.current = room
      return
    }

    const prev = prevRoomRef.current
    if (prev.status === 'focus' && room.status !== 'focus') {
      bankMinutes(prev.status, prev.startTime, prev.focusDurationMinutes)
    }

    prevRoomRef.current = room
  }, [room?.status, bankMinutes])

  useEffect(() => {
    if (!room || !user || !userProfileRef) return
    
    const currentStatus = room.status
    if (currentStatus === 'focus') {
      updateDocumentNonBlocking(userProfileRef, { 
        isStudying: true,
        status: 'studying',
        lastActive: new Date().toISOString()
      })
    } else {
      updateDocumentNonBlocking(userProfileRef, { isStudying: false, status: 'online', lastActive: new Date().toISOString() })
    }

    if (room.status === 'waiting' || room.status === 'finished' || !room.startTime) return

    const interval = setInterval(() => {
      const start = new Date(room.startTime).getTime()
      const durationMs = (room.status === 'focus' ? room.focusDurationMinutes : room.breakDurationMinutes) * 60 * 1000
      const now = Date.now()
      const elapsedMs = now - start
      const remaining = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000))
      setTimeLeft(remaining)
      
      if (remaining === 0 && room.createdBy === user.uid) {
         const roomRef = doc(db, 'studyRooms', room.id);
         if (room.status === 'focus') {
            updateDoc(roomRef, {
              status: 'break',
              startTime: new Date().toISOString()
            });
         } else if (room.status === 'break') {
            if (room.currentSession < (room.totalSessions || 1)) {
              updateDoc(roomRef, {
                status: 'focus',
                currentSession: room.currentSession + 1,
                startTime: new Date().toISOString()
              });
            } else {
              updateDoc(roomRef, { status: 'finished' });
            }
         }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [room?.status, room?.startTime, user?.uid, userProfileRef, db])

  const leaveRoom = async () => {
    if (!room || !user || !userProfileRef) return
    setIsLeaving(true)
    
    if (room.status === 'focus') {
      bankMinutes(room.status, room.startTime, room.focusDurationMinutes)
    }
    
    const roomRef = doc(db, 'studyRooms', room.id)
    const updatedParticipants = (room.participants || []).filter((p: any) => p.uid !== user.uid)
    
    try {
      if (updatedParticipants.length === 0) {
        await deleteDoc(roomRef)
      } else {
        await updateDoc(roomRef, { participants: updatedParticipants })
      }
      updateDocumentNonBlocking(userProfileRef, { isStudying: false, status: 'online', lastActive: new Date().toISOString() })
    } catch (e) {
      console.error("Error leaving room:", e)
    }

    router.push('/')
  }

  const startSession = async () => {
    if (!room || room.createdBy !== user?.uid) return
    setIsStarting(true)
    const roomRef = doc(db, 'studyRooms', room.id)
    try {
      await updateDoc(roomRef, {
        status: 'focus',
        currentSession: 1,
        startTime: new Date().toISOString()
      })
      toast({ title: "Session Activated" })
    } catch (e) {
      toast({ variant: "destructive", title: "Activation Failed" })
    } finally {
      setIsStarting(false)
    }
  }

  const copyRoomCode = () => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode as string)
    setCopied(true)
    toast({ title: "Room Code Copied" })
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  if (isUserLoading || loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950">
      <Leaf className="text-primary w-12 h-12 animate-pulse mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Syncing Room...</p>
    </div>
  )

  if (!room) return <div className="min-h-screen flex items-center justify-center p-8 text-center"><Button onClick={() => router.push('/')}>Return Home</Button></div>

  const isHost = room.createdBy === user?.uid
  const currentDuration = (room.status === 'focus' ? room.focusDurationMinutes : room.breakDurationMinutes) * 60
  const progress = currentDuration > 0 ? ((currentDuration - timeLeft) / currentDuration) * 100 : 0
  const isSessionStarted = room.status !== 'waiting' && room.status !== 'finished'

  if (isMobile && isSessionStarted) {
    return (
      <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
        <div className="w-full max-w-sm flex flex-col items-center gap-12">
          <div className="relative w-72 h-72 md:w-80 md:h-80 flex items-center justify-center mt-4">
            <svg className="w-full h-full -rotate-90">
              <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-900" />
              <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="283%" strokeDashoffset={`${283 - (283 * progress) / 100}%`} strokeLinecap="round" className={cn("transition-all duration-1000 ease-linear shadow-glow", room.status === 'focus' ? "text-primary" : "text-orange-500")} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl md:text-7xl font-black text-white font-mono tracking-tighter">{formatTime(timeLeft)}</span>
              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mt-4">
                {room.status === 'focus' ? 'Locked In' : 'On Break'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-8 w-full mt-8">
            <Button 
              variant="destructive" 
              className="h-16 w-full rounded-2xl font-black uppercase tracking-widest shadow-xl bg-destructive/80 text-white/90 hover:scale-105 active:scale-95 transition-all"
              onClick={leaveRoom}
            >
              LEAVE ROOM
            </Button>
            <p className="text-[9px] font-black uppercase text-zinc-700 tracking-[0.4em] animate-pulse">Room: {room.roomCode}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 pb-24 animate-in fade-in duration-500 overflow-x-hidden">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={leaveRoom} className="rounded-2xl border-zinc-800 bg-zinc-900/50 hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 font-black uppercase text-[10px] tracking-widest px-6 h-12">
              <DoorOpen className="w-4 h-4 mr-2" />
              Leave Room
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">
                {room.sessionType === 'pomodoro' ? 'Pomodoro' : 'Deep Work'}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest">Room: {room.roomCode}</p>
                {!isSessionStarted && (
                  <button onClick={copyRoomCode} className="text-primary hover:text-white transition-colors flex items-center gap-1">
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase ml-1">Invite Friend</span>
                    {copied && <Check className="w-3 h-3 ml-1" />}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {(room.status === 'focus' || room.status === 'break') && (
               <div className="bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 flex items-center gap-2">
                 <span className="text-[10px] font-black uppercase text-primary tracking-widest">Session {room.currentSession} of {room.totalSessions}</span>
               </div>
             )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <Card className="lg:col-span-8 border-none bg-black/40 backdrop-blur-md rounded-[3rem] p-8 md:p-12 flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-8 left-8 flex items-center gap-2">
               <div className={cn(
                 "w-2 h-2 rounded-full",
                 room.status === 'focus' ? "bg-primary animate-pulse" : room.status === 'break' ? "bg-orange-500 animate-pulse" : "bg-zinc-700"
               )} />
               <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                 {room.status === 'waiting' ? 'Ready' : room.status === 'finished' ? 'Complete' : room.status}
               </span>
            </div>

            <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center mb-10 mt-10">
              <svg className="w-full h-full -rotate-90">
                <circle cx="50%" cy="50%" r="46%" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/10" />
                <circle cx="50%" cy="50%" r="46%" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="289%" strokeDashoffset={`${289 - (289 * progress) / 100}%`} strokeLinecap="round" className={cn("transition-all duration-1000", room.status === 'focus' ? "text-primary shadow-glow" : "text-orange-500")} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl md:text-7xl font-black text-white font-mono">{room.status === 'waiting' ? `${room.focusDurationMinutes}:00` : room.status === 'finished' ? '00:00' : formatTime(timeLeft)}</span>
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-4">Minutes Remaining</span>
              </div>
            </div>

            {room.status === 'waiting' && (
              <div className="w-full max-w-xs flex flex-col gap-4">
                {isHost ? (
                  <Button onClick={startSession} disabled={isStarting} className="h-16 rounded-2xl bg-primary text-white font-black uppercase tracking-widest px-8 flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                    {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                    Start Session
                  </Button>
                ) : (
                  <p className="text-center text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] animate-pulse">Waiting for host to start session...</p>
                )}
              </div>
            )}

            {room.status === 'finished' && (
              <div className="text-center">
                 <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Session Complete</h2>
                 <Button onClick={leaveRoom} variant="outline" className="rounded-xl border-zinc-800 uppercase font-black tracking-widest mt-4">Back to Dashboard</Button>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-4 border-zinc-800 bg-zinc-900/40 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants ({room.participants?.length || 0})
            </h3>
            <div className="space-y-3">
              {participantsWithProfiles?.map((p: any) => (
                <div key={p.uid} className="flex items-center justify-between p-4 bg-zinc-950 rounded-2xl border border-zinc-800 group">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8 rounded-full border border-zinc-800">
                      <AvatarImage src={p.profileImageUrl} className="object-cover" />
                      <AvatarFallback className="text-[10px] font-black uppercase bg-zinc-900">{p.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-black uppercase text-white truncate">
                      {p.displayName} {p.uid === user?.uid && "(YOU)"}
                    </span>
                    {p.uid === room.createdBy && <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-black ml-2">HOST</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
