import type { SocialPost } from '@/domain/types';

import { withScreenState } from './screen-state';
import { db, mutate } from './store';
import { byId } from './views';

export function listSocialPosts(): Promise<SocialPost[]> {
  return withScreenState<SocialPost[]>([], () =>
    [...db().socialPosts].sort((a, b) => a.date.localeCompare(b.date)),
  );
}

/** Nothing goes out without the broker's approval: approving schedules the post. */
export async function approvePost(postId: string): Promise<void> {
  mutate((data) => {
    const post = byId(data.socialPosts, postId);
    if (post.status !== 'awaiting_approval' && post.status !== 'suggested') return;
    post.status = 'scheduled';
    post.scheduledAt = post.date;
  });
}
