
"use client"

import React, { useMemo } from 'react'
import { Rocket, Target, Zap, Award, Flame, Sparkles, TrendingUp, Trophy, Star, ShieldCheck, Timer, Users, Crown, ZapOff, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  check: (data: any) => number; // returns progress 0-1
}

export function NextObjectives({ sessions, profile, streak }: { sessions: any[], profile: any, streak: number }) {
  const allAchievements: Achievement[] = useMemo(() => [
    // STARTERS
    { id: 'first_step', title: "First Step", description: "Complete your first focus session", icon: <Rocket />, check: (d) => d.sessions.length >= 1 ? 1 : 0 },
    { id: 'getting_started', title: "Getting Started", description: "Complete 3 focus sessions", icon: <Target />, check: (d) => Math.min(d.sessions.length / 3, 1) },
    { id: 'momentum_builder', title: "Momentum Builder", description: "Complete 5 focus sessions", icon: <Zap />, check: (d) => Math.min(d.sessions.length / 5, 1) },
    
    // INTENSITY
    { id: 'focus_starter', title: "Focus Starter", description: "Complete a 25-minute session", icon: <Timer />, check: (d) => d.sessions.some((s: any) => s.durationMinutes >= 25) ? 1 : 0 },
    { id: 'focus_builder_session', title: "Focus Builder", description: "Complete a 45-minute session", icon: <Timer />, check: (d) => d.sessions.some((s: any) => s.durationMinutes >= 45) ? 1 : 0 },
    { id: 'deep_focus', title: "Deep Focus", description: "Complete a 60-minute session", icon: <Zap />, check: (d) => d.sessions.some((s: any) => s.durationMinutes >= 60) ? 1 : 0 },
    
    // VOLUME
    { id: 'study_hour', title: "Study Hour", description: "Study 1 hour in a day", icon: <Clock />, check: (d) => Math.min(d.profile.todayMinutes / 60, 1) },
    { id: 'study_sprint', title: "Study Sprint", description: "Study 2 hours in a day", icon: <Clock />, check: (d) => Math.min(d.profile.todayMinutes / 120, 1) },
    { id: 'weekly_warrior', title: "Weekly Warrior", description: "Study 15 hours in a week", icon: <Award />, check: (d) => Math.min(d.profile.weeklyMinutes / 900, 1) },
    
    // STREAKS
    { id: 'discipline_start', title: "Discipline Start", description: "Study 2 days in a row", icon: <Flame />, check: (d) => Math.min(d.streak / 2, 1) },
    { id: 'habit_builder', title: "Habit Builder", description: "Study 3 days in a row", icon: <Flame />, check: (d) => Math.min(d.streak / 3, 1) },
    { id: 'consistency_mode', title: "Consistency Mode", description: "Study 5 days in a row", icon: <Flame />, check: (d) => Math.min(d.streak / 5, 1) },
    
    // SESSIONS
    { id: 'session_apprentice', title: "Session Apprentice", description: "Complete 10 focus sessions", icon: <Trophy />, check: (d) => Math.min(d.sessions.length / 10, 1) },
    { id: 'study_buddy', title: "Study Buddy", description: "Complete your first group session", icon: <Users />, check: (d) => d.sessions.some((s: any) => s.sessionType === 'studyRoom') ? 1 : 0 },
  ], [])

  const dataContext = { sessions: sessions || [], profile: profile || {}, streak: streak || 0 }

  const nextThree = useMemo(() => {
    return allAchievements
      .map(ach => ({ ...ach, progress: ach.check(dataContext) }))
      .filter(ach => ach.progress < 1)
      .sort((a, b) => b.progress - a.progress) // Closest to finished first
      .slice(0, 3)
  }, [allAchievements, dataContext])

  return (
    <Card className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm rounded-[2.5rem] overflow-hidden">
      <CardHeader className="p-8 pb-4">
        <CardTitle className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Growth Milestones
        </CardTitle>
        <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.1em] mt-1">Next Achievables</p>
      </CardHeader>
      <CardContent className="p-8 pt-0 space-y-6">
        {nextThree.length === 0 ? (
          <p className="text-[10px] font-black text-zinc-500 uppercase text-center py-6">All milestones achieved. Absolute Mastery.</p>
        ) : nextThree.map((obj) => {
          const progressPercent = Math.round(obj.progress * 100)
          
          return (
            <div key={obj.id} className="space-y-3 p-4 rounded-2xl border border-primary/10 bg-primary/5">
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
                    {React.cloneElement(obj.icon as React.ReactElement, { className: 'w-5 h-5' })}
                  </div>
                  <div>
                    <h3 className="text-[12px] font-black uppercase tracking-tight text-white flex items-center gap-2">
                      {obj.title}
                      <span className="bg-primary/20 text-primary text-[8px] px-1.5 py-0.5 rounded-full">UP NEXT</span>
                    </h3>
                    <p className="text-[10px] font-bold text-zinc-400 leading-tight mt-1">{obj.description}</p>
                  </div>
                </div>
                <span className="text-[11px] font-black text-primary uppercase">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000 shadow-glow-sm"
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
