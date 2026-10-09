import { z } from 'zod';
import { DEFAULT_REASON_TAGS, normalizeReasonTags } from './reason-tags';
import { RuleSchema, WindowSchema, modes, FocusSpaceSchema } from './model';
import type { AppState } from './model';
const id = z.string().min(1);
const timestamp = z.number().finite().nonnegative();
export const StateSchema = z.object({
  version: z.literal(1), focusBackgrounds:z.array(z.object({id,name:z.string().max(120),dataUrl:z.string().max(600000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)})).max(10).default([]), focusSpaces:z.array(FocusSpaceSchema).default([]), scheduleRuns:z.array(z.object({id,scheduleId:id,at:timestamp,outcome:z.enum(['started','busy','locked','invalid'])})).default([]), rules: z.array(RuleSchema),
  targets: z.array(z.object({ id, name: id, kind: z.enum(['app','website']), color: z.string(), initials: z.string(), identities: z.array(id), protected: z.boolean().optional() })),
  lists: z.array(z.object({ id, name: id, targetIds: z.array(id) })),
  schedules: z.array(z.object({ id, name: id, listIds: z.array(id), windows: z.array(WindowSchema), mode: z.enum(modes), enabled: z.boolean(),focusSpace:FocusSpaceSchema.optional() }).refine(s=>!s.focusSpace||(s.windows.length===1&&s.windows[0].days.length===1&&((s.windows[0].end-s.windows[0].start+1440)%1440)===s.focusSpace.durationMinutes&&s.mode===s.focusSpace.mode&&JSON.stringify(s.listIds)===JSON.stringify(s.focusSpace.listIds)), '场景时间表的时长或规则不一致')),
  sessions: z.array(z.object({timerMode:z.enum(['countdown','countup']).optional(),backgroundId:z.string().optional(), spaceName:z.string().optional(),spaceTone:z.enum(['mint','blue','rose','lavender']).optional(),scheduleId:id.optional(), id, startedAt: timestamp, endsAt: timestamp, durationMinutes: z.number().nonnegative(), listIds: z.array(id), mode: z.enum(modes), projectId: id, status: z.enum(['active','completed','cancelled']), creditedAt: timestamp.optional(), endedAt: timestamp.optional() })),
  usage: z.array(z.object({ id, targetId: id, projectId: id, start: timestamp, end: timestamp }).refine(i => i.end >= i.start)),
  opens: z.array(z.object({ id, targetId: id, at: timestamp, kind: z.enum(['launch','navigation','activation']), outsideAllowedWindow:z.boolean().optional(), quotaExceeded:z.array(z.enum(['daily-time','daily-opens'])).optional(), intention:z.enum(['pending','intentional','accidental']).optional(), processKey:z.string().optional(), reasonStatus: z.enum(['pending','recorded','skipped']).optional() })),
  reflections: z.array(z.object({ sessionId:id, text:z.string().trim().min(1).max(2000), createdAt:timestamp, updatedAt:timestamp })).default([]),
  openReasons: z.array(z.object({ id, targetId:id, at:timestamp, text:z.string().trim().max(300), source:z.enum(['open','override']), eventId:id.optional(), restriction:z.enum(['outside-window','daily-time','daily-opens','break','focus']).optional(), grantedMinutes:z.number().positive().optional() })).default([]),
  rewards: z.array(z.object({ id, sessionIds: z.array(id), targetId: id, day: id, minutes: z.number().nonnegative() })),
  tasks: z.array(z.object({ id, title: id, projectId: id, done: z.boolean() })),
  habits: z.array(z.object({ id, title: id, completedDays: z.array(id) })),
  projects: z.array(z.object({ id, name: id, color: z.string() })),
  audit: z.array(z.object({ id, at: timestamp, type: z.enum(['focus-started','focus-completed','focus-cancelled','rule-updated']), message: z.string() })),
  settings: z.object({ mirrorLakeCharacterGender:z.enum(['male','female']).default('male'), timezone: z.string().refine(tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }), idleSeconds: z.number().int().min(15).max(600), rewardEveryMinutes: z.number().int().positive(), rewardMinutes: z.number().int().positive(), rewardTargetId: id, retentionDays: z.number().int().min(7).max(365), reasonTags: z.array(z.string().trim().min(1).max(16).refine(tag => !/[；\n\r]/.test(tag))).max(20).default(DEFAULT_REASON_TAGS).transform(normalizeReasonTags), focusTimerMode:z.enum(['countdown','countup']).optional(),focusBackgroundId:z.string().optional(),focusTone:z.enum(['mint','blue','rose','lavender']).optional(), focusDurationMinutes: z.number().int().min(1).max(720).default(25) }),
});
export function parseState(value: unknown): AppState { return StateSchema.parse(value); }
export function pruneHistory(state: AppState, now: number): AppState {
  const cutoff = now - state.settings.retentionDays * 86_400_000;
  const retainedSessions = state.sessions.filter(s => s.status === 'active' || (s.endedAt ?? s.endsAt) >= cutoff);
  return { ...state, scheduleRuns:state.scheduleRuns.filter(r=>r.at>=cutoff), reflections:state.reflections.filter(r => retainedSessions.some(s => s.id===r.sessionId)), openReasons:state.openReasons.filter(r => r.at>=cutoff), usage: state.usage.filter(i => i.end >= cutoff), opens: state.opens.filter(i => i.at >= cutoff), audit: state.audit.filter(i => i.at >= cutoff), sessions: retainedSessions, rewards: state.rewards.filter(r => state.sessions.some(s => r.sessionIds.includes(s.id) && s.endsAt >= cutoff)) };
}
