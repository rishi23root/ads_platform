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
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { AdEditDrawer } from '@/components/ad-edit-drawer';
import type { Ad } from '@/db/schema';

interface AdsTableWithDrawerProps {
  ads: Ad[];
  initialEditId?: string | null;
}

export function AdsTableWithDrawer({ ads, initialEditId }: AdsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const ad = ads.find((a) => a.id === initialEditId);
      queueMicrotask(() => {
        if (ad) {
          setSelectedAd(ad);
          setSelectedAdId(null);
        } else {
          setSelectedAd(null);
          setSelectedAdId(initialEditId);
        }
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, ads]);

  const openDrawer = (ad: Ad) => {
    setSelectedAd(ad);
    setSelectedAdId(null);
    setDrawerOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Ads</h1>
            <p className="text-muted-foreground">Manage your ad content library</p>
          </div>
          <Button asChild>
            <Link href="/ads/new">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Ad
            </Link>
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Target URL</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No ads found. Create your first ad.
                  </TableCell>
                </TableRow>
              ) : (
                ads.map((ad) => (
                  <TableRow
                    key={ad.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDrawer(ad)}
                  >
                    <TableCell className="font-medium">{ad.name}</TableCell>
                    <TableCell className="max-w-xs truncate" onClick={(e) => e.stopPropagation()}>
                      {ad.targetUrl ? (
                        <a
                          href={ad.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {ad.targetUrl}
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(ad.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(ad);
                          }}
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          id={ad.id}
                          name={ad.name}
                          entityType="ad"
                          apiPath={`/api/ads/${ad.id}`}
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

      <AdEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        ad={selectedAd}
        adId={selectedAdId ?? undefined}
      />
    </>
  );
}
