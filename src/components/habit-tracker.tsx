
"use client"

import React, { useState } from 'react'
import { Check, Plus, Trophy, Trash2, Loader2, ListTodo } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase'
import { collection, doc } from 'firebase/firestore'
import { deleteDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates'
import { GamifiedReward } from '@/components/ui-extras/gamified-reward'

export function HabitTracker() {
  const { user } = useUser()
  const db = useFirestore()
  const { toast } = useToast()
  const [newHabitName, setNewHabitName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [rewardData, setRewardData] = useState({ title: '', subtitle: '' })

  const habitsRef = useMemoFirebase(() => {
    return user ? collection(db, 'users', user.uid, 'habits') : null
  }, [db, user])

  const { data: habits, isLoading } = useCollection(habitsRef)

  const addHabit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHabitName.trim() || !user || !habitsRef) return
    
    setIsAdding(true)
    addDocumentNonBlocking(habitsRef, {
      userId: user.uid,
      name: newHabitName,
      creationDate: new Date().toISOString(),
      targetFrequencyType: 'daily',
      targetValue: 1,
      unitOfMeasure: 'times',
      isActive: true,
      isCompleted: false,
      streak: 0
    })

    setNewHabitName('')
    setIsAdding(false)
    toast({ title: "Task Added", description: "Stay focused." })
  }

  const deleteHabit = (habitId: string) => {
    if (!user) return
    const habitRef = doc(db, 'users', user.uid, 'habits', habitId)
    deleteDocumentNonBlocking(habitRef)
    toast({ variant: "destructive", title: "Task Removed", description: "List updated." })
  }

  const toggleHabit = (habitId: string, currentStatus: boolean) => {
    if (!user) return
    const habitRef = doc(db, 'users', user.uid, 'habits', habitId)
    const newStatus = !currentStatus
    updateDocumentNonBlocking(habitRef, { isCompleted: newStatus })
    
    if (newStatus) {
      setRewardData({ title: "Task Cleared! 🎯", subtitle: "Momentum building." })
      setShowCelebration(true)
    }
  }

  return (
    <div className="space-y-6">
      <GamifiedReward 
        show={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        title={rewardData.title}
        subtitle={rewardData.subtitle}
      />

      <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl bg-zinc-900/40 backdrop-blur-sm rounded-[2.5rem]">
        <CardHeader className="flex flex-row items-center justify-between p-8 pb-4">
          <div>
            <CardTitle className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <ListTodo className="w-4 h-4" />
              To-Do List
            </CardTitle>
            <p className="text-[10px] text-zinc-500 uppercase font-black tracking-[0.1em] mt-1">Foundations of Focus</p>
          </div>
          <Trophy className="w-4 h-4 text-primary" />
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-4">
          <form onSubmit={addHabit} className="flex gap-2">
            <Input 
              placeholder="Add new task..." 
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              className="bg-zinc-950 border-zinc-800 rounded-xl text-sm h-12 px-4 font-bold text-white"
              disabled={isAdding}
            />
            <Button type="submit" size="icon" className="rounded-xl shrink-0 h-12 w-12 bg-primary shadow-lg shadow-primary/20" disabled={isAdding || !newHabitName.trim()}>
              {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-5 h-5" />}
            </Button>
          </form>

          <div className="space-y-2 pt-2">
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
            ) : habits?.length === 0 ? (
              <p className="text-center text-[10px] text-zinc-500 py-6 italic uppercase tracking-widest">Your list is empty.</p>
            ) : (
              habits?.map((habit) => (
                <div 
                  key={habit.id}
                  className={`group flex items-center justify-between p-4 rounded-2xl transition-all duration-300 border ${
                    habit.isCompleted ? 'bg-primary/5 border-primary/20 opacity-70' : 'bg-zinc-950 border-zinc-800 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleHabit(habit.id, habit.isCompleted)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all border-2 ${
                        habit.isCompleted ? 'bg-primary border-primary text-white shadow-lg' : 'bg-zinc-900 border-zinc-800'
                      }`}
                    >
                      {habit.isCompleted && <Check className="w-4 h-4 stroke-[4]" />}
                    </button>
                    <div>
                      <h3 className={`font-black text-[13px] uppercase tracking-tight transition-all text-white ${habit.isCompleted ? 'line-through text-zinc-600' : ''}`}>
                        {habit.name}
                      </h3>
                    </div>
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => deleteHabit(habit.id)}
                    className="h-8 w-8 text-zinc-300 hover:text-rose-500 hover:bg-rose-950/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
