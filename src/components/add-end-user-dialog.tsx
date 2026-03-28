'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { IconLoader2, IconUserPlus } from '@tabler/icons-react';
import { toast } from 'sonner';

export function AddEndUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [installationId, setInstallationId] = useState('');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<'trial' | 'paid'>('trial');
  const [status, setStatus] = useState<'active' | 'suspended' | 'churned'>('active');

  const reset = () => {
    setEmail('');
    setPassword('');
    setInstallationId('');
    setName('');
    setPlan('trial');
    setStatus('active');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    const inst = installationId.trim();
    const hasEmail = em.length > 0;
    const hasInst = inst.length > 0;

    if (!hasEmail && !hasInst) {
      toast.error('Provide email (with password) or an installation id for an anonymous user.');
      return;
    }
    if (hasEmail && password.length < 8) {
      toast.error('Password must be at least 8 characters when email is set.');
      return;
    }
    if (hasInst && inst.length < 8) {
      toast.error('Installation id must be at least 8 characters (alphanumeric, _ or -).');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim() || null,
        plan,
        status,
      };
      if (hasEmail) {
        body.email = em;
        body.password = password;
        if (hasInst) body.installationId = inst;
      } else {
        body.installationId = inst;
      }

      const res = await fetch('/api/end-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as { error?: string; user?: { id: string } };
      if (!res.ok) {
        toast.error(j.error ?? 'Could not create user');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add extension user</DialogTitle>
          <DialogDescription>
            Create a registered user (email + password) or an anonymous trial user (installation id from
            the extension). See <code className="text-xs">POST /api/extension/auth/provision</code> for
            the client flow.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="add-email">Email (optional if anonymous)</Label>
            <Input
              id="add-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-password">Password (required with email)</Label>
            <Input
              id="add-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              disabled={submitting}
              placeholder="8+ characters when email is set"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-installation-id">Installation id (anonymous user)</Label>
            <Input
              id="add-installation-id"
              value={installationId}
              onChange={(e) => setInstallationId(e.target.value)}
              disabled={submitting}
              placeholder="From extension storage, 8+ chars, a-z A-Z 0-9 _ -"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-name">Name (optional)</Label>
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Plan</Label>
              <Select
                value={plan}
                onValueChange={(v) => setPlan(v as 'trial' | 'paid')}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as 'active' | 'suspended' | 'churned')}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
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
