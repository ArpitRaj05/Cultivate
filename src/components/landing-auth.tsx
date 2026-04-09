'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Leaf, Loader2, Camera, Lock, Sparkles, UserCircle2 } from 'lucide-react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useFirestore, useAuth } from '@/firebase';
import { doc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

export function LandingAuth() {
  const [view, setView] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    username: '',
    password: '',
    profileImageUrl: ''
  });

  const [usernameError, setUsernameError] = useState('');
  const [particles, setParticles] = useState<{ x: number, y: number, size: number, duration: number }[]>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 15 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 20 + 10
    }));
    setParticles(newParticles);
  }, []);

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

  const initializeUserProfile = (userId: string, email: string, firstName: string, username: string, photoUrl: string) => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const day = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    monday.setHours(0, 0, 0, 0);
    const weekId = monday.toISOString().split('T')[0];
    const monthId = now.toISOString().substring(0, 7);

    const userProfileRef = doc(db, 'users', userId);
    const userSettingsRef = doc(db, 'users', userId, 'settings', 'default');

    setDocumentNonBlocking(userProfileRef, {
      id: userId,
      firstName: firstName,
      username: username,
      profileImageUrl: photoUrl,
      joinDate: new Date().toISOString(),
      email: email,
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
  };

  const handleSignUp = async () => {
    if (!formData.firstName || !formData.username || !formData.password) return;
    setLoading(true);
    const normalizedUsername = formData.username.toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    
    if (normalizedUsername.length < 3) {
      setUsernameError('Minimum 3 alphanumeric characters.');
      setLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', normalizedUsername), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setUsernameError('Username already claimed.');
        setLoading(false);
        return;
      }

      const email = `${normalizedUsername}@focus.app`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, formData.password);
      
      initializeUserProfile(userCredential.user.uid, email, formData.firstName, normalizedUsername, formData.profileImageUrl);
      toast({ title: "Account Created!" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Signup Failed", description: err.message });
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!formData.username || !formData.password) return;
    setLoading(true);
    try {
      const email = `${formData.username.toLowerCase().trim()}@focus.app`;
      await signInWithEmailAndPassword(auth, email, formData.password);
      toast({ title: "Welcome Back" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Login Failed", description: "Invalid credentials." });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 focus-bg-animation overflow-hidden">
      <div className="focus-bg-glow" style={{ top: '20%', left: '10%' }} />
      {particles.map((p, i) => (
        <div key={i} className="absolute rounded-full bg-primary/20 pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, animation: `float-glow ${p.duration}s infinite alternate ease-in-out` }} />
      ))}

      <div className="w-full max-w-lg relative z-10">
        <Card className="border-zinc-800/50 bg-zinc-900/40 backdrop-blur-3xl shadow-2xl rounded-[3rem] overflow-hidden border-t-2 border-t-primary/20 animate-in fade-in zoom-in-95 duration-700">
          <CardHeader className="text-center pt-12 pb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
              <Leaf className="text-white w-8 h-8" />
            </div>
            <CardTitle className="text-4xl font-black text-white uppercase tracking-tighter">
              {view === 'login' ? 'Login' : 'Create Account'}
            </CardTitle>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.4em] mt-2">Protocol Access</p>
          </CardHeader>
          <CardContent className="space-y-6 p-10 pt-0">
            {view === 'signup' && (
              <div className="flex flex-col items-center gap-4 mb-4">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <Avatar className="w-24 h-24 border-4 border-zinc-800 shadow-xl rounded-[2rem] bg-zinc-950">
                    {formData.profileImageUrl ? <AvatarImage src={formData.profileImageUrl} className="object-cover" /> : <AvatarFallback><Camera className="w-8 h-8 text-zinc-700" /></AvatarFallback>}
                  </Avatar>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              </div>
            )}

            <div className="space-y-4">
              {view === 'signup' && (
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-zinc-600 ml-2">Full Name</label>
                  <Input 
                    placeholder="John Doe" 
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="h-14 rounded-2xl bg-zinc-950/50 border-zinc-800/50 font-bold text-white px-6 focus:ring-primary shadow-inner"
                  />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-2">
                   <label className="text-[9px] font-black uppercase text-zinc-600">Username</label>
                   {usernameError && <span className="text-[8px] font-bold text-rose-500 uppercase">{usernameError}</span>}
                </div>
                <div className="relative">
                  <Input 
                    placeholder="username" 
                    value={formData.username}
                    onChange={(e) => {
                      setFormData({...formData, username: e.target.value.toLowerCase().trim()});
                      setUsernameError('');
                    }}
                    className="h-14 rounded-2xl bg-zinc-950/50 border-zinc-800/50 font-bold text-white px-6 focus:ring-primary shadow-inner pr-12"
                  />
                  <UserCircle2 className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-zinc-600 ml-2">Password</label>
                <div className="relative">
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="h-14 rounded-2xl bg-zinc-950/50 border-zinc-800/50 font-bold text-white px-6 focus:ring-primary shadow-inner"
                  />
                  <Lock className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-700" />
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <Button 
                onClick={view === 'login' ? handleLogin : handleSignUp} 
                disabled={loading || !formData.username || !formData.password}
                className="w-full h-16 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] bg-primary hover:scale-[1.02] active:scale-95 transition-all text-white shadow-xl shadow-primary/20"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : view === 'login' ? 'Log In' : 'Create Account'}
              </Button>

              <button 
                onClick={() => setView(view === 'login' ? 'signup' : 'login')}
                className="w-full text-center text-[10px] text-zinc-600 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:text-primary transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                {view === 'login' ? "Don't have an account? Create Account" : "Already have an account? Log In"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
