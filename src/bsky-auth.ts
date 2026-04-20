import { BskyAgent } from '@atproto/api';

// Create a singleton agent
export const agent = new BskyAgent({
  service: 'https://bsky.social',
});

export async function loginToBluesky(handle: string, pass: string) {
  try {
    await agent.login({
      identifier: handle,
      password: pass,
    });
    return true;
  } catch (e) {
    console.error('Login failed:', e);
    return false;
  }
}

