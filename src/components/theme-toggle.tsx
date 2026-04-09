"use client"

import React, { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const root = window.document.documentElement
      const initialColorValue = root.classList.contains('dark')
      setIsDark(initialColorValue)
    }
  }, [])

  const toggleTheme = () => {
    const root = window.document.documentElement
    if (isDark) {
      root.classList.remove('dark')
      root.classList.add('light')
      setIsDark(false)
    } else {
      root.classList.remove('light')
      root.classList.add('dark')
      setIsDark(true)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="rounded-full w-10 h-10 hover:bg-muted"
    >
      {isDark ? <Sun className="w-5 h-5 text-accent" /> : <Moon className="w-5 h-5 text-primary" />}
    </Button>
  )
}
