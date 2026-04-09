"use client"

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Leaf, LayoutDashboard, Settings, UserCircle, Rocket, Trash2, Users, BarChart3, UserPlus, Brain, Target, Zap, Trophy, LogOut, X, ChevronRight } from 'lucide-react'
import { FocusTimer } from '@/components/focus-timer'
import { HabitTracker } from '@/components/habit-tracker'
import { ProgressCalendar } from '@/components/progress-calendar'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useUser, useDoc, useFirestore, useAuth, useCollection, useMemoFirebase } from '@/firebase'
import { LandingAuth } from '@/components/landing-auth'
import { SettingsDialog } from '@/components/settings-dialog'
import { StudyRoomsView } from '@/components/study-room/study-rooms-view'
import { doc, collection, orderBy, query, where, limit } from 'firebase/firestore'
import { cn } from '@/lib/utils'
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates'
import { useToast } from '@/hooks/use-toast'
import { WeeklyLeaderboard } from '@/components/weekly-leaderboard'
import { FriendsManager } from '@/components/friends-manager'
import { NextObjectives } from '@/components/next-objectives'
import { AchievementsView } from '@/components/achievements-view'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { signOut } from 'firebase/auth'
import { ProfileSetup } from '@/components/profile-setup'

export default function CultivateFocusApp() {
  const { user, isUserLoading } = useUser()
  const auth = useAuth()
  const db = useFirestore()
  const { toast } = useToast()
  
  const [activeTab, setActiveTab] = useState('dashboard')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isTimerActiveOnMobile, setIsTimerActiveOnMobile] = useState(false)
  const [isTimerRunningOnMobile, setIsTimerRunningOnMobile] = useState(false)
  const [now, setNow] = useState(Date.now())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uid = user?.uid || null
  const userProfileRef = useMemoFirebase(() => uid ? doc(db, 'users', uid) : null, [db, uid])
  const userSettingsRef = useMemoFirebase(() => uid ? doc(db, 'users', uid, 'settings', 'default') : null, [db, uid])
  
  const sessionsRef = useMemoFirebase(() => {
    if (!uid) return null
    return query(collection(db, 'users', uid, 'focusSessions'), orderBy('startTime', 'desc'), limit(20))
  }, [db, uid])

  const completionsRef = useMemoFirebase(() => uid ? collection(db, 'users', uid, 'daily_completions') : null, [db, uid])
  const friendsRef = useMemoFirebase(() => uid ? collection(db, 'users', uid, 'friends') : null, [db, uid])
  const requestsRef = useMemoFirebase(() => uid ? collection(db, 'users', uid, 'friendRequests') : null, [db, uid])
  
  const { data: profile, isLoading: isProfileLoading } = useDoc(userProfileRef)
  const { data: userSettings } = useDoc(userSettingsRef)
  const { data: sessions } = useCollection(sessionsRef)
  const { data: completions } = useCollection(completionsRef)
  const { data: friendsList } = useCollection(friendsRef)
  const { data: incomingRequests } = useCollection(requestsRef)

  const pendingRequestsCount = incomingRequests?.length || 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!uid || !userProfileRef || !profile) return
    
    const interval = setInterval(() => {
      updateDocumentNonBlocking(userProfileRef, { 
        lastActive: new Date().toISOString()
      })
    }, 60000);

    return () => clearInterval(interval);
  }, [uid, userProfileRef, !!profile])

  const friendIds = useMemo(() => {
    if (!friendsList) return []
    return friendsList.map(f => f.uid).slice(0, 30).sort() 
  }, [friendsList])

  const friendsProfilesQuery = useMemoFirebase(() => {
    if (friendIds.length === 0) return null
    return query(collection(db, 'users'), where('id', 'in', friendIds))
  }, [db, friendIds.join(',')])
  
  const { data: friendsWithStatusRaw } = useCollection(friendsProfilesQuery)

  const friendsWithStatus = useMemo(() => {
    if (!friendsWithStatusRaw) return []
    return [...friendsWithStatusRaw]
      .map(f => {
        const lastActiveTime = f.lastActive ? new Date(f.lastActive).getTime() : 0;
        const isActuallyOnline = (now - lastActiveTime) < 180000; 
        return { ...f, isActuallyOnline };
      })
      .sort((a, b) => {
        if (a.isActuallyOnline && a.status === 'studying' && !(b.isActuallyOnline && b.status === 'studying')) return -1;
        if (!(a.isActuallyOnline && a.status === 'studying') && b.isActuallyOnline && b.status === 'studying') return 1;
        if (a.isActuallyOnline && !b.isActuallyOnline) return -1;
        if (!a.isActuallyOnline && b.isActuallyOnline) return 1;
        return 0;
      })
  }, [friendsWithStatusRaw, now])

  const currentMonthlyMinutes = profile?.monthlyMinutes || 0
  const monthlyGoalMinutes = profile?.monthlyMinutesGoal || 5400
  const monthlyProgressPercent = Math.min((currentMonthlyMinutes / monthlyGoalMinutes) * 100, 100)

  const streakStats = useMemo(() => {
    if (!completions || completions.length === 0) return { current: 0, best: 0 }
    const map = Object.fromEntries(completions.map(c => [c.id, true]))
    let current = 0
    let best = 0
    let checkDate = new Date()

    for (let i = 0; i < 365; i++) {
      const dateStr = checkDate.toISOString().split('T')[0]
      if (map[dateStr]) current++
      else if (dateStr !== new Date().toISOString().split('T')[0]) break
      checkDate.setDate(checkDate.getDate() - 1)
    }

    const sortedDates = completions.map(c => c.id).sort()
    if (sortedDates.length > 0) {
      let tempStreak = 1
      best = 1
      for (let i = 1; i < sortedDates.length; i++) {
        const prev = new Date(sortedDates[i-1])
        const curr = new Date(sortedDates[i])
        const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) tempStreak++
        else tempStreak = 1
        best = Math.max(best, tempStreak)
      }
    }
    return { current, best }
  }, [completions])

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      toast({ title: "Session Terminated" })
    } catch (error) {
      toast({ variant: "destructive", title: "Sign Out Failed" })
    }
  }

  const deleteSession = (sessionId: string, duration: number) => {
    if (!uid || !userProfileRef || !profile) return
    const sessionDocRef = doc(db, 'users', uid, 'focusSessions', sessionId)
    
    const updates = {
      todayMinutes: Math.max(0, (profile.todayMinutes || 0) - duration),
      weeklyMinutes: Math.max(0, (profile.weeklyMinutes || 0) - duration),
      monthlyMinutes: Math.max(0, (profile.monthlyMinutes || 0) - duration)
    }
    
    updateDocumentNonBlocking(userProfileRef, updates)
    deleteDocumentNonBlocking(sessionDocRef)
    toast({ title: "Record Reverted", description: `Subtracted ${duration} minutes from totals.` })
  }

  if (isUserLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950">
        <Leaf className="text-primary w-12 h-12 animate-pulse mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Initializing Protocol...</p>
      </div>
    )
  }

  if (!user) return <LandingAuth />;

  if (!isProfileLoading && user && !profile) {
    return <ProfileSetup userId={user.uid} />;
  }

  if (isProfileLoading || !profile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 p-12 text-center">
        <div className="animate-pulse flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20">
            <Leaf className="text-white w-8 h-8" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-400">Cultivating Environment...</p>
        </div>
      </div>
    )
  }

  const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && uid && userProfileRef) {
      if (file.size > 1024 * 1024) {
        toast({ variant: "destructive", title: "Image too big" })
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        updateDocumentNonBlocking(userProfileRef, { profileImageUrl: reader.result as string })
        toast({ title: "Profile Image Updated" })
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-zinc-950 text-foreground overflow-x-hidden min-h-screen">
      <aside className={cn(
        "hidden md:flex border-r border-zinc-900 flex-col items-center lg:items-start p-6 bg-zinc-900/30 sticky top-0 h-screen z-50 transition-all duration-300",
        isSidebarCollapsed ? "w-20" : "w-20 lg:w-72"
      )}>
        <div className="flex items-center justify-between w-full mb-12 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Leaf className="text-primary-foreground w-6 h-6" />
            </div>
            {!isSidebarCollapsed && <span className="hidden lg:block text-sm font-black tracking-tighter text-primary uppercase leading-tight">Cultivate</span>}
          </div>
        </div>

        <nav className="flex-1 space-y-3 w-full overflow-y-auto no-scrollbar">
          <SidebarNavItem icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} />
          <SidebarNavItem icon={<Trophy className="w-5 h-5" />} label="Achievements" active={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} collapsed={isSidebarCollapsed} />
          <SidebarNavItem icon={<Users className="w-5 h-5" />} label="Rooms" active={activeTab === 'study-rooms'} onClick={() => setActiveTab('study-rooms')} collapsed={isSidebarCollapsed} />
          <SidebarNavItem icon={<BarChart3 className="w-5 h-5" />} label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => setActiveTab('leaderboard')} collapsed={isSidebarCollapsed} />
          <SidebarNavItem 
            icon={<UserPlus className="w-5 h-5" />} 
            label="Buddies" 
            active={activeTab === 'friends'} 
            onClick={() => setActiveTab('friends')} 
            collapsed={isSidebarCollapsed}
            badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined}
          />
          <SidebarNavItem icon={<UserCircle className="w-5 h-5" />} label="Profile" active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} collapsed={isSidebarCollapsed} />
          <SidebarNavItem icon={<Settings className="w-5 h-5" />} label="Settings" onClick={() => setIsSettingsOpen(true)} collapsed={isSidebarCollapsed} />
          
          {/* Sign Out Option under Settings in Sidebar for Website Version */}
          {!isSidebarCollapsed && (
            <SidebarNavItem 
              icon={<LogOut className="w-5 h-5 text-rose-500/80" />} 
              label="Sign Out" 
              onClick={handleSignOut} 
              collapsed={isSidebarCollapsed}
              className="text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10"
            />
          )}
          
          {!isSidebarCollapsed && (
            <div className="pt-8 space-y-4">
               <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-4">Circle Status</p>
               <div className="space-y-2 px-2">
                 <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <Avatar className="w-7 h-7 rounded-lg">
                          <AvatarImage src={profile.profileImageUrl} />
                          <AvatarFallback className="text-[10px] font-black">{profile.firstName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-950 shadow-glow transition-colors",
                          "bg-primary",
                          profile.status === 'studying' && "animate-pulse"
                        )} />
                      </div>
                      <span className="text-[11px] font-bold text-zinc-400 truncate group-hover:text-white transition-colors">
                        {profile.firstName} (YOU)
                      </span>
                    </div>
                    {profile.status === 'studying' && <Rocket className="w-3 h-3 text-primary shrink-0" />}
                 </div>

                 {friendsWithStatus.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <Avatar className="w-7 h-7 rounded-lg">
                            <AvatarImage src={f.profileImageUrl} />
                            <AvatarFallback className="text-[10px] font-black">{f.firstName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-zinc-950 shadow-glow transition-colors",
                            f.isActuallyOnline ? "bg-primary" : "bg-zinc-800",
                            f.isActuallyOnline && f.status === 'studying' && "animate-pulse"
                          )} />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-400 truncate group-hover:text-white transition-colors">
                          {f.firstName}
                        </span>
                      </div>
                      {f.isActuallyOnline && f.status === 'studying' && <Rocket className="w-3 h-3 text-primary shrink-0" />}
                    </div>
                  ))}
               </div>
            </div>
          )}
        </nav>

        {!isSidebarCollapsed && (
          <div className="mt-auto w-full pb-4">
            <GoalProgressCard percent={monthlyProgressPercent} current={currentMonthlyMinutes} goal={monthlyGoalMinutes} onClick={() => setIsSettingsOpen(true)} isMobile={false} />
          </div>
        )}
      </aside>

      <main className={cn(
        "flex-1 p-4 md:p-8 lg:p-12 overflow-y-auto pb-32 md:pb-8",
        isTimerActiveOnMobile && "p-0 overflow-hidden h-screen fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center"
      )}>
        <div className={cn(
          "w-full transition-all duration-500",
          isTimerActiveOnMobile ? "fixed inset-0 z-[100] bg-zinc-950 flex flex-col items-center justify-center p-8 md:relative md:bg-transparent md:p-0 md:z-0 md:inset-auto md:w-auto" : "max-w-6xl mx-auto"
        )}>
          {isTimerActiveOnMobile ? (
            <div className="w-full max-w-sm flex-1 flex flex-col items-center justify-center">
              <FocusTimer 
                userSettings={userSettings} 
                userId={uid!} 
                isFullScreen={true}
                initialActive={true}
                onTimerStateChange={setIsTimerActiveOnMobile}
                onActiveStateChange={setIsTimerRunningOnMobile}
              />
            </div>
          ) : (
            <>
              <header className="flex justify-between items-center mb-8 md:mb-12">
                <div>
                  <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white uppercase leading-none">
                    {activeTab === 'dashboard' ? 'Dashboard' : activeTab.replace('-', ' ')}
                  </h1>
                  <p className="text-zinc-400 text-[10px] md:text-xs mt-1 font-black tracking-widest uppercase opacity-80">Consistency is the only metric.</p>
                </div>
                {/* Mobile-only leaderboard and settings buttons */}
                <div className="flex items-center gap-3 md:hidden">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all" 
                    onClick={() => setActiveTab('leaderboard')}
                  >
                    <BarChart3 className="w-6 h-6" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all" 
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <Settings className="w-6 h-6" />
                  </Button>
                </div>
              </header>

              <div className={cn("space-y-8 animate-in fade-in duration-700", activeTab !== 'dashboard' && 'hidden')}>
                <div className="md:hidden">
                  <GoalProgressCard percent={monthlyProgressPercent} current={currentMonthlyMinutes} goal={monthlyGoalMinutes} onClick={() => setIsSettingsOpen(true)} isMobile={true} />
                </div>

                <div className="flex justify-center">
                  <div className="w-full max-w-2xl">
                    <FocusTimer 
                      userSettings={userSettings} 
                      userId={uid!} 
                      onTimerStateChange={setIsTimerActiveOnMobile}
                      onActiveStateChange={setIsTimerRunningOnMobile}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-7 space-y-8">
                    <HabitTracker />
                    <NextObjectives 
                      sessions={sessions || []} 
                      profile={profile} 
                      streak={streakStats.current} 
                    />
                  </div>
                  <div className="lg:col-span-5 space-y-8">
                    <ProgressCalendar userId={uid!} bestStreak={streakStats.best} />
                  </div>
                </div>
              </div>

              {activeTab === 'achievements' && <AchievementsView sessions={sessions || []} profile={profile} streak={streakStats.current} />}
              {activeTab === 'study-rooms' && <StudyRoomsView user={user} profile={profile} />}
              {activeTab === 'friends' && <FriendsManager profileName={profile.firstName} />}
              {activeTab === 'leaderboard' && <WeeklyLeaderboard />}
              {activeTab === 'profile' && (
                <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
                  <Card className="p-8 border-zinc-800 bg-zinc-900/40 rounded-[2rem]">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-[2rem] bg-zinc-800 flex items-center justify-center text-3xl font-black text-primary border-4 border-zinc-800 overflow-hidden">
                          {profile?.profileImageUrl ? <img src={profile.profileImageUrl} alt="avatar" className="w-full h-full object-cover" /> : profile?.firstName?.charAt(0)}
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProfileImageUpload} />
                      </div>
                      <div className="text-center md:text-left w-full">
                        <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tight">{profile?.firstName} (YOU)</h2>
                        <p className="text-zinc-400 font-bold">@{profile?.username}</p>
                        
                        {/* Unified Action Row for Mobile and Website */}
                        <div className="mt-6 flex flex-row gap-3">
                           <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="flex-1 md:flex-initial md:px-8 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest border-zinc-800">
                             <Settings className="w-3.5 h-3.5 mr-2" /> Settings
                           </Button>
                           <Button onClick={handleSignOut} variant="destructive" className="flex-1 md:flex-initial md:px-8 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest bg-rose-500/80 hover:bg-rose-500 text-white">
                             <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
                           </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <Card className="border-zinc-800 bg-zinc-900/40 rounded-[2rem] overflow-hidden">
                    <CardHeader><CardTitle className="text-xs font-black text-primary uppercase tracking-widest">Focus History</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {sessions?.slice(0, 20).map(s => {
                        const startTime = new Date(s.startTime);
                        const timeStr = startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const dateStr = startTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
                        
                        return (
                          <div key={s.id} className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                            <div>
                              <div className="text-xs font-black text-white uppercase">{s.durationMinutes}m {s.sessionType}</div>
                              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{dateStr} at {timeStr}</div>
                            </div>
                            <button onClick={() => deleteSession(s.id, s.durationMinutes)} className="p-2 hover:bg-rose-500/10 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4 text-zinc-600 hover:text-rose-500" />
                            </button>
                          </div>
                        )
                      })}
                      {(!sessions || sessions.length === 0) && <p className="text-center py-10 text-[10px] text-zinc-400 font-black uppercase tracking-widest">No focus history yet.</p>}
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <nav className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-zinc-800 flex items-center justify-around py-3 z-[60] safe-area-bottom h-20 px-6",
        isTimerActiveOnMobile && "hidden"
      )}>
        <MobileNavItem icon={<LayoutDashboard className="w-6 h-6" />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={<Trophy className="w-6 h-6" />} active={activeTab === 'achievements'} onClick={() => setActiveTab('achievements')} />
        <MobileNavItem icon={<Users className="w-6 h-6" />} active={activeTab === 'study-rooms'} onClick={() => setActiveTab('study-rooms')} />
        <MobileNavItem icon={<UserPlus className="w-6 h-6" />} active={activeTab === 'friends'} onClick={() => setActiveTab('friends')} badge={pendingRequestsCount > 0 ? pendingRequestsCount : undefined} />
        <MobileNavItem icon={<UserCircle className="w-6 h-6" />} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
      </nav>

      <SettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} userId={uid!} currentSettings={userSettings} />
    </div>
  )
}

