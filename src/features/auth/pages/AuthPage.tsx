import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import BrandWordmark from '@/shared/components/BrandWordmark';
import PasswordField from '../components/PasswordField';
import { ResendConfirmationButton } from '../components/ResendConfirmationButton';
import { AccountRegistrationJourney } from '../components/AccountRegistrationJourney';
import { AuthVisual } from '../components/AuthVisual';
import { useAuthPageController, type AuthPageProps } from '../hooks/useAuthPageController';
import { useAuthPageNavigation } from '../hooks/useAuthPageNavigation';

export default function AuthPage({ mode = 'login', onModeChange, onBack, onSubmit, onForgotPasswordSubmit }: AuthPageProps) {
  const { email, setEmail, password, setPassword, busy, error, message, submit, resend } = useAuthPageController({ mode, onSubmit, onForgotPasswordSubmit });
  const navigation = useAuthPageNavigation();
  const title = mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Reset Password' : 'Sign in';
  return (
    <main className="min-h-dvh bg-background px-4 py-4 text-foreground sm:px-8 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <BrandWordmark className="text-2xl [&>span:first-child]:text-primary" />
          <Button variant="ghost" onClick={() => navigation.request(() => onBack?.())}><ArrowLeft aria-hidden="true" />Back to home</Button>
        </header>
        <div className="grid min-w-0 gap-6 lg:h-[calc(100dvh-8rem)] lg:min-h-[32rem] lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <AuthVisual />
          <section className="w-full min-w-0 max-w-xl justify-self-center rounded-lg border bg-card text-card-foreground shadow-sm lg:max-w-none lg:overflow-y-auto lg:overscroll-contain"
            aria-label={title} data-testid="auth-task-panel">
            <div className="space-y-4 p-6 sm:p-8">
              <nav aria-label="Account access" className="grid grid-cols-2 gap-2 rounded-lg bg-muted/60 p-1">
                <Button variant="ghost" className={cn('h-auto min-w-0 w-full whitespace-normal px-2 py-2', mode === 'login' && 'bg-card text-primary shadow-sm')}
                  aria-label={mode === 'register' ? 'Already have an account? Sign in' : undefined}
                  aria-current={mode === 'login' ? 'page' : undefined} disabled={busy} onClick={() => { if (mode !== 'login') navigation.request(() => onModeChange?.('login')); }}>Sign in</Button>
                <Button variant="ghost" className={cn('h-auto min-w-0 w-full whitespace-normal px-2 py-2', mode === 'register' && 'bg-card text-primary shadow-sm')}
                  aria-current={mode === 'register' ? 'page' : undefined} disabled={busy} onClick={() => { if (mode !== 'register') navigation.request(() => onModeChange?.('register')); }}>Create an account</Button>
              </nav>
              {mode === 'register' ? <p className="text-xs font-semibold text-primary">Join TrabaWho</p> : <div className="space-y-3">
                <p className="text-xs font-semibold text-primary">{mode === 'forgot' ? 'Account recovery' : 'Welcome back'}</p>
                <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
                <p className="text-sm leading-6 text-muted-foreground">{mode === 'forgot' ? 'Get a secure link to reset your password.' : 'Manage your bookings and services, or pick up your registration.'}</p>
              </div>}
              {mode === 'register' ? <AccountRegistrationJourney onDraftChange={navigation.setDirty} /> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                {error && <p role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm leading-6 text-destructive">{error}</p>}
                {message && <p role="status" className="rounded-lg bg-primary/10 p-4 text-sm leading-6">{message}</p>}
                <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" placeholder="you@example.com" required type="email" autoComplete="email" disabled={busy} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
                {mode === 'login' && <PasswordField id="auth-password" label="Password" required autoComplete="current-password" disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} />}
                {mode === 'login' && <div className="flex flex-col gap-2">
                  <Button variant="ghost" type="button" className="self-start px-0 text-primary" onClick={() => onModeChange?.('forgot')}>Forgot password?</Button>
                  <ResendConfirmationButton disabled={busy || !email} onClick={() => void resend()} />
                </div>}
                <Button type="submit" isLoading={busy} className="w-full">{mode === 'forgot' ? 'Send reset link' : 'Sign in'}<ArrowRight aria-hidden="true" /></Button>
              </form>}
            </div>
          </section>
        </div>
      </div>
      <AlertDialog open={Boolean(navigation.pending)} onOpenChange={(open) => { if (!open) navigation.cancel(); }}>
        <AlertDialogContent onCloseAutoFocus={(event) => { event.preventDefault(); navigation.restoreFocus(); }}>
          <AlertDialogHeader><AlertDialogTitle>Leave registration?</AlertDialogTitle>
            <AlertDialogDescription>Your unsaved form entries and selected images will be lost. Stay here to continue your registration.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel asChild><Button variant="outline">Stay on registration</Button></AlertDialogCancel>
            <AlertDialogAction asChild><Button onClick={navigation.confirm}>Leave registration</Button></AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
