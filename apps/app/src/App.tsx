import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { LoginScreen } from './components/LoginScreen';
import { SplashScreen } from './components/SplashScreen';

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'login' | 'app'>('splash');
  useEffect(() => { const timer = window.setTimeout(() => setPhase('login'), 900); return () => window.clearTimeout(timer); }, []);
  if (phase === 'splash') return <SplashScreen />;
  if (phase === 'login') return <LoginScreen onLogin={() => setPhase('app')} />;
  return <AppShell />;
}
