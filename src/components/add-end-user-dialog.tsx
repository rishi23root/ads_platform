'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { IconEye, IconEyeOff, IconLoader2, IconUserPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import { END_USER_COUNTRY_REGEX, endUserAdminCreateLimits } from '@/lib/end-user-admin-create';

type FieldErrorKey = 'email' | 'password' | 'name' | 'country';

function buildFieldErrors(params: {
  em: string;
  password: string;
  nameTrim: string;
  countryTrim: string;
}): Partial<Record<FieldErrorKey, string>> {
  const { em, password, nameTrim, countryTrim } = params;
  const errs: Partial<Record<FieldErrorKey, string>> = {};

  if (em.length === 0) {
    errs.email = 'Email is required.';
  } else if (em.length > endUserAdminCreateLimits.emailMax) {
    errs.email = `Email must be at most ${endUserAdminCreateLimits.emailMax} characters.`;
  }

  if (em.length > 0) {
    if (password.length === 0) {
      errs.password = 'Password is required.';
    } else if (password.length < endUserAdminCreateLimits.passwordMin) {
      errs.password = `Password must be at least ${endUserAdminCreateLimits.passwordMin} characters.`;
    } else if (password.length > endUserAdminCreateLimits.passwordMax) {
      errs.password = `Password must be at most ${endUserAdminCreateLimits.passwordMax} characters.`;
    }
  }

  if (nameTrim.length > endUserAdminCreateLimits.nameMax) {
    errs.name = `Name must be at most ${endUserAdminCreateLimits.nameMax} characters.`;
  }
  if (countryTrim.length > 0 && !END_USER_COUNTRY_REGEX.test(countryTrim)) {
    errs.country = 'Enter a 2-letter country code (ISO 3166-1 alpha-2), e.g. US.';
  }

  return errs;
}

function describedByIds(...parts: (string | false | undefined | null)[]): string | undefined {
  const s = parts.filter(Boolean).join(' ');
  return s.length > 0 ? s : undefined;
}

