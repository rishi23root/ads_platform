'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { PlatformEditDrawer } from '@/components/platform-edit-drawer';
import type { Platform } from '@/db/schema';

interface PlatformsTableWithDrawerProps {
  platforms: Platform[];
  initialEditId?: string | null;
}

export function PlatformsTableWithDrawer({ platforms, initialEditId }: PlatformsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [selectedPlatformId, setSelectedPlatformId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const platform = platforms.find((p) => p.id === initialEditId);
      queueMicrotask(() => {
        if (platform) {
          setSelectedPlatform(platform);
          setSelectedPlatformId(null);
        } else {
          setSelectedPlatform(null);
          setSelectedPlatformId(initialEditId);
        }
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, platforms]);

  const openDrawer = (platform: Platform) => {
    setSelectedPlatform(platform);
    setSelectedPlatformId(null);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Platforms</h1>
            <p className="text-muted-foreground">Manage your advertising platforms</p>
          </div>
          <Button asChild>
            <Link href="/platforms/new">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Platform
            </Link>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No platforms found. Create your first platform.
                  </TableCell>
                </TableRow>
              ) : (
                platforms.map((platform) => (
                  <TableRow
                    key={platform.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer(platform)}
                  >
                    <TableCell className="font-medium">{platform.name}</TableCell>
                    <TableCell>
                      {platform.domain ? (
                        <Badge variant="outline" className="font-normal">
                          {platform.domain}
                        </Badge>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={platform.isActive ? 'default' : 'secondary'}>
                        {platform.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(platform.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(platform);
                          }}
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          id={platform.id}
                          name={platform.name}
                          entityType="platform"
                          apiPath={`/api/platforms/${platform.id}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PlatformEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        platform={selectedPlatform}
        platformId={selectedPlatformId ?? undefined}
      />
    </>
  );
}
