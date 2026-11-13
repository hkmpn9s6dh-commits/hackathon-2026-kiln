import { reddit } from '@devvit/web/server';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function kilnTitle(now: Date): string {
  const month = MONTHS[now.getUTCMonth()] ?? 'Jan';
  return `KILN · ${month} ${now.getUTCDate()} — a fresh kiln is lit`;
}

export async function createPost(title?: string) {
  return await reddit.submitCustomPost({
    title: title ?? kilnTitle(new Date()),
    entry: 'default',
    styles: {
      backgroundColor: '#0B0908FF',
      backgroundColorDark: '#0B0908FF',
    },
  });
}