function SidebarNavItem({ icon, label, active = false, onClick, collapsed, badge, className }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, collapsed: boolean, badge?: number, className?: string }) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-[1.5rem] cursor-pointer transition-all group relative",
        active ? 'bg-primary text-primary-foreground shadow-lg' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white',
        collapsed && "justify-center p-3",
        className
      )}
    >
      <div className={cn(active ? 'text-white' : 'group-hover:text-primary transition-colors')}>{icon}</div>
      {!collapsed && <span className="hidden lg:block font-black text-[11px] uppercase tracking-[0.2em]">{label}</span>}
      {badge !== undefined && (
        <div className={cn(
          "absolute rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center min-w-4 h-4 px-1",
          collapsed ? "top-2 right-2" : "right-4"
        )}>
          {badge}
        </div>
      )}
    </div>
  )
}

function MobileNavItem({ icon, active, onClick, badge }: { icon: React.ReactNode, active: boolean, onClick: () => void, badge?: number }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative", active ? "text-primary scale-110" : "text-zinc-500")}>
      {icon}
      {badge !== undefined && (
        <div className="absolute top-1 right-1 rounded-full bg-rose-500 text-white text-[8px] font-black flex items-center justify-center min-w-3.5 h-3.5 px-0.5">
          {badge}
        </div>
      )}
      <div className={cn("w-1 h-1 rounded-full bg-primary mt-1 opacity-0", active && "opacity-100")} />
    </button>
  )
}

