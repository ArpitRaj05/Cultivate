'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Timer, Coffee, Zap, Loader2, Target, LogOut, Layers } from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { signOut } from 'firebase/auth';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentSettings?: any;
}

export function SettingsDialog({ isOpen, onClose, userId, currentSettings }: SettingsDialogProps) {
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  
  const profileRef = useMemoFirebase(() => userId ? doc(db, 'users', userId) : null, [db, userId])
  const { data: profile } = useDoc(profileRef)

  const [settings, setSettings] = useState({
    pomodoro: 25,
    deepWork: 50,
    break: 5,
    sessions: 1
  });
  const [monthlyGoal, setMonthlyGoal] = useState<string>('5400');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentSettings) {
      setSettings({
        pomodoro: currentSettings.pomodoroFocusDurationMinutes || 25,
        deepWork: currentSettings.deepWorkDurationMinutes || 50,
        break: currentSettings.pomodoroBreakDurationMinutes || 5,
        sessions: currentSettings.pomodoroSessions || 1
      });
    }
  }, [currentSettings]);

  useEffect(() => {
    if (profile?.monthlyMinutesGoal) {
      setMonthlyGoal(profile.monthlyMinutesGoal.toString());
    }
  }, [profile]);

  const handleSave = () => {
    setLoading(true);
    
    // Save Timer Settings
    const settingsRef = doc(db, 'users', userId, 'settings', 'default');
    setDocumentNonBlocking(settingsRef, {
      pomodoroFocusDurationMinutes: settings.pomodoro,
      deepWorkDurationMinutes: settings.deepWork,
      pomodoroBreakDurationMinutes: settings.break,
      pomodoroSessions: settings.sessions
    }, { merge: true });

    // Save Monthly Goal to Profile
    if (profileRef) {
      setDocumentNonBlocking(profileRef, {
        monthlyMinutesGoal: parseInt(monthlyGoal) || 5400
      }, { merge: true });
    }

    setTimeout(() => {
      setLoading(false);
      toast({ title: "Preferences Saved", description: "Your focus space is updated." });
      onClose();
    }, 500);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed Out", description: "Identity cleared." });
      onClose();
    } catch (error) {
      toast({ variant: "destructive", title: "Sign Out Failed" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-10 bg-white dark:bg-zinc-950 border-zinc-100 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-sm font-black text-primary flex items-center gap-3 uppercase tracking-[0.2em]">
            <Target className="w-5 h-5" />
            Focus Configuration
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-10 mt-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Monthly Focus Goal (Minutes)</span>
              <span className="text-xl font-black text-primary">{monthlyGoal}m</span>
            </div>
            <Input 
              type="number" 
              value={monthlyGoal} 
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setMonthlyGoal('0');
                } else {
                  setMonthlyGoal(val.replace(/^0+/, '') || '0');
                }
              }}
              className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 font-bold"
              autoFocus={false}
            />
          </div>

          <SettingItem 
            icon={<Zap className="w-4 h-4 text-orange-500" />} 
            label="Pomodoro Focus" 
            value={settings.pomodoro} 
            min={10} max={120} step={5}
            onChange={(v) => setSettings({...settings, pomodoro: v})}
          />
          <SettingItem 
            icon={<Zap className="w-4 h-4 text-primary" />} 
            label="Deep Work Focus" 
            value={settings.deepWork} 
            min={45} max={240} step={15}
            onChange={(v) => setSettings({...settings, deepWork: v})}
          />
          <SettingItem 
            icon={<Coffee className="w-4 h-4 text-blue-500" />} 
            label="Short Break" 
            value={settings.break} 
            min={2} max={30} step={1}
            onChange={(v) => setSettings({...settings, break: v})}
          />
          <SettingItem 
            icon={<Layers className="w-4 h-4 text-zinc-400" />} 
            label="Number of Sessions" 
            value={settings.sessions} 
            min={1} max={8} step={1}
            onChange={(v) => setSettings({...settings, sessions: v})}
          />
          
          <div className="space-y-4 pt-4">
            <Button onClick={handleSave} className="w-full h-16 rounded-2xl text-[13px] font-black uppercase tracking-[0.2em] bg-primary shadow-xl shadow-primary/20" disabled={loading}>
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Apply Changes'}
            </Button>
            <Button onClick={handleSignOut} variant="outline" className="w-full h-14 rounded-2xl text-[11px] font-black uppercase tracking-widest text-rose-500 border-rose-500/20 hover:bg-rose-500/10">
              <LogOut className="mr-2 w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingItem({ icon, label, value, min, max, step, onChange }: { icon: React.ReactNode, label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
        </div>
        <span className="text-xl font-black text-primary">{value}m</span>
      </div>
      <Slider 
        value={[value]} 
        min={min} 
        max={max} 
        step={step} 
        onValueChange={(vals) => onChange(vals[0])} 
        className="py-2"
      />
    </div>
  );
}
