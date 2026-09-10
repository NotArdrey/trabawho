import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordRecovery } from "@/features/auth/services/password-recovery";

const passwordRecoverySchema = z.object({
  password: z
    .string()
    .min(8, "Enter at least 8 characters.")
    .regex(/[A-Z]/, "Add at least one uppercase letter.")
    .regex(/[0-9]/, "Add at least one number."),
  confirmation: z.string(),
}).refine((values) => values.password === values.confirmation, {
  message: "Enter the same password in both fields.",
  path: ["confirmation"],
});

type PasswordRecoveryValues = z.infer<typeof passwordRecoverySchema>;

export default function PasswordRecoveryPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordRecoveryValues>({
    resolver: zodResolver(passwordRecoverySchema),
    defaultValues: { password: "", confirmation: "" },
  });

  const onSubmit = async ({ password }: PasswordRecoveryValues) => {
    setSubmitError("");
    try {
      await completePasswordRecovery(password);
      toast.success("Your password was updated. Sign in with your new password.");
      void navigate("/sign-in", { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Your password could not be updated.");
    }
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg sm:p-8" aria-labelledby="reset-password-title">
        <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="size-6" aria-hidden="true" />
        </div>
        <h1 id="reset-password-title" className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Use at least eight characters, including an uppercase letter and a number.
        </p>

        <form
          className="mt-6 grid gap-5"
          onSubmit={(event) => { void handleSubmit(onSubmit)(event); }}
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="recovery-password">New password</Label>
            <div className="relative">
              <Input
                id="recovery-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "recovery-password-error" : "recovery-password-help"}
                className="pr-12"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            <p id="recovery-password-help" className="text-xs text-muted-foreground">Eight or more characters, one uppercase letter, and one number.</p>
            {errors.password ? <p id="recovery-password-error" className="text-sm text-destructive" role="alert">{errors.password.message}</p> : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="recovery-confirmation">Confirm new password</Label>
            <div className="relative">
              <Input
                id="recovery-confirmation"
                type={showConfirmation ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmation)}
                aria-describedby={errors.confirmation ? "recovery-confirmation-error" : undefined}
                className="pr-12"
                {...register("confirmation")}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => setShowConfirmation((visible) => !visible)}
                aria-label={showConfirmation ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirmation}
              >
                {showConfirmation ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            {errors.confirmation ? <p id="recovery-confirmation-error" className="text-sm text-destructive" role="alert">{errors.confirmation.message}</p> : null}
          </div>

          {submitError ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p> : null}

          <Button type="submit" isLoading={isSubmitting}>
            {isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
            {isSubmitting ? "Updating password…" : "Update password"}
          </Button>
        </form>

        <Button className="mt-3 w-full" variant="ghost" asChild>
          <Link to="/sign-in">Back to sign in</Link>
        </Button>
      </section>
    </main>
  );
}
