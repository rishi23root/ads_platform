import { redirect } from 'next/navigation';

/** @deprecated Prefer `/delivery/live` — kept for bookmarks and old links. */
export default function DeliveryLiveLegacyRedirect() {
  redirect('/delivery/live');
}
