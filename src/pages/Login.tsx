import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Building2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 dark:bg-slate-900 p-4 transition-colors">
      <Card className="w-full max-w-md shadow-lg border-primary/10 dark:border-slate-800 dark:bg-slate-800 transition-colors">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-12 h-12 bg-primary/10 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl font-bold dark:text-white">Employee Portal</CardTitle>
          <CardDescription className="dark:text-slate-400">Sign in to manage your attendance</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="dark:text-slate-300">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="dark:text-slate-300">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
