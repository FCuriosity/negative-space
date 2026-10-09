import { z } from 'zod';

export const modes = ['gentle', 'friction', 'strict', 'managed'] as const;
export type Mode = typeof modes[number];
const minute = z.number().int().min(0).max(1439);
export const WindowSchema = z.object({ days: z.array(z.number().int().min(0).max(6)).min(1), start: minute, end: minute }).refine(w => w.start !== w.end, '开始与结束时间不能相同');
export const RuleSchema = z.object({
  id: z.string().min(1), name: z.string().trim().min(1).max(40), targetId: z.string().min(1), listId: z.string(), enabled: z.boolean(), mode: z.enum(modes),
  dailyMinutes: z.number().int().min(0).max(1440).nullable(), dailyOpens: z.number().int().min(0).max(1000).nullable(),
  weekdays: z.record(z.object({ dailyMinutes: z.number().int().min(0).max(1440).nullable(), dailyOpens: z.number().int().min(0).max(1000).nullable() })).default({}),
  allowedWindows: z.array(WindowSchema).default([]),
  breakEveryMinutes: z.number().int().min(1).max(240).nullable(), breakMinutes: z.number().int().min(1).max(60).default(5),
  graceSeconds: z.number().int().min(30).max(600).default(60), forceQuitOptIn: z.boolean().default(false),
});
export type Rule = z.infer<typeof RuleSchema>;
export type TimeWindow = z.infer<typeof WindowSchema>;
export const FocusSpaceSchema=z.object({id:z.string().min(1),name:z.string().trim().min(1,'请填写场景名称').max(30),durationMinutes:z.number().int().min(1).max(720),projectId:z.string().min(1),listIds:z.array(z.string().min(1)),mode:z.enum(['gentle','friction','strict']),tone:z.enum(['mint','blue','rose','lavender']),timerMode:z.enum(['countdown','countup']).optional(),backgroundId:z.string().optional()}).refine(s=>s.timerMode!=='countup'||s.mode!=='strict','正向计时由你手动完成，请选择温和或摩擦模式');
export type FocusSpace=z.infer<typeof FocusSpaceSchema>;
export interface ScheduleRun {id:string;scheduleId:string;at:number;outcome:'started'|'busy'|'locked'|'invalid'}
export interface Target { id: string; name: string; kind: 'app' | 'website'; color: string; initials: string; identities: string[]; protected?: boolean }
export interface Blocklist { id: string; name: string; targetIds: string[] }
export interface Schedule { focusSpace?:FocusSpace; id: string; name: string; listIds: string[]; windows: TimeWindow[]; mode: Mode; enabled: boolean }
export interface FocusSession { timerMode?:'countdown'|'countup';backgroundId?:string; spaceName?:string;spaceTone?:FocusSpace['tone'];scheduleId?:string; id: string; startedAt: number; endsAt: number; durationMinutes: number; listIds: string[]; mode: Mode; projectId: string; status: 'active' | 'completed' | 'cancelled'; creditedAt?: number; endedAt?: number }
export interface UsageInterval { id: string; targetId: string; projectId: string; start: number; end: number }
export interface OpenEvent { id: string; targetId: string; at: number; kind: 'launch' | 'navigation' | 'activation'; quotaExceeded?: ('daily-time' | 'daily-opens')[]; outsideAllowedWindow?: boolean; intention?: 'pending' | 'intentional' | 'accidental'; processKey?: string; reasonStatus?: 'pending' | 'recorded' | 'skipped' }
export interface FocusReflection { sessionId: string; text: string; createdAt: number; updatedAt: number }
export interface AppOpenReason { id: string; targetId: string; at: number; text: string; source: 'open' | 'override'; eventId?: string; restriction?: Reason; grantedMinutes?: number }
export interface Reward { id: string; sessionIds: string[]; targetId: string; day: string; minutes: number }
export interface Task { id: string; title: string; projectId: string; done: boolean }
export interface Habit { id: string; title: string; completedDays: string[] }
export interface Project { id: string; name: string; color: string }
export interface AuditEvent { id: string; at: number; type: 'focus-started' | 'focus-completed' | 'focus-cancelled' | 'rule-updated'; message: string }
export interface AppState {
  version: 1; focusBackgrounds:{id:string;name:string;dataUrl:string}[]; focusSpaces:FocusSpace[]; scheduleRuns:ScheduleRun[]; rules: Rule[]; targets: Target[]; lists: Blocklist[]; schedules: Schedule[]; sessions: FocusSession[];
  usage: UsageInterval[]; opens: OpenEvent[]; reflections: FocusReflection[]; openReasons: AppOpenReason[]; rewards: Reward[]; tasks: Task[]; habits: Habit[]; projects: Project[]; audit: AuditEvent[];
  settings: { mirrorLakeCharacterGender?:'male'|'female'; timezone: string; idleSeconds: number; rewardEveryMinutes: number; rewardMinutes: number; rewardTargetId: string; retentionDays: number; reasonTags: string[]; focusDurationMinutes: number;focusTimerMode?:'countdown'|'countup';focusBackgroundId?:string;focusTone?:FocusSpace['tone'] };
}
export interface EvaluationContext {
  now: number; timezone: string; usedSeconds: number; opens: number; continuousSeconds: number;
  intent: 'open' | 'continue';
  breakUntil?: number; bonusMinutes: number; sessionMode?: Mode;
}
export type Reason = 'outside-window' | 'daily-time' | 'daily-opens' | 'break' | 'focus';
export interface Decision { action: 'allow' | 'warn' | 'challenge' | 'block' | 'approval'; reason?: Reason; mode?: Mode; remainingSeconds?: number; until?: number }
export const modeLabels: Record<Mode, string> = { gentle: '温和提醒', friction: '增加摩擦', strict: '严格自律', managed: '托管审批' };
export const reasonLabels: Record<Reason, string> = { 'outside-window': '当前不在允许时段', 'daily-time': '今日使用时间已用完', 'daily-opens': '今日打开次数已用完', break: '连续使用后需要休息', focus: '正在专注时段中' };
