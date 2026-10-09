import { z } from 'zod';
export const featureIds = ['bili-home', 'bili-dynamic', 'youtube-shorts', 'weibo-hot', 'zhihu-feed', 'douyin', 'xiaohongshu'] as const;
export const BrowserPolicySchema = z.object({ version: z.literal(1), revision: z.number().int().nonnegative(), enabled: z.boolean(), hide: z.array(z.enum(featureIds)), blockHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/i)), allowUrls: z.array(z.string().url().refine(v => /^https?:/.test(v))) });
export type WebPolicy = z.infer<typeof BrowserPolicySchema>;
export const defaultBrowserPolicy: WebPolicy = { version: 1, revision: 0, enabled: false, hide: ['bili-home','youtube-shorts','weibo-hot','zhihu-feed'], blockHosts: [], allowUrls: [] };
export const featureNames: Record<typeof featureIds[number], string> = { 'bili-home': 'B 站首页推荐', 'bili-dynamic': 'B 站动态', 'youtube-shorts': 'YouTube Shorts', 'weibo-hot': '微博热搜', 'zhihu-feed': '知乎推荐流', douyin: '抖音网页版', xiaohongshu: '小红书网页版' };
export function hostMatches(host: string, domain: string) { return host === domain || host.endsWith(`.${domain}`); }
/** URL allowlists use origin + path boundaries, never substring matching. */
export function isAllowedPage(url: string, allowUrls: string[]) {
  const current = new URL(url);
  return allowUrls.some(raw => {
    try { const allowed = new URL(raw); const path = allowed.pathname.replace(/\/$/, ''); return current.origin === allowed.origin && (current.pathname === path || current.pathname.startsWith(`${path}/`)) && [...allowed.searchParams].every(([k,v]) => current.searchParams.get(k) === v); } catch { return false; }
  });
}
export function resolvePage(url: string, policy: WebPolicy): { blocked: boolean; selectors: string[] } {
  if (!policy.enabled || isAllowedPage(url, policy.allowUrls)) return { blocked: false, selectors: [] };
  const { hostname: host, pathname: path } = new URL(url);
  const has = (id: typeof featureIds[number]) => policy.hide.includes(id);
  const blocked = policy.blockHosts.some(h => hostMatches(host,h)) || (has('douyin') && hostMatches(host,'douyin.com')) || (has('xiaohongshu') && hostMatches(host,'xiaohongshu.com')) || (has('youtube-shorts') && hostMatches(host,'youtube.com') && /^\/shorts(?:\/|$)/.test(path)) || (has('bili-dynamic') && host === 't.bilibili.com');
  const selectors: string[] = [];
  if (hostMatches(host,'bilibili.com')) {
    if (has('bili-home') && host === 'www.bilibili.com' && path === '/') selectors.push('.recommended-container', '.bili-feed4-layout', '.feed2');
    if (has('bili-dynamic')) selectors.push('a[href="//t.bilibili.com/"]', 'a[href="https://t.bilibili.com/"]');
  }
  if (has('youtube-shorts') && hostMatches(host,'youtube.com')) selectors.push('ytd-reel-shelf-renderer', 'ytd-rich-shelf-renderer[is-shorts]', 'ytd-rich-item-renderer:has(a[href^="/shorts/"])', 'ytd-guide-entry-renderer:has(a[href^="/shorts"])');
  if (has('weibo-hot') && hostMatches(host,'weibo.com')) selectors.push('[class*="HotSearch"]', 'a[href*="/hot/search"]');
  if (has('zhihu-feed') && host === 'www.zhihu.com' && path === '/') selectors.push('.Topstory-recommend', '[aria-controls="Topstory-recommend"]');
  return { blocked, selectors };
}