export function AddEndUserDialog() {
  const router = useRouter();
  const serverAlertRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [plan, setPlan] = useState<'trial' | 'paid'>('trial');
  const [banned, setBanned] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const emailEntered = email.trim().length > 0;

  const reset = () => {
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setName('');
    setCountry('');
    setPlan('trial');
    setBanned(false);
    setFieldErrors({});
    setServerError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    const nameTrim = name.trim();
    const countryTrim = country.trim().toUpperCase();

    const nextErrors = buildFieldErrors({
      em,
      password,
      nameTrim,
      countryTrim,
    });
    setServerError(null);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        email: em,
        password,
        name: nameTrim || null,
        plan,
        banned,
      };
      if (countryTrim.length > 0) body.country = countryTrim;

      const res = await fetch('/api/end-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: string; user?: { id: string } };
      if (!res.ok) {
        setServerError(j.error ?? 'Could not create user');
        requestAnimationFrame(() => serverAlertRef.current?.focus());
        return;
      }
      toast.success('User created');
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="gap-2">
          <IconUserPlus className="h-4 w-4" aria-hidden />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-6 sm:max-w-md">
        <DialogHeader className="space-y-1 text-left">
          <DialogTitle>Add extension user</DialogTitle>
          <DialogDescription className="sr-only">
            Create a registered extension account with email and password. Name, country, plan, and banned
            status are optional.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-5" noValidate>
          {serverError && (
            <div
              ref={serverAlertRef}
              id="add-end-user-server-alert"
              tabIndex={-1}
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {serverError}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="add-email">Email</Label>
            <p id="add-email-sr-flow" className="sr-only">
              After you enter an email, a password field will appear below.
            </p>
            <Input
              id="add-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => {
                const v = e.target.value;
                setEmail(v);
                if (v.trim().length === 0) {
                  setPassword('');
                  setShowPassword(false);
                }
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.email;
                  return next;
                });
                setServerError(null);
              }}
              disabled={submitting}
              maxLength={endUserAdminCreateLimits.emailMax}
              placeholder="you@example.com"
              aria-invalid={!!fieldErrors.email || undefined}
              aria-describedby={describedByIds(
                serverError && 'add-end-user-server-alert',
                !emailEntered && 'add-email-sr-flow',
                fieldErrors.email && 'add-end-user-email-error'
              )}
            />
            {fieldErrors.email ? (
              <p id="add-end-user-email-error" className="text-sm text-destructive" role="status">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          {emailEntered ? (
            <div className="grid gap-2">
              <Label htmlFor="add-password">Password</Label>
              <p id="add-end-user-password-hint" className="sr-only">
                {endUserAdminCreateLimits.passwordMin} to {endUserAdminCreateLimits.passwordMax}{' '}
                characters. Use the button beside the field to show or hide the password.
              </p>
              <div className="relative">
                <Input
                  id="add-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.password;
                      return next;
                    });
                    setServerError(null);
                  }}
                  minLength={endUserAdminCreateLimits.passwordMin}
                  maxLength={endUserAdminCreateLimits.passwordMax}
                  disabled={submitting}
                  placeholder={`${endUserAdminCreateLimits.passwordMin}–${endUserAdminCreateLimits.passwordMax} characters`}
                  className="pr-10"
                  aria-invalid={!!fieldErrors.password || undefined}
                  aria-describedby={
                    fieldErrors.password
                      ? describedByIds('add-end-user-password-error', 'add-end-user-password-hint')
                      : 'add-end-user-password-hint'
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 size-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? (
                    <IconEyeOff className="size-4" aria-hidden />
                  ) : (
                    <IconEye className="size-4" aria-hidden />
                  )}
                </Button>
              </div>
              {fieldErrors.password ? (
                <p id="add-end-user-password-error" className="text-sm text-destructive" role="status">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="add-name">Name (optional)</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.name;
                  return next;
                });
                setServerError(null);
              }}
              disabled={submitting}
              maxLength={endUserAdminCreateLimits.nameMax}
              aria-invalid={!!fieldErrors.name || undefined}
              aria-describedby={
                describedByIds(
                  serverError && 'add-end-user-server-alert',
                  fieldErrors.name && 'add-end-user-name-error'
                ) || undefined
              }
            />
            {fieldErrors.name ? (
              <p id="add-end-user-name-error" className="text-sm text-destructive" role="status">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-country">Country (optional)</Label>
            <p id="add-end-user-country-hint" className="sr-only">
              Optional ISO 3166-1 alpha-2 code, two letters. Leave blank if unknown.
            </p>
            <Input
              id="add-country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value.toUpperCase());
                setFieldErrors((prev) => {
                  const next = { ...prev };
                  delete next.country;
                  return next;
                });
                setServerError(null);
              }}
              disabled={submitting}
              maxLength={endUserAdminCreateLimits.countryLength}
              placeholder="e.g. US"
              className="font-mono text-sm uppercase"
              autoComplete="country"
              aria-invalid={!!fieldErrors.country || undefined}
              aria-describedby={describedByIds(
                serverError && 'add-end-user-server-alert',
                'add-end-user-country-hint',
                fieldErrors.country && 'add-end-user-country-error'
              )}
            />
            {fieldErrors.country ? (
              <p id="add-end-user-country-error" className="text-sm text-destructive" role="status">
                {fieldErrors.country}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-stretch sm:gap-4">
            <div className="flex h-full min-h-[44px] flex-col gap-3 rounded-lg border border-border/80 p-4">
              <Label htmlFor="add-plan" className="shrink-0">
                Plan
              </Label>
              <Select
                value={plan}
                onValueChange={(v) => setPlan(v as 'trial' | 'paid')}
                disabled={submitting}
              >
                <SelectTrigger id="add-plan" className="h-10 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-full min-h-[44px] flex-col justify-center gap-2 rounded-lg border border-border/80 p-4">
              <div className="flex min-h-11 items-center justify-between gap-4">
                <Label htmlFor="add-banned" className="cursor-pointer">
                  Banned
                </Label>
                <Switch
                  id="add-banned"
                  checked={banned}
                  onCheckedChange={setBanned}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-9">
              {submitting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" aria-hidden />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
