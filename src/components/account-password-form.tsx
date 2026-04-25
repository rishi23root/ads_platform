'use client';

import { useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconAlertTriangle,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconLock,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { adminPanelCardClassName } from '@/lib/admin-ui';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const MIN_PASSWORD_LEN = 8;

function passwordErrorMessage(message: string | undefined) {
  if (!message) return 'Something went wrong.';
  if (/not fresh|SESSION_EXPIRED|expired/i.test(message)) {
    return `${message} Try signing out and signing in again, then retry.`;
  }
  return message;
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  autoComplete: string;
  show: boolean;
  onToggleShow: () => void;
  minLength?: number;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
};

function PasswordFieldRow({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
  show,
  onToggleShow,
  minLength,
  required = true,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: PasswordFieldProps) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className="h-10 pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 size-10 text-muted-foreground hover:text-foreground"
          onClick={onToggleShow}
          disabled={disabled}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
        >
          {show ? <IconEyeOff className="size-4" aria-hidden /> : <IconEye className="size-4" aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}

export function AccountPasswordForm() {
  const router = useRouter();
  const formErrorId = useId();
  const newPwdHintId = useId();
  const confirmStatusId = useId();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const confirmMatch = useMemo(() => {
    if (!confirmPassword.length) return 'idle' as const;
    if (newPassword === confirmPassword) return 'match' as const;
    return 'mismatch' as const;
  }, [newPassword, confirmPassword]);

  const confirmDescribedBy =
    [confirmStatusId, formError ? formErrorId : undefined].filter(Boolean).join(' ') || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (newPassword.length < MIN_PASSWORD_LEN) {
      setFormError(`New password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setFormError('New password must be different from your current password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions,
      });
      if (res.error) {
        setFormError(passwordErrorMessage(res.error.message));
        return;
      }
      toast.success(
        revokeOtherSessions
          ? 'Password updated. Other devices were signed out.'
          : 'Password updated successfully.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setRevokeOtherSessions(false);
      router.refresh();
    } catch {
      setFormError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={cn('gap-0 py-0', adminPanelCardClassName)}>
      <CardHeader className="border-0 px-4 pb-3 pt-5 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <IconLock className="size-[18px]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-lg">Change password</CardTitle>
            <CardDescription className="text-pretty text-sm leading-snug">
              Confirm your current password, then choose a new one. Other sessions can be ended in one
              step if needed.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="border-t border-border px-4 pb-5 pt-5 sm:px-6 sm:pb-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
          <div className="space-y-4">
            <div className="space-y-3">
              <SectionLabel>Verify it&apos;s you</SectionLabel>
              <PasswordFieldRow
                id="current-password"
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                disabled={isLoading}
                autoComplete="current-password"
                show={showCurrent}
                onToggleShow={() => setShowCurrent((v) => !v)}
                aria-invalid={!!formError}
                aria-describedby={formError ? formErrorId : undefined}
              />
            </div>

            <Separator className="my-0" />

            <div className="space-y-4">
              <SectionLabel>New password</SectionLabel>
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 sm:gap-6">
                <div className="min-w-0 space-y-2">
                  <PasswordFieldRow
                    id="new-password"
                    label="New password"
                    value={newPassword}
                    onChange={setNewPassword}
                    disabled={isLoading}
                    autoComplete="new-password"
                    show={showNew}
                    onToggleShow={() => setShowNew((v) => !v)}
                    minLength={MIN_PASSWORD_LEN}
                    aria-invalid={!!formError}
                    aria-describedby={newPwdHintId}
                  />
                  <p id={newPwdHintId} className="text-xs leading-relaxed text-muted-foreground">
                    Minimum {MIN_PASSWORD_LEN} characters. A longer passphrase is often safer and easier
                    to remember.
                  </p>
                </div>
                <div className="min-w-0 space-y-2">
                  <PasswordFieldRow
                    id="confirm-password"
                    label="Confirm new password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    disabled={isLoading}
                    autoComplete="new-password"
                    show={showConfirm}
                    onToggleShow={() => setShowConfirm((v) => !v)}
                    minLength={MIN_PASSWORD_LEN}
                    aria-invalid={!!formError}
                    aria-describedby={confirmDescribedBy}
                  />
                  <div
                    id={confirmStatusId}
                    className="min-h-[1.25rem] text-xs leading-relaxed"
                    aria-live="polite"
                  >
                    {confirmMatch === 'match' && (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <IconCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-500" aria-hidden />
                        Matches new password
                      </span>
                    )}
                    {confirmMatch === 'mismatch' && (
                      <span className="text-destructive">Does not match new password</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/35 px-4 py-3 ring-1 ring-border/60">
            <div className="flex gap-3">
              <Checkbox
                id="revoke-others"
                checked={revokeOtherSessions}
                onCheckedChange={(v) => setRevokeOtherSessions(v === true)}
                disabled={isLoading}
                className="mt-0.5"
              />
              <div className="min-w-0 space-y-1">
                <Label htmlFor="revoke-others" className="cursor-pointer text-sm font-medium leading-snug">
                  Sign out all other sessions
                </Label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Recommended if your password may have been seen elsewhere. This device stays signed in.
                </p>
              </div>
            </div>
          </div>

          {formError && (
            <div
              id={formErrorId}
              role="alert"
              className="flex gap-3 rounded-lg border border-destructive/35 bg-destructive/8 px-3 py-3 text-sm text-destructive"
            >
              <IconAlertTriangle className="size-4 shrink-0 translate-y-0.5" aria-hidden />
              <p className="min-w-0 leading-relaxed">{formError}</p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-center text-xs text-muted-foreground sm:mr-auto sm:text-left">
              After updating, use your new password next time you sign in.
            </p>
            <Button type="submit" disabled={isLoading} className="w-full gap-2 sm:w-auto sm:min-w-[168px]">
              {isLoading ? (
                <>
                  <IconLoader2
                    className="size-4 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                  Updating…
                </>
              ) : (
                'Update password'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
