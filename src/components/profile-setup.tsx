
'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Leaf, Loader2, Camera, Upload, ArrowRight, UserCircle2 } from 'lucide-react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useFirestore } from '@/firebase';
import { doc, getDocs, collection, query, where } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

export function ProfileSetup({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const db = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    username: '',
    profileImageUrl: ''
  });

  const [usernameError, setUsernameError] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast({ variant: "destructive", title: "Image too big", description: "Please use an image under 1MB." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profileImageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!formData.firstName || !formData.username) return;
    
    setLoading(true);
    setUsernameError('');
    
    // Normalize username to lowercase
    const normalizedUsername = formData.username.toLowerCase().trim();
    
    // Validate username format (simple alphanumeric + underscores)
    if (!/^[a-z0-9_]{3,15}$/.test(normalizedUsername)) {
      setUsernameError('3-15 characters. Letters, numbers, underscores only.');
      setLoading(false);
      return;
    }

    try {
      // Check for unique username
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', normalizedUsername));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setUsernameError('This username is already claimed. Try another.');
        setLoading(false);
        return;
      }

      const userProfileRef = doc(db, 'users', userId);
      const userSettingsRef = doc(db, 'users', userId, 'settings', 'default');

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      
      // Weekly Reset logic
      const day = (now.getDay() + 6) % 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - day)
      monday.setHours(0, 0, 0, 0)
      const weekId = monday.toISOString().split('T')[0]

      // Monthly Reset logic
      const monthId = now.toISOString().substring(0, 7) // YYYY-MM

      // Create Profile
      setDocumentNonBlocking(userProfileRef, {
        id: userId,
        firstName: formData.firstName,
        username: normalizedUsername,
        bio: '',
        profileImageUrl: formData.profileImageUrl,
        joinDate: new Date().toISOString(),
        email: '', // Placeholder as they are anonymous initially
        todayMinutes: 0,
        weeklyMinutes: 0,
        monthlyMinutes: 0,
        lastDateUpdated: todayStr,
        lastWeekUpdated: weekId,
        lastMonthUpdated: monthId,
        monthlyMinutesGoal: 5400,
        isStudying: false,
        status: 'online',
        lastActive: new Date().toISOString()
      }, { merge: true });

      // Create Initial Settings
      setDocumentNonBlocking(userSettingsRef, {
        id: 'default',
        userId: userId,
        pomodoroFocusDurationMinutes: 25,
        pomodoroBreakDurationMinutes: 5,
        deepWorkDurationMinutes: 50,
        darkModeEnabled: true,
        enableNotifications: true,
        preferredTheme: 'Default'
      }, { merge: true });

      // Artificial delay for smooth UX transition
      setTimeout(() => {
        setLoading(false);
        toast({ title: "Welcome to the Grove!", description: "Your journey begins now." });
      }, 800);

    } catch (err) {
      console.error(err);
      setLoading(false);
      toast({ variant: "destructive", title: "Setup Failed", description: "Connection issue. Please try again." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-zinc-950">
      <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900/40 backdrop-blur-xl shadow-2xl rounded-[3rem] overflow-hidden border-t-2 border-t-primary/20">
        <CardHeader className="text-center pt-12 pb-4">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
            <Leaf className="text-white w-8 h-8" />
          </div>
          <CardTitle className="text-4xl font-black text-white uppercase tracking-tighter">
            Initialize
          </CardTitle>
          <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mt-2">Personalize Your Protocol</p>
        </CardHeader>
        <CardContent className="space-y-10 p-10 pt-4">
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-4">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Avatar className="w-28 h-28 border-4 border-zinc-800 shadow-xl rounded-[2.5rem] bg-zinc-950">
                  {formData.profileImageUrl ? (
                    <AvatarImage src={formData.profileImageUrl} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-zinc-900 text-zinc-600">
                      <Camera className="w-10 h-10" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="absolute inset-0 bg-black/60 rounded-[2.5rem] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <Upload className="w-8 h-8 text-white" />
                </div>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 group-hover:text-primary transition-colors">Capture Identity</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageUpload} 
              />
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">First Name</label>
                </div>
                <Input 
                  placeholder="e.g. Alex" 
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  className="h-16 rounded-2xl bg-zinc-950/50 border-zinc-800 font-bold text-white px-6 focus:ring-primary shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">Username</label>
                   {usernameError && <span className="text-[9px] font-bold text-rose-500 uppercase">{usernameError}</span>}
                </div>
                <div className="relative">
                  <Input 
                    placeholder="alex_focus" 
                    value={formData.username}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/\s/g, '');
                      setFormData({...formData, username: val});
                      setUsernameError('');
                    }}
                    className={`h-16 rounded-2xl bg-zinc-950/50 border-zinc-800 font-bold text-white px-6 focus:ring-primary shadow-inner pr-12 ${usernameError ? 'border-rose-900/50 bg-rose-500/5' : ''}`}
                  />
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-700">
                    <UserCircle2 className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleComplete} 
            disabled={loading || !formData.firstName || !formData.username}
            className="w-full h-16 rounded-2xl text-[13px] font-black uppercase tracking-[0.3em] shadow-xl shadow-primary/20 bg-primary hover:scale-[1.02] active:scale-95 transition-all text-white"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Enter the Grove <ArrowRight className="ml-2 w-5 h-5" /></>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
