import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BrandWordmark from '@/shared/components/BrandWordmark';
import PasswordField from '../components/PasswordField';
import { AccountRegistrationJourney } from '../components/AccountRegistrationJourney';
import { useAuthPageController, type AuthPageProps } from '../hooks/useAuthPageController';
export default function AuthPage({ mode = 'login', onModeChange, onBack, onSubmit, onForgotPasswordSubmit }: AuthPageProps) {
  const { email, setEmail, password, setPassword, busy, error, message, submit, resend } = useAuthPageController({ mode, onSubmit, onForgotPasswordSubmit });
  const title = mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Reset Password' : 'Sign in';
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground sm:px-8 sm:py-10">
    <div className="mx-auto max-w-5xl"><Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" />Back to home</Button>
      <div className="my-6"><BrandWordmark /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <aside className="relative hidden min-h-96 overflow-hidden rounded-2xl lg:block" aria-label="TrabaWho marketplace preview">
          <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?w=1400&h=1600&fit=crop" alt="Local professionals collaborating with clients" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-slate-950/40 to-transparent" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 space-y-4 p-8 text-white"><p className="text-sm font-semibold">Built for local work</p><h2 className="text-3xl font-bold">Find help, book work, and manage every job in one place.</h2><p className="text-sm leading-6 text-white/85">From the first search to the finished service, TrabaWho keeps the experience clear and connected.</p></div>
        </aside>
        <section className="space-y-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-8" aria-label={title}>
          <div className="space-y-2"><h1 className="text-3xl font-bold tracking-tight">{title}</h1><p className="text-sm leading-6 text-muted-foreground">{mode === 'register' ? 'Confirm your email, verify your identity, and join the marketplace.' : mode === 'forgot' ? 'Get a secure link to reset your password.' : 'Access your bookings and service workspace, or resume your registration.'}</p></div>
          {mode === 'register' ? <AccountRegistrationJourney /> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {message && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{message}</p>}
            <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            {mode === 'login' && <PasswordField id="auth-password" label="Password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />}
            <Button type="submit" isLoading={busy} className="w-full">{mode === 'forgot' ? 'Send reset link' : 'Sign in'}</Button>
            {mode === 'login' && <div className="flex flex-wrap gap-2"><Button variant="ghost" type="button" onClick={() => onModeChange?.('forgot')}>Forgot password?</Button><Button variant="outline" type="button" disabled={busy || !email} onClick={() => void resend()}>Resend confirmation email</Button></div>}
          </form>}
          <Button variant="ghost" className="w-full" onClick={() => onModeChange?.(mode === 'register' ? 'login' : 'register')}>{mode === 'register' ? 'Already have an account? Sign in' : 'Create an account'}</Button>
        </section>
      </div>
    </div>
  </main>;
}
