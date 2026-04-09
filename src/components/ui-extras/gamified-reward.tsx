"use client"

import React, { useEffect, useState } from 'react'
import { Trophy, Sparkles, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RewardProps {
  show: boolean
  onComplete: () => void
  title: string
  subtitle?: string
}

export function GamifiedReward({ show, onComplete, title, subtitle }: RewardProps) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (show) {
      setActive(true)
      const timer = setTimeout(() => {
        setActive(false)
        onComplete()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [show, onComplete])

  if (!active) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div className="celebration-pop bg-white dark:bg-zinc-900 rounded-3xl p-10 shadow-2xl border-4 border-accent flex flex-col items-center gap-4 text-center glow-accent">
        <div className="relative">
          <Trophy className="w-20 h-20 text-accent animate-bounce" />
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-400 animate-pulse" />
          <Star className="absolute -bottom-2 -left-2 w-8 h-8 text-yellow-400 animate-pulse" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-primary mb-1">{title}</h2>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-3 h-3 rounded-full bg-accent animate-ping" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
