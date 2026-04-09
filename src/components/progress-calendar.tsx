
"use client"

import React, { useState, useMemo, useEffect } from 'react'
import { Star, Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc, query } from 'firebase/firestore'
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays, isAfter, subMonths, addMonths, setYear, getYear, startOfWeek, endOfWeek } from 'date-fns'

export function ProgressCalendar({ userId, bestStreak }: { userId: string, bestStreak: number }) {
  const db = useFirestore()
  const [today, setToday] = useState<Date | null>(null)
  const [viewDate, setViewDate] = useState<Date | null>(null)

  useEffect(() => {
    const now = new Date()
    setToday(now)
    setViewDate(now)
  }, [])

  const monthStart = viewDate ? startOfMonth(viewDate) : null
  const monthEnd = viewDate ? endOfMonth(viewDate) : null
  const calendarStart = monthStart ? startOfWeek(monthStart) : null
  const calendarEnd = monthEnd ? endOfWeek(monthEnd) : null
  
  const calendarDays = useMemo(() => {
    if (!calendarStart || !calendarEnd) return []
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [calendarStart, calendarEnd])

  const completionsQuery = useMemoFirebase(() => {
    if (!userId) return null
    return query(collection(db, 'users', userId, 'daily_completions'))
  }, [db, userId])

  const { data: completions } = useCollection(completionsQuery)

  const completionsMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    completions?.forEach(c => {
      if (c.id) map[c.id] = true
    })
    return map
  }, [completions])

  const toggleDay = (date: Date) => {
    if (!today || !userId) return
    const isFuture = isAfter(date, today) && !isSameDay(date, today)
    if (isFuture) return
    
    const dateStr = format(date, 'yyyy-MM-dd')
    const docRef = doc(db, 'users', userId, 'daily_completions', dateStr)
    
    if (completionsMap[dateStr]) {
      deleteDocumentNonBlocking(docRef)
    } else {
      setDocumentNonBlocking(docRef, {
        id: dateStr,
        userId,
        completionDate: dateStr,
        isCompleted: true
      }, { merge: true })
    }
  }

  const currentStreak = useMemo(() => {
    if (!completionsMap || !today) return 0
    let streak = 0
    let checkDate = new Date(today)
    const maxLookback = 365 

    for (let i = 0; i < maxLookback; i++) {
      const dateStr = format(checkDate, 'yyyy-MM-dd')
      const isCompleted = completionsMap[dateStr]

      if (isCompleted) {
        streak++
      } else {
        if (!isSameDay(checkDate, today)) break
      }
      checkDate = subDays(checkDate, 1)
    }
    return streak
  }, [completionsMap, today])

  const handlePrevMonth = () => viewDate && setViewDate(subMonths(viewDate, 1))
  const handleNextMonth = () => viewDate && setViewDate(addMonths(viewDate, 1))
  
  const handleYearChange = (year: string) => {
    viewDate && setViewDate(setYear(viewDate, parseInt(year)))
  }

  const years = useMemo(() => {
    const currentYear = getYear(new Date())
    const startYear = 2024
    const endYear = currentYear + 5
    const list = []
    for (let y = startYear; y <= endYear; y++) {
      list.push(y.toString())
    }
    return list
  }, [])

  if (!today || !viewDate) return null

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xl bg-zinc-50/50 dark:bg-zinc-900/40 backdrop-blur-sm overflow-hidden border-t-4 border-t-primary/20 rounded-[2.5rem] animate-in fade-in slide-in-from-right-8 duration-700">
      <CardHeader className="p-8 pb-4 bg-primary/5 border-b border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-black flex items-center gap-2 text-primary uppercase tracking-[0.2em]">
            Growth Journal
          </CardTitle>
          <div className="flex items-center gap-3 bg-white dark:bg-zinc-950 px-5 py-2 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-inner">
            <Flame className="w-5 h-5 text-primary fill-primary animate-pulse" />
            <span className="text-base font-black text-zinc-900 dark:text-white">{currentStreak}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-10">
          <div className="flex items-center justify-between px-2 bg-white dark:bg-zinc-950/50 p-2 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-10 w-10 rounded-xl shrink-0"><ChevronLeft className="w-5 h-5" /></Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="flex-1 px-4 h-10 rounded-xl font-black text-[13px] uppercase tracking-[0.2em] truncate">{format(viewDate, 'MMMM yyyy')}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-4 rounded-3xl" align="center">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase text-zinc-400">Select Year</p>
                  <Select onValueChange={handleYearChange} defaultValue={getYear(viewDate).toString()}>
                    <SelectTrigger className="w-full rounded-xl font-bold"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {years.map(y => <SelectItem key={y} value={y} className="rounded-lg font-bold">{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-10 w-10 rounded-xl shrink-0"><ChevronRight className="w-5 h-5" /></Button>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-black text-zinc-400 dark:text-zinc-600 mb-2 uppercase tracking-widest">{d}</div>
            ))}
            {calendarDays.map((date) => {
              const dateStr = format(date, 'yyyy-MM-dd')
              const isCompleted = completionsMap[dateStr]
              const isTodayDate = isSameDay(date, today)
              const isFuture = isAfter(date, today) && !isTodayDate
              const isCurrentMonth = format(date, 'yyyy-MM') === format(viewDate, 'yyyy-MM')

              return (
                <div 
                  key={dateStr}
                  onClick={() => !isFuture && toggleDay(date)}
                  className={`aspect-square relative rounded-xl flex items-center justify-center text-[13px] font-black cursor-pointer transition-all hover:scale-110 active:scale-90 border-2 ${
                    isCompleted 
                      ? 'bg-primary text-primary-foreground border-primary shadow-xl' 
                      : isFuture 
                        ? 'bg-zinc-100/30 dark:bg-zinc-950/20 text-zinc-300 dark:text-zinc-800 border-dashed pointer-events-none' 
                        : isCurrentMonth
                          ? 'bg-white dark:bg-zinc-950 text-zinc-400 dark:text-zinc-700'
                          : 'bg-zinc-50 dark:bg-zinc-900/50 text-zinc-300 dark:text-zinc-800 opacity-40'
                  } ${isTodayDate && !isCompleted ? 'ring-2 ring-primary ring-offset-4 ring-offset-white dark:ring-offset-zinc-950' : ''}`}
                >
                  {format(date, 'd')}
                  {isTodayDate && !isCompleted && isCurrentMonth && <div className="absolute -top-1 -right-1"><Star className="w-4 h-4 text-primary fill-primary animate-pulse" /></div>}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-3 gap-4 bg-white dark:bg-zinc-950/80 p-6 rounded-[2rem] border border-zinc-100 dark:border-zinc-800">
            <div className="text-center">
              <div className="text-2xl font-black text-zinc-900 dark:text-white mb-1">{completions?.length || 0}</div>
              <div className="text-[9px] font-black uppercase text-zinc-400">Total Wins</div>
            </div>
            <div className="text-center border-x px-2">
              <div className="text-2xl font-black text-primary mb-1">{currentStreak}</div>
              <div className="text-[9px] font-black uppercase text-zinc-400">Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-zinc-900 dark:text-white mb-1">{bestStreak}</div>
              <div className="text-[9px] font-black uppercase text-zinc-400">Best Streak</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
