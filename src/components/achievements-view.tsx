
"use client"

import React, { useMemo } from 'react'
import { Rocket, Target, Zap, Award, Flame, Sparkles, Trophy, Star, ShieldCheck, Timer, Users, Crown, ZapOff, Clock, LayoutGrid, Heart, UserCheck, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  check: (data: any) => boolean;
  category: string;
}

export function AchievementsView({ sessions, profile, streak }: { sessions: any[], profile: any, streak: number }) {
  const allAchievements: Achievement[] = useMemo(() => [
    // STARTER
    { id: 'first_step', title: "First Step", description: "Complete your first focus session", icon: <Rocket />, category: 'Starter', check: (d) => d.sessions.length >= 1 },
    { id: 'momentum_builder', title: "Momentum Builder", description: "Complete 5 focus sessions", icon: <Zap />, category: 'Starter', check: (d) => d.sessions.length >= 5 },
    
    // INTENSITY
    { id: 'focus_starter', title: "Focus Starter", description: "Complete a 25-minute session", icon: <Timer />, category: 'Intensity', check: (d) => d.sessions.some((s: any) => s.durationMinutes >= 25) },
    { id: 'deep_focus', title: "Deep Focus", description: "Complete a 60-minute focus session", icon: <Zap />, category: 'Intensity', check: (d) => d.sessions.some((s: any) => s.durationMinutes >= 60) },

    // DAILY VOLUME
    { id: 'study_hour', title: "Study Hour", description: "Study 1 hour in a day", icon: <Clock />, category: 'Daily', check: (d) => d.profile.todayMinutes >= 60 },
    { id: 'study_machine', title: "Study Machine", description: "Study 5 hours in a day", icon: <Clock />, category: 'Daily', check: (d) => d.profile.todayMinutes >= 300 },

    // WEEKLY VOLUME
    { id: 'weekly_builder', title: "Weekly Builder", description: "Study 10 hours in a week", icon: <Award />, category: 'Weekly', check: (d) => d.profile.weeklyMinutes >= 600 },
    { id: 'weekly_champion', title: "Weekly Champion", description: "Study 25 hours in a week", icon: <Award />, category: 'Weekly', check: (d) => d.profile.weeklyMinutes >= 1500 },

    // STREAKS
    { id: 'locked_in', title: "Locked In", description: "Study 7 days in a row", icon: <Flame />, category: 'Streaks', check: (d) => d.streak >= 7 },
    { id: 'unbreakable', title: "Unbreakable", description: "Study 30 days in a row", icon: <Flame />, category: 'Streaks', check: (d) => d.streak >= 30 },

    // LIFETIME
    { id: 'session_master', title: "Session Master", description: "Complete 100 focus sessions", icon: <Trophy />, category: 'Lifetime', check: (d) => d.sessions.length >= 100 },
    { id: 'session_titan', title: "Session Titan", description: "Complete 250 focus sessions", icon: <Crown />, category: 'Lifetime', check: (d) => d.sessions.length >= 250 },

    // DEEP WORK
    { id: 'dw_champion', title: "Deep Work Champion", description: "Complete 50 deep work sessions", icon: <ShieldCheck />, category: 'Deep Work', check: (d) => d.sessions.filter((s: any) => s.sessionType === 'deepWork').length >= 50 },

    // COLLABORATIVE
    { id: 'study_buddy', title: "Study Buddy", description: "Complete your first group study session", icon: <Users />, category: 'Group', check: (d) => d.sessions.some((s: any) => s.sessionType === 'Room') },
    { id: 'focus_crew', title: "Focus Crew", description: "Complete 10 group study sessions", icon: <Users />, category: 'Group', check: (d) => d.sessions.filter((s: any) => s.sessionType === 'Room').length >= 10 },
  ], [profile])

  const dataContext = { sessions: sessions || [], profile: profile || {}, streak: streak || 0 }
  const categories = Array.from(new Set(allAchievements.map(a => a.category)))

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-700 pb-32 px-4 md:px-0">
      <header className="text-center space-y-3">
        <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto border border-primary/20">
          <Trophy className="w-6 h-6 md:w-8 md:h-8 text-primary" />
        </div>
        <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter text-white">Hall of Medals</h2>
        <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">Documenting your evolution.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categories.map(cat => (
          <section key={cat} className="space-y-4">
            <div className="flex items-center gap-4 px-2">
              <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-primary">{cat}</h3>
              <div className="h-px bg-zinc-800 flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {allAchievements.filter(a => a.category === cat).map(ach => {
                const isUnlocked = ach.check(dataContext)
                return (
                  <Card key={ach.id} className={cn(
                    "p-4 rounded-2xl md:rounded-[2rem] border transition-all duration-500",
                    isUnlocked ? "bg-primary/10 border-primary/30 shadow-glow-sm" : "bg-zinc-900/40 border-zinc-800/50 opacity-40 grayscale"
                  )}>
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className={cn(
                        "w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0",
                        isUnlocked ? "bg-primary text-white" : "bg-zinc-800 text-zinc-600"
                      )}>
                        {React.cloneElement(ach.icon as React.ReactElement, { className: 'w-5 h-5 md:w-6 md:h-6' })}
                      </div>
                      <div>
                        <h4 className="font-black text-[9px] md:text-[12px] uppercase tracking-tight text-white line-clamp-1">{ach.title}</h4>
                        <p className="text-[7px] md:text-[9px] font-bold text-zinc-500 mt-1 uppercase leading-tight line-clamp-2">{ach.description}</p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
