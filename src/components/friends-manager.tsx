"use client"

import React, { useState, useMemo } from 'react'
import { UserPlus, Check, X, Users, Loader2, Trash2 } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase'
import { collection, doc, query, where, getDocs, limit } from 'firebase/firestore'
import { deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates'
import { useToast } from '@/hooks/use-toast'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function FriendsManager({ profileName }: { profileName?: string }) {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [searchUsername, setSearchUsername] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const requestsRef = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'friendRequests') : null, [db, user?.uid])
  const { data: requests } = useCollection(requestsRef)
  
  const friendsRef = useMemoFirebase(() => user ? collection(db, 'users', user.uid, 'friends') : null, [db, user?.uid])
  const { data: friendsList } = useCollection(friendsRef)
  
  const profileRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user?.uid])
  const { data: profile } = useDoc(profileRef)

  const friendIds = useMemo(() => {
    if (!friendsList) return []
    return friendsList.map(f => f.uid)
  }, [friendsList])
  
  const friendsProfilesQuery = useMemoFirebase(() => {
    if (friendIds.length === 0) return null
    const limitedIds = friendIds.slice(0, 30)
    return query(collection(db, 'users'), where('id', 'in', limitedIds))
  }, [db, JSON.stringify(friendIds)])

  const { data: friendProfiles } = useCollection(friendsProfilesQuery)

  const friendsFullProfiles = useMemo(() => {
    if (!friendProfiles) return []
    const now = Date.now();
    return [...friendProfiles]
      .map(f => {
        const lastActiveTime = f.lastActive ? new Date(f.lastActive).getTime() : 0;
        const isActuallyOnline = (now - lastActiveTime) < 300000;
        return { ...f, isActuallyOnline };
      })
      .sort((a, b) => {
        if (a.isActuallyOnline && a.status === 'studying' && !(b.isActuallyOnline && b.status === 'studying')) return -1;
        if (!(a.isActuallyOnline && a.status === 'studying') && b.isActuallyOnline && b.status === 'studying') return 1;
        if (a.isActuallyOnline && !b.isActuallyOnline) return -1;
        if (!a.isActuallyOnline && b.isActuallyOnline) return 1;
        return 0;
      })
  }, [friendProfiles])

  const studyingCount = useMemo(() => friendsFullProfiles.filter(f => f.isActuallyOnline && f.status === 'studying').length, [friendsFullProfiles])

  const sendRequestByUsername = async () => {
    const username = searchUsername.trim().toLowerCase()
    if (!username || !user || !profile || username === profile.username) return
    setIsSearching(true)
    try {
      const q = query(collection(db, 'users'), where('username', '==', username), limit(1))
      const snap = await getDocs(q)
      if (snap.empty) {
        toast({ variant: "destructive", title: "User not found" })
      } else {
        const targetId = snap.docs[0].id
        if (targetId === user.uid) return
        
        setDocumentNonBlocking(doc(db, 'users', targetId, 'friendRequests', user.uid), {
          senderId: user.uid, 
          senderName: profile.firstName, 
          senderUsername: profile.username, 
          senderPhoto: profile.profileImageUrl || '', 
          status: 'pending', 
          createdAt: new Date().toISOString()
        }, { merge: true })
        
        toast({ title: "Request Sent" })
        setSearchUsername('')
      }
    } catch (e) { 
      toast({ variant: "destructive", title: "Error sending request" }) 
    } finally { 
      setIsSearching(false) 
    }
  }

  const acceptRequest = (req: any) => {
    if (!user || !profile) return
    const myFriendRef = doc(db, 'users', user.uid, 'friends', req.senderId)
    setDocumentNonBlocking(myFriendRef, { uid: req.senderId, displayName: req.senderName, addedAt: new Date().toISOString() }, { merge: true })
    const theirFriendRef = doc(db, 'users', req.senderId, 'friends', user.uid)
    setDocumentNonBlocking(theirFriendRef, { uid: user.uid, displayName: profile.firstName, addedAt: new Date().toISOString() }, { merge: true })
    const requestRef = doc(db, 'users', user.uid, 'friendRequests', req.id)
    deleteDocumentNonBlocking(requestRef)
    toast({ title: "Buddy Synchronized!" })
  }

  const rejectRequest = (reqId: string) => {
    if (!user) return
    const requestRef = doc(db, 'users', user.uid, 'friendRequests', reqId)
    deleteDocumentNonBlocking(requestRef)
    toast({ title: "Request Terminated" })
  }

  const removeFriend = (id: string) => {
    if (!user) return
    deleteDocumentNonBlocking(doc(db, 'users', user.uid, 'friends', id))
    deleteDocumentNonBlocking(doc(db, 'users', id, 'friends', user.uid))
    toast({ variant: "destructive", title: "Buddy Removed" })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 pb-32 px-4 animate-in fade-in duration-700">
      <div className="grid grid-cols-2 gap-3 md:gap-6 max-w-2xl mx-auto">
        <div className="p-4 md:p-8 bg-zinc-900/60 rounded-[1.5rem] md:rounded-[2rem] border border-zinc-800/50 text-center">
          <p className="text-[8px] md:text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 md:mb-3">Circle</p>
          <p className="text-xl md:text-4xl font-black text-white tracking-tighter">{friendIds.length}</p>
        </div>
        <div className="p-4 md:p-8 bg-primary/10 rounded-[1.5rem] md:rounded-[2rem] border border-primary/20 text-center">
          <p className="text-[8px] md:text-[10px] font-black uppercase text-primary tracking-widest mb-1 md:mb-3">Live</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-xl md:text-4xl font-black text-primary tracking-tighter">{studyingCount}</p>
            {studyingCount > 0 && <div className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-primary animate-pulse" />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
        <Card className="md:col-span-5 border-zinc-800 bg-zinc-900/20 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 h-fit">
          <CardHeader className="p-0 mb-6"><CardTitle className="text-[10px] font-black text-primary uppercase tracking-widest">Growth Pipeline</CardTitle></CardHeader>
          <div className="flex gap-2 bg-black/40 p-1.5 rounded-xl border border-zinc-800 shadow-inner">
            <Input placeholder="@username" value={searchUsername} onChange={(e) => setSearchUsername(e.target.value)} className="bg-transparent border-none font-black text-xs md:text-sm uppercase flex-1 h-10" />
            <button onClick={sendRequestByUsername} disabled={isSearching || !searchUsername.trim()} className="rounded-lg h-10 w-10 bg-primary flex items-center justify-center disabled:opacity-50">{isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-5 h-5 text-white" />}</button>
          </div>
          
          <div className="space-y-4 mt-8">
            <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Requests ({requests?.length || 0})</h4>
            {requests?.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 bg-primary/10 rounded-xl border border-primary/20 group">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8 rounded-lg"><AvatarImage src={req.senderPhoto} /><AvatarFallback className="bg-zinc-950 font-black text-[10px]">{req.senderName?.charAt(0)}</AvatarFallback></Avatar>
                  <div><p className="text-[10px] font-black uppercase text-white leading-none">{req.senderName}</p><p className="text-[8px] font-bold text-zinc-500 uppercase mt-1">@{req.senderUsername}</p></div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" className="h-8 w-8 rounded-lg bg-primary" onClick={() => acceptRequest(req)}><Check className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-500" onClick={() => rejectRequest(req.id)}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="md:col-span-7 border-zinc-800 bg-zinc-900/20 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8">
          <CardHeader className="p-0 mb-6"><CardTitle className="text-[10px] font-black text-primary uppercase tracking-widest">Active Circle</CardTitle></CardHeader>
          <div className="space-y-3">
            {friendsFullProfiles.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 md:p-4 bg-black/20 rounded-xl md:rounded-2xl border border-zinc-800 group transition-all hover:bg-black/40">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="relative">
                    <Avatar className="w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-[1.25rem] border border-zinc-900 shadow-xl"><AvatarImage src={f.profileImageUrl} /><AvatarFallback className="bg-zinc-950 text-zinc-500 font-black">{f.firstName?.charAt(0)}</AvatarFallback></Avatar>
                    <div className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 md:w-5 md:h-5 rounded-full border-2 md:border-[3px] border-zinc-950 shadow-glow",
                      f.isActuallyOnline ? "bg-primary" : "bg-zinc-800",
                      f.isActuallyOnline && f.status === 'studying' && "animate-pulse"
                    )} />
                  </div>
                  <div>
                    <p className="text-xs md:text-[16px] font-black uppercase text-zinc-200 leading-none tracking-tight">{f.firstName}</p>
                    <p className="text-[8px] md:text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">@{f.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="text-right">
                    <p className="text-xl md:text-2xl font-black text-primary leading-none tracking-tighter">{(f.todayMinutes || 0)}</p>
                    <p className="text-[7px] md:text-[8px] font-black uppercase text-zinc-600 tracking-widest mt-1">Today</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFriend(f.id)} className="h-8 w-8 text-zinc-700 hover:text-rose-500"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
