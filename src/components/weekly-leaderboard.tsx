
"use client"

import React, { useMemo } from 'react'
import { Crown, Medal, Loader2, Rocket, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, query, where } from 'firebase/firestore'
import { cn } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export function WeeklyLeaderboard() {
  const { user } = useUser()
  const db = useFirestore()

  const friendsRef = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'friends') : null, [db, user?.uid])
  const { data: friends, isLoading: isFriendsLoading } = useCollection(friendsRef)

  const friendIds = useMemo(() => {
    if (!friends || !user) return []
    const ids = friends.map(f => f.uid).slice(0, 20) 
    if (!ids.includes(user.uid)) ids.push(user.uid)
    return ids.sort() 
  }, [friends, user?.uid])

  const profilesRef = useMemoFirebase(() => {
    if (friendIds.length === 0) return null
    return query(collection(db, 'users'), where('id', 'in', friendIds))
  }, [db, friendIds.join(',')])
  
  const { data: friendProfiles, isLoading: isProfilesLoading } = useCollection(profilesRef)

  const leaderboard = useMemo(() => {
    if (!friendProfiles) return []
    const currentWeekId = (() => {
      const d = new Date()
      const day = (d.getDay() + 6) % 7
      const monday = new Date(d)
      monday.setDate(d.getDate() - day)
      monday.setHours(0, 0, 0, 0)
      return monday.toISOString().split('T')[0]
    })()

    return friendProfiles
      .map(p => ({
        ...p,
        displayMinutes: p.lastWeekUpdated === currentWeekId ? (p.weeklyMinutes || 0) : 0,
      }))
      .sort((a, b) => b.displayMinutes - a.displayMinutes)
  }, [friendProfiles])

  const dailyLeaderboard = useMemo(() => {
    if (!friendProfiles) return []
    const todayStr = new Date().toISOString().split('T')[0]
    const now = Date.now();
    
    return friendProfiles
      .map(p => {
        const lastActiveTime = p.lastActive ? new Date(p.lastActive).getTime() : 0;
        const isActuallyOnline = (now - lastActiveTime) < 180000; 
        return {
          ...p,
          dailyMinutes: p.lastDateUpdated === todayStr ? (p.todayMinutes || 0) : 0,
          isActuallyOnline
        };
      })
      .sort((a, b) => b.dailyMinutes - a.dailyMinutes)
  }, [friendProfiles])

  if (isProfilesLoading || isFriendsLoading) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Syncing Rankings...</p>
    </div>
  )

  const topThree = leaderboard.slice(0, 3)

  return (
    <div className="max-w-5xl mx-auto space-y-12 md:space-y-20 pb-32 px-2 md:px-4 animate-in fade-in duration-1000">
      <div className="text-center space-y-3">
        <h2 className="text-2xl md:text-5xl font-black text-white uppercase tracking-tighter">The Weekly Summit</h2>
        <div className="flex items-center justify-center gap-1.5 text-[9px] font-black text-primary uppercase tracking-[0.3em]">
          <Clock className="w-3 h-3" />
          Weekly Reset: Mon 12:00 AM
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-6 items-end pt-8 md:pt-12 max-w-4xl mx-auto">
        {topThree[1] && (
          <div className="h-full flex flex-col justify-end">
            <PodiumCard player={topThree[1]} rank={2} isUser={topThree[1].id === user?.uid} />
          </div>
        )}
        
        {topThree[0] && (
          <div className="scale-105 md:scale-110 z-10">
            <PodiumCard player={topThree[0]} rank={1} isUser={topThree[0].id === user?.uid} />
          </div>
        )}
        
        {topThree[2] && (
          <div className="h-full flex flex-col justify-end">
            <PodiumCard player={topThree[2]} rank={3} isUser={topThree[2].id === user?.uid} />
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto space-y-4 pt-12 px-2">
        <div className="flex justify-between items-center px-4 mb-4">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-zinc-100 uppercase tracking-[0.3em]">Live Daily Feed</span>
          </div>
          <span className="text-[10px] font-black text-zinc-100 uppercase tracking-[0.3em]">Today</span>
        </div>
        
        <div className="space-y-3">
          {dailyLeaderboard.map((player, idx) => (
              <div 
                key={player.id} 
                className={cn(
                  "flex items-center justify-between p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border transition-all duration-500 group", 
                  player.id === user?.uid 
                    ? "bg-primary/10 border-primary/40 shadow-glow-sm" 
                    : "bg-zinc-900/40 border-zinc-800/40 hover:bg-zinc-900/60 hover:border-zinc-700"
                )}
              >
                <div className="flex items-center gap-4 md:gap-6">
                  <span className="text-xs md:text-[14px] font-black text-zinc-400 group-hover:text-white w-4 md:w-8 text-center">{idx + 1}</span>
                  <div className="relative">
                    <Avatar className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1.25rem] border border-zinc-800 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                      <AvatarImage src={player.profileImageUrl} />
                      <AvatarFallback className="text-[10px] bg-zinc-950 font-black text-zinc-400">{player.firstName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-zinc-950 shadow-glow",
                      player.isActuallyOnline ? "bg-primary" : "bg-zinc-800",
                      player.isActuallyOnline && player.status === 'studying' && "animate-pulse"
                    )} />
                  </div>
                  <div>
                    <p className="text-sm md:text-[16px] font-black uppercase text-white tracking-tight flex items-center gap-2 leading-none">
                      {player.firstName} {player.id === user?.uid && "(YOU)"}
                    </p>
                    <p className="text-[9px] md:text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1.5 opacity-80">@{player.username}</p>
                  </div>
                </div>
                <div className="text-right pr-2">
                  <p className="text-xl md:text-3xl font-black text-primary leading-none tracking-tighter">{player.dailyMinutes}</p>
                  <p className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 mt-1 tracking-widest">Min</p>
                </div>
              </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PodiumCard({ player, rank, isUser }: { player: any, rank: number, isUser: boolean }) {
  const styles = {
    1: { border: "border-yellow-500/50", icon: <Crown className="text-yellow-500 w-6 h-6 md:w-10 md:h-10" />, bg: "bg-yellow-500/5", color: "text-yellow-500", glow: "shadow-yellow-500/10" },
    2: { border: "border-zinc-400/40", icon: <Medal className="text-zinc-400 w-5 h-5 md:w-8 md:h-8" />, bg: "bg-zinc-400/5", color: "text-zinc-400", glow: "shadow-zinc-400/10" },
    3: { border: "border-orange-600/40", icon: <Medal className="text-orange-600 w-5 h-5 md:w-8 md:h-8" />, bg: "bg-orange-600/5", color: "text-orange-600", glow: "shadow-orange-600/10" }
  }[rank as 1|2|3]

  const now = Date.now();
  const lastActiveTime = player.lastActive ? new Date(player.lastActive).getTime() : 0;
  const isActuallyOnline = (now - lastActiveTime) < 180000;

  return (
    <Card className={cn(
      "border rounded-[1.5rem] md:rounded-[3.5rem] flex flex-col items-center p-3 md:p-8 transition-all duration-1000 relative shadow-2xl", 
      styles.border, 
      styles.bg,
      styles.glow
    )}>
      <div className="absolute -top-3 md:-top-6 bg-zinc-950 px-2 md:px-6 py-1 md:py-2 rounded-full border border-inherit text-[8px] md:text-[11px] font-black uppercase tracking-widest text-zinc-100 shadow-2xl">
        #{rank}
      </div>
      <div className="mb-1 md:mb-8 animate-bounce transition-transform duration-1000">{styles.icon}</div>
      <div className="relative mb-2 md:mb-8">
        <Avatar className={cn("w-10 h-10 md:w-28 md:h-28 rounded-xl md:rounded-[2.5rem] border-2 md:border-4", styles.border)}>
          <AvatarImage src={player.profileImageUrl} />
          <AvatarFallback className="text-[10px] md:text-2xl bg-zinc-950 font-black text-zinc-300">{player.firstName?.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className={cn(
          "absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 md:w-6 md:h-6 rounded-full border border-zinc-950 md:border-[3px] shadow-glow",
          isActuallyOnline ? "bg-primary" : "bg-zinc-800",
          isActuallyOnline && player.status === 'studying' && "animate-pulse"
        )} />
      </div>
      <h3 className="text-[9px] md:text-[16px] font-black uppercase text-white truncate w-full text-center px-1 tracking-tight leading-none">
        {player.firstName} {isUser && "(YOU)"}
      </h3>
      <div className="mt-2 md:mt-8 text-center bg-black/40 w-full py-1.5 md:py-4 rounded-xl md:rounded-3xl border border-zinc-800/50">
        <p className={cn("text-base md:text-5xl font-black tracking-tighter leading-none", styles.color)}>
          {player.displayMinutes}
        </p>
        <p className="text-[7px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest mt-1">Min</p>
      </div>
    </Card>
  )
}
