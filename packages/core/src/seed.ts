import { DEFAULT_REASON_TAGS } from './reason-tags';
import type { AppState, Rule } from './model';
export function newRule(id: string, name: string, targetId: string): Rule {
  return { id, name, targetId, listId: 'entertainment', enabled: true, mode: 'friction', dailyMinutes: 30, dailyOpens: null, weekdays: {}, allowedWindows: [], breakEveryMinutes: null, breakMinutes: 5, graceSeconds: 60, forceQuitOptIn: false };
}
export function initialState(): AppState {
  return {
    version: 1, focusBackgrounds:[], focusSpaces:[], scheduleRuns:[],
    targets: [
      { id: 'bilibili', name: '哔哩哔哩', kind: 'website', color: '#e981a4', initials: '哔', identities: ['bilibili.com'] },
      { id: 'wechat', name: '微信', kind: 'app', color: '#65a66a', initials: '微', identities: ['com.tencent.xinWeChat', 'WeChat.exe', 'Weixin.exe'] },
      { id: 'games', name: 'Steam', kind: 'app', color: '#657891', initials: 'S', identities: ['com.valvesoftware.steam', 'steam.exe'] },
      { id: 'youtube', name: 'YouTube', kind: 'website', color: '#d86b63', initials: '▶', identities: ['youtube.com'] },
      { id: 'douyin', name: '抖音网页版', kind: 'website', color: '#4d4c58', initials: '抖', identities: ['douyin.com'] },
      { id: 'xiaohongshu', name: '小红书网页版', kind: 'website', color: '#da716c', initials: '红', identities: ['xiaohongshu.com'] },
    ],
    rules: [
      { ...newRule('bili-daily', '给好奇心留半小时', 'bilibili'), breakEveryMinutes: 20 },
      { ...newRule('wechat-opens', '减少无意识打开', 'wechat'), dailyMinutes: null, dailyOpens: 10, mode: 'gentle' },
      { ...newRule('game-evening', '把游戏留给晚上', 'games'), dailyMinutes: 60, mode: 'strict', allowedWindows: [{ days: [0,1,2,3,4,5,6], start: 1200, end: 0 }] },
    ],
    lists: [{ id: 'entertainment', name: '娱乐与信息流', targetIds: ['bilibili', 'youtube', 'douyin', 'xiaohongshu', 'games'] }, { id: 'social', name: '社交通知', targetIds: ['wechat'] }],
    schedules: [], sessions: [], usage: [], opens: [], reflections: [], openReasons: [], rewards: [], audit: [], tasks: [], habits: [],
    projects: [{ id: 'personal', name: '个人成长', color: '#567564' }, { id: 'work', name: '工作', color: '#b69a72' }, { id: 'study', name: '学习', color: '#7d84b4' }],
    settings: { mirrorLakeCharacterGender:'male', timezone: 'Asia/Shanghai', idleSeconds: 60, rewardEveryMinutes: 60, rewardMinutes: 15, rewardTargetId: 'bilibili', retentionDays: 90, reasonTags: [...DEFAULT_REASON_TAGS], focusDurationMinutes: 25 },
  };
}
