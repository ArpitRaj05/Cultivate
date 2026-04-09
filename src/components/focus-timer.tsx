"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, RotateCcw, Timer, CheckCircle2, Zap, Brain, X, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase'
import { collection, query, where, doc } from 'firebase/firestore'
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates'
import { cn } from '@/lib/utils'

interface FocusTimerProps {
  userSettings?: any;
  userId: string;
  onTimerStateChange?: (isActive: boolean) => void;
  onActiveStateChange?: (isActive: boolean) => void;
  isFullScreen?: boolean;
  initialActive?: boolean;
}

export function FocusTimer({ 
  userSettings, 
  userId, 
  onTimerStateChange, 
  onActiveStateChange, 
  isFullScreen,
  initialActive = false,
}: FocusTimerProps) {
  const { toast } = useToast()
  const db = useFirestore()
  
  const userProfileRef = useMemoFirebase(() => userId ? doc(db, 'users', userId) : null, [db, userId])
  const { data: profile } = useDoc(userProfileRef)

  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const pomodoroTime = (userSettings?.pomodoroFocusDurationMinutes || 25) * 60
  const deepWorkTime = (userSettings?.deepWorkDurationMinutes || 50) * 60
  const breakTime = (userSettings?.pomodoroBreakDurationMinutes || 5) * 60
  const pomodoroSessions = userSettings?.pomodoroSessions || 1

  const [currentMode, setCurrentMode] = useState<'pomodoro' | 'deepWork' | 'break'>('pomodoro')
  const [timeLeft, setTimeLeft] = useState(pomodoroTime)
  const [isActive, setIsActive] = useState(initialActive)
  const [totalTime, setTotalTime] = useState(pomodoroTime)
  const [currentSession, setCurrentSession] = useState(1)
  
  const targetEndTimeRef = useRef<number | null>(null)
  const sessionStartTimeRef = useRef<string | null>(null)
  const totalSecondsThisSessionRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive) {
      const newDuration = currentMode === 'pomodoro' ? pomodoroTime : currentMode === 'deepWork' ? deepWorkTime : breakTime
      setTimeLeft(newDuration)
      setTotalTime(newDuration)
    }
  }, [currentMode, pomodoroTime, deepWorkTime, breakTime, isActive])

  const habitsRef = useMemoFirebase(() => {
    return userId ? collection(db, 'users', userId, 'habits') : null
  }, [db, userId])
  
  const completedHabitsQuery = useMemoFirebase(() => {
    if (!habitsRef) return null
    return query(habitsRef, where('isCompleted', '==', true))
  }, [habitsRef])

  const { data: completedHabits } = useCollection(completedHabitsQuery)
  const doneCount = completedHabits?.length || 0

  const progress = ((totalTime - timeLeft) / totalTime) * 100

  const setPresence = (studying: boolean) => {
    if (!userProfileRef) return
    updateDocumentNonBlocking(userProfileRef, { 
      isStudying: studying,
      status: studying ? 'studying' : 'online',
      lastActive: new Date().toISOString()
    })
  }

  const bankMinutes = useCallback(() => {
    if (totalSecondsThisSessionRef.current < 60) {
      totalSecondsThisSessionRef.current = 0
      sessionStartTimeRef.current = null
      return
    }

    const mins = Math.ceil(totalSecondsThisSessionRef.current / 60)
    const currentProfile = profileRef.current;
    
    if (mins <= 0 || !currentProfile || !userProfileRef || !db) {
      totalSecondsThisSessionRef.current = 0
      sessionStartTimeRef.current = null
      return
    }

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0];
    const day = (now.getDay() + 6) % 7
    const monday = new Date(now)
    monday.setDate(now.getDate() - day)
    monday.setHours(0, 0, 0, 0)
    const weekId = monday.toISOString().split('T')[0];
    const monthId = now.toISOString().substring(0, 7);
    
    const updates: any = {
      todayMinutes: currentProfile.lastDateUpdated !== todayStr ? mins : (currentProfile.todayMinutes || 0) + mins,
      lastDateUpdated: todayStr,
      weeklyMinutes: currentProfile.lastWeekUpdated !== weekId ? mins : (currentProfile.weeklyMinutes || 0) + mins,
      lastWeekUpdated: weekId,
      monthlyMinutes: currentProfile.lastMonthUpdated !== monthId ? mins : (currentProfile.monthlyMinutes || 0) + mins,
      lastMonthUpdated: monthId,
      lastActive: now.toISOString()
    }

    const sessionsRef = collection(db, 'users', userId, 'focusSessions')
    addDocumentNonBlocking(sessionsRef, {
      userId,
      sessionType: currentMode === 'pomodoro' ? 'Pomodoro' : currentMode === 'deepWork' ? 'Deep Work' : 'Break',
      startTime: sessionStartTimeRef.current || new Date().toISOString(),
      endTime: now.toISOString(),
      durationMinutes: mins,
      isCompleted: true
    })

    updateDocumentNonBlocking(userProfileRef, updates)
    totalSecondsThisSessionRef.current = 0
    sessionStartTimeRef.current = null
  }, [userProfileRef, userId, db, currentMode])

  const handleSessionComplete = useCallback(() => {
    setPresence(false)
    targetEndTimeRef.current = null
    bankMinutes()
    
    const prevMode = currentMode;
    toast({ title: prevMode === 'break' ? "Break Over! ⚡" : "Session Complete! 🎯" })
    
    if (prevMode === 'pomodoro') {
      setCurrentMode('break');
      setIsActive(true);
      const nextDuration = breakTime;
      setTimeLeft(nextDuration);
      setTotalTime(nextDuration);
      targetEndTimeRef.current = Date.now() + (nextDuration * 1000);
    } else if (prevMode === 'break') {
      if (currentSession < pomodoroSessions) {
        setCurrentSession(prev => prev + 1);
        setCurrentMode('pomodoro');
        setIsActive(true);
        const nextDuration = pomodoroTime;
        setTimeLeft(nextDuration);
        setTotalTime(nextDuration);
        targetEndTimeRef.current = Date.now() + (nextDuration * 1000);
        setPresence(true);
        if (!sessionStartTimeRef.current) sessionStartTimeRef.current = new Date().toISOString();
      } else {
        setCurrentSession(1);
        setCurrentMode('pomodoro');
        setIsActive(false);
        if (onTimerStateChange) onTimerStateChange(false);
      }
    } else {
      setIsActive(false);
      if (onTimerStateChange) onTimerStateChange(false);
      setCurrentMode('deepWork');
    }
  }, [toast, currentMode, bankMinutes, breakTime, pomodoroTime, pomodoroSessions, currentSession, onTimerStateChange])

  const toggleTimer = () => {
    const newState = !isActive
    
    if (onActiveStateChange) {
      onActiveStateChange(newState);
    }
    
    if (newState) {
      if (onTimerStateChange) onTimerStateChange(true);
      if (!sessionStartTimeRef.current) sessionStartTimeRef.current = new Date().toISOString()
      targetEndTimeRef.current = Date.now() + (timeLeft * 1000)
      if (currentMode !== 'break') setPresence(true)
    } else {
      bankMinutes()
      targetEndTimeRef.current = null
      setPresence(false)
      if (onTimerStateChange) onTimerStateChange(false);
    }
    setIsActive(newState)
  }

  const resetTimer = () => {
    bankMinutes()
    setIsActive(false)
    if (onTimerStateChange) onTimerStateChange(false);
    if (onActiveStateChange) onActiveStateChange(false);
    setPresence(false)
    targetEndTimeRef.current = null
    const resetVal = currentMode === 'pomodoro' ? pomodoroTime : currentMode === 'deepWork' ? deepWorkTime : breakTime
    setTimeLeft(resetVal)
    setCurrentSession(1)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    let lastTick = Date.now()
    
    if (isActive) {
      if (!targetEndTimeRef.current) {
         targetEndTimeRef.current = Date.now() + (timeLeft * 1000)
      }

      interval = setInterval(() => {
        const now = Date.now()
        const elapsedSinceTick = Math.floor((now - lastTick) / 1000)
        
        if (elapsedSinceTick >= 1) {
          lastTick = now
          if (currentMode !== 'break') totalSecondsThisSessionRef.current += elapsedSinceTick
        }

        if (targetEndTimeRef.current) {
          const remaining = Math.max(0, Math.floor((targetEndTimeRef.current - now) / 1000))
          setTimeLeft(remaining)
          if (remaining === 0) handleSessionComplete()
        }
      }, 1000)
    }
    
    return () => { if (interval) clearInterval(interval) }
  }, [isActive, handleSessionComplete, currentMode])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const isPaused = !isActive && timeLeft < totalTime;

  return (
    <Card className={cn(
      "overflow-hidden border-none shadow-2xl bg-white/70 backdrop-blur-xl dark:bg-black/40 rounded-[2.5rem] transition-all duration-500",
      isFullScreen && "bg-transparent shadow-none dark:bg-transparent"
    )}>
      {!isFullScreen && (
        <CardHeader className="flex flex-col items-center p-8 pb-4 space-y-4">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="text-sm font-black flex items-center gap-3 text-zinc-900 dark:text-white uppercase tracking-[0.2em]">
              <Timer className="w-5 h-5 text-primary" />
              {currentMode === 'break' ? 'Break' : currentMode === 'pomodoro' ? 'Pomodoro' : 'Deep Work'}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-primary/5 dark:bg-primary/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-primary border border-primary/10">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {doneCount} Wins Today
              </div>
            </div>
          </div>
        </CardHeader>
      )}
      
      <CardContent className={cn("flex flex-col items-center p-8", isFullScreen ? "justify-center min-h-[70vh] relative" : "pt-0")}>
        {isFullScreen && currentMode === 'pomodoro' && pomodoroSessions > 1 && (
          <div className="absolute top-2 right-2 p-2 flex flex-col items-end opacity-40">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/40 border border-zinc-800/50">
              <Layers className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Session {currentSession}/{pomodoroSessions}</span>
            </div>
          </div>
        )}

        {!isActive && !isPaused && (
          <div className="flex gap-2 w-full mb-8 bg-zinc-100 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm mx-auto">
            <button 
              className={cn(
                "flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                currentMode === 'pomodoro' ? 'bg-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'
              )}
              onClick={() => setCurrentMode('pomodoro')}
            >
              <Zap className="w-3 h-3" />
              Pomodoro
            </button>
            <button 
              className={cn(
                "flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                currentMode === 'deepWork' ? 'bg-primary text-white shadow-lg' : 'text-zinc-500 hover:text-white hover:bg-white/5'
              )}
              onClick={() => setCurrentMode('deepWork')}
            >
              <Brain className="w-3 h-3" />
              Deep Work
            </button>
          </div>
        )}

        <div className={cn(
          "relative flex items-center justify-center mb-16 transition-all duration-700",
          isFullScreen ? "w-72 h-72 md:w-96 md:h-96" : "w-64 h-64 md:w-80 md:h-80"
        )}>
          <svg className="w-full h-full -rotate-90">
            <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-100 dark:text-zinc-800" />
            <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="283%" strokeDashoffset={`${283 - (283 * progress) / 100}%`} strokeLinecap="round" className={cn("transition-all duration-1000 ease-linear text-primary", isActive && currentMode !== 'break' && "shadow-glow")} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn(
              "font-black tracking-tighter font-mono transition-all duration-500",
              isFullScreen ? "text-6xl md:text-8xl" : "text-5xl md:text-7xl",
              currentMode === 'break' ? 'text-orange-500' : 'text-zinc-900 dark:text-white'
            )}>
              {formatTime(timeLeft)}
            </span>
            {!isFullScreen && (
              <span className="text-[10px] md:text-xs text-zinc-400 font-black uppercase tracking-[0.3em] mt-4">
                {currentMode === 'break' ? 'Breaking' : isActive ? 'Engaged' : 'Ready'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-16 w-full justify-center max-w-sm mx-auto">
          <div className="flex flex-col items-center gap-8 w-full">
            {!isActive ? (
              <Button 
                size="lg" 
                className={cn(
                  "h-16 w-full text-sm font-black uppercase tracking-[0.2em] transition-all rounded-2xl shadow-xl", 
                  "bg-gradient-to-br from-green-600 to-emerald-500 text-white shadow-green-600/20"
                )} 
                onClick={toggleTimer}
              >
                START
              </Button>
            ) : (
              <Button 
                size="lg" 
                variant="destructive" 
                className="h-14 w-full rounded-2xl font-black uppercase tracking-widest shadow-xl bg-destructive/80 text-white/90"
                onClick={toggleTimer}
              >
                GIVE UP
              </Button>
            )}

            {isPaused && (
              <Button 
                size="lg" 
                variant="ghost" 
                className="h-14 w-14 p-0 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 shrink-0 hover:bg-zinc-200 dark:hover:bg-zinc-700" 
                onClick={resetTimer}
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            )}
          </div>

          {isFullScreen && !isActive && (
            <button 
              onClick={() => onTimerStateChange?.(false)}
              className="text-[11px] font-black uppercase text-zinc-500 tracking-[0.2em] hover:text-white transition-colors"
            >
              Exit Full Screen
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