function GoalProgressCard({ percent, current, goal, onClick, isMobile }: { percent: number, current: number, goal: number, onClick: () => void, isMobile: boolean }) {
  return (
    <div className="p-6 bg-zinc-900/60 rounded-[2rem] border border-zinc-800/50 w-full cursor-pointer hover:bg-zinc-800/80 transition-all duration-300 shadow-xl group" onClick={onClick}>
      <div className="flex justify-between items-end mb-4">
        <div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 flex items-center gap-2">
            <Target className="w-3 h-3 text-primary" />
            Monthly Progress
          </p>
          <p className="text-2xl font-black text-white tracking-tighter leading-none">{Math.round(percent)}%</p>
        </div>
        <div className="text-right">
          {!isMobile ? (
            <p className="text-11px font-black text-zinc-400 uppercase tracking-tight">
              <span className="text-primary">{current}</span>
              <span className="mx-1 opacity-40">/</span>
              {goal}m
            </p>
          ) : (
            <div className="w-8 h-8 rounded-full border-2 border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
              <Zap className="w-3 h-3" />
            </div>
          )}
        </div>
      </div>
      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50 p-0.5">
         <div 
           className="h-full bg-primary rounded-full transition-all duration-1000 shadow-[0_0_15px_hsl(var(--primary)/0.3)]" 
           style={{ width: `${percent}%` }} 
         />
      </div>
    </div>
  )
}
