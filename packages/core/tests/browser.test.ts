import { describe, expect, it } from 'vitest';
import { defaultBrowserPolicy, isAllowedPage, resolvePage } from '../src/browser';
describe('精细网页策略', () => {
  const policy={ ...defaultBrowserPolicy,enabled:true };
  it('默认不启用屏蔽', () => { expect(resolvePage('https://youtube.com/shorts/123',defaultBrowserPolicy).blocked).toBe(false); });
  it('短视频路由拦截，普通视频保留', () => { expect(resolvePage('https://www.youtube.com/shorts/123',policy).blocked).toBe(true); expect(resolvePage('https://www.youtube.com/watch?v=course',policy).blocked).toBe(false); });
  it('B站只隐藏首页推荐，课程视频不受首页规则影响', () => { expect(resolvePage('https://www.bilibili.com/',policy).selectors.length).toBeGreaterThan(0); expect(resolvePage('https://www.bilibili.com/video/BV123',policy).selectors).toEqual([]); });
  it('指定视频可穿过站点屏蔽', () => { expect(resolvePage('https://www.bilibili.com/video/BV123',{ ...policy,blockHosts:['bilibili.com'],allowUrls:['https://www.bilibili.com/video/BV123'] }).blocked).toBe(false); });
  it('允许地址不会放行同前缀视频、伪造域名或其他视频参数', () => { const urls=['https://www.bilibili.com/video/BV123','https://www.youtube.com/watch?v=course']; expect(isAllowedPage('https://www.bilibili.com/video/BV1234',urls)).toBe(false); expect(isAllowedPage('https://www.bilibili.com.evil.test/video/BV123',urls)).toBe(false); expect(isAllowedPage('https://www.youtube.com/watch?v=other',urls)).toBe(false); });
});
