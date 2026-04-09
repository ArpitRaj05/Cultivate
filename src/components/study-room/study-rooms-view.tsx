
"use client"

import React, { useState, useEffect } from 'react'
import { Plus, Users, Search, Loader2, ArrowRight, RefreshCw, Copy, Check, Timer, Zap, Coffee, Layers, ChevronLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/hooks/use-toast'
import { useFirestore } from '@/firebase'
import { collection, query, where, doc, getDocs, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { User } from 'firebase/auth'
import { cn } from '@/lib/utils'

interface StudyRoomsViewProps {
  user: User;
  profile: any;
}

export function StudyRoomsView({ user, profile }: StudyRoomsViewProps) {
  const db = useFirestore()
  const { toast } = useToast()
  const router = useRouter()
  
  const [view, setView] = useState<'choice' | 'create' | 'join'>('choice')
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [nextRoomCode, setNextRoomCode] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const [sessionType, setSessionType] = useState<'pomodoro' | 'deepWork'>('pomodoro')
  const [focusDuration, setFocusDuration] = useState(25)
  const [breakDuration, setBreakDuration] = useState(5)
  const [totalSessions, setTotalSessions] = useState(1)

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  useEffect(() => {
    setNextRoomCode(generateRoomCode())
  }, [])

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast({ title: "Code Copied" })
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const createRoom = async () => {
    if (!db) return
    setIsCreating(true)
    const code = nextRoomCode || generateRoomCode()
    try {
      const roomData = {
        roomCode: code,
        createdBy: user.uid,
        creatorName: profile.firstName,
        participants: [{
          uid: user.uid,
          displayName: profile.firstName,
          // DO NOT store image here (fixes 1MB error)
          joinedAt: new Date().toISOString()
        }],
        status: 'waiting',
        sessionType,
        focusDurationMinutes: focusDuration,
        breakDurationMinutes: sessionType === 'pomodoro' ? breakDuration : 0,
        totalSessions: sessionType === 'pomodoro' ? totalSessions : 1,
        currentSession: 1,
        createdAt: serverTimestamp()
      }
      
      await addDoc(collection(db, 'studyRooms'), roomData)
      router.push(`/room/${code}`)
    } catch (error) {
      toast({ variant: "destructive", title: "Room Generation Failed" })
      setIsCreating(false)
    }
  }

  const joinRoom = async (code?: string) => {
    const codeToJoin = (code || roomCodeInput).trim().toUpperCase()
    if (!codeToJoin) return

    setIsJoining(true)
    // Instant navigation - participation is handled on the room page for speed
    router.push(`/room/${codeToJoin}`)
  }

  if (view === 'choice') {
    return (
      <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20 px-4">
        <header className="text-center space-y-4 pt-8">
          <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto border border-primary/20">
             <Users className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Study room</h2>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">Solo is discipline. Together is momentum.</p>
        </header>

        <div className="grid grid-cols-1 gap-6 pt-4">
          <button 
            onClick={() => setView('create')}
            className="group relative p-8 bg-zinc-900/60 border border-zinc-800 rounded-[2.5rem] text-left hover:border-primary/50 transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 text-zinc-800 group-hover:text-primary/20 transition-colors">
              <Plus className="w-24 h-24" />
            </div>
            <div className="relative space-y-4">
              <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Create Room</h3>
                <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Host your own session with buddies</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setView('join')}
            className="group relative p-8 bg-zinc-900/60 border border-zinc-800 rounded-[2.5rem] text-left hover:border-white/30 transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 text-zinc-800 group-hover:text-white/5 transition-colors">
              <Search className="w-24 h-24" />
            </div>
            <div className="relative space-y-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-zinc-900 shadow-lg">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Join Room</h3>
                <p className="text-xs text-zinc-500 font-bold uppercase mt-1">Enter a unique code to jump in</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => setView('choice')} className="text-zinc-500 hover:text-white flex items-center gap-2 uppercase font-black text-[10px] tracking-widest">
           <ChevronLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {view === 'create' && (
          <Card className="border-zinc-800 shadow-xl bg-zinc-900/40 backdrop-blur-sm rounded-[2.5rem] overflow-hidden w-full mx-auto max-w-lg">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Configure Room
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Structure</label>
                <Tabs value={sessionType} onValueChange={(v: any) => setSessionType(v)} className="w-full">
                  <TabsList className="grid grid-cols-2 h-12 rounded-xl bg-zinc-950 p-1">
                    <TabsTrigger value="pomodoro" className="rounded-lg font-black text-[10px] uppercase tracking-widest">Pomodoro</TabsTrigger>
                    <TabsTrigger value="deepWork" className="rounded-lg font-black text-[10px] uppercase tracking-widest">Deep Work</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Focus Time</span>
                    </div>
                    <span className="text-lg font-black text-primary">{focusDuration}m</span>
                  </div>
                  <Slider 
                    value={[focusDuration]} 
                    min={10} max={sessionType === 'deepWork' ? 240 : 120} step={5} 
                    onValueChange={(v) => setFocusDuration(v[0])}
                  />
                </div>

                {sessionType === 'pomodoro' && (
                  <>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Coffee className="w-3.5 h-3.5 text-orange-500" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Break Time</span>
                        </div>
                        <span className="text-lg font-black text-orange-500">{breakDuration}m</span>
                      </div>
                      <Slider 
                        value={[breakDuration]} 
                        min={2} max={30} step={1} 
                        onValueChange={(v) => setBreakDuration(v[0])}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sessions</span>
                        </div>
                        <span className="text-lg font-black text-zinc-300">{totalSessions}</span>
                      </div>
                      <Slider 
                        value={[totalSessions]} 
                        min={1} max={8} step={1} 
                        onValueChange={(v) => setTotalSessions(v[0])}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center justify-between bg-zinc-950 p-4 rounded-2xl border border-dashed border-zinc-800 shadow-inner">
                <span className="text-xl font-black tracking-widest text-primary font-mono">{nextRoomCode}</span>
                <div className="flex gap-2">
                  <button onClick={() => copyToClipboard(nextRoomCode)} className="h-9 w-9 text-zinc-500 hover:text-white transition-colors">
                    {copiedCode === nextRoomCode ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setNextRoomCode(generateRoomCode())} className="h-9 w-9 text-zinc-500 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <Button 
                onClick={createRoom} 
                disabled={isCreating}
                className="w-full h-16 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 bg-primary hover:scale-[1.02] transition-all text-white"
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : "Create Room"}
              </Button>
            </CardContent>
          </Card>
        )}

        {view === 'join' && (
          <Card className="border-zinc-800 shadow-xl bg-zinc-900/40 backdrop-blur-sm rounded-[2.5rem] overflow-hidden w-full mx-auto max-w-lg">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-[11px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-2">
                <Search className="w-4 h-4" />
                Join Room
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="CODE" 
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="h-14 rounded-2xl bg-zinc-950 border-zinc-800 text-center font-black tracking-[0.5em] text-lg font-mono focus:ring-primary shadow-inner text-white"
                  maxLength={6}
                />
                <Button 
                  onClick={() => joinRoom()} 
                  disabled={isJoining || roomCodeInput.length !== 6}
                  size="icon"
                  className="h-14 w-14 rounded-2xl shrink-0 bg-white text-zinc-900 shadow-xl"
                >
                  {isJoining ? <Loader2 className="w-5 h-5 animate-spin text-zinc-900" /> : <ArrowRight className="w-6 h-6" />}
                </Button>
              </div>
              <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest text-center mt-4">
                Verify the code with your host.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
