export interface ProcessIdentity { pid: number; startedAt: number; executable: string; protected: boolean }
export interface QuitPlan { process: ProcessIdentity; stage: 'grace' | 'request-quit' | 'needs-confirmation' | 'done'; deadline: number; forceQuitOptIn: boolean }
export function beginQuit(process: ProcessIdentity, now: number, graceSeconds: number, forceQuitOptIn: boolean): QuitPlan {
  if (process.protected) throw new Error('系统关键进程不可限制');
  return { process, stage: 'grace', deadline: now + Math.max(30, graceSeconds) * 1000, forceQuitOptIn };
}
export function advanceQuit(plan: QuitPlan, now: number, stillRunning: boolean): QuitPlan {
  if (!stillRunning) return { ...plan, stage: 'done' };
  if (now < plan.deadline) return plan;
  if (plan.stage === 'grace') return { ...plan, stage: 'request-quit', deadline: now + 30_000 };
  if (plan.stage === 'request-quit') return { ...plan, stage: 'needs-confirmation' };
  return plan;
}
export function mayForceQuit(plan: QuitPlan, current: ProcessIdentity, confirmedNow: boolean) {
  return plan.stage === 'needs-confirmation' && plan.forceQuitOptIn && confirmedNow && !current.protected && current.pid === plan.process.pid && current.startedAt === plan.process.startedAt && current.executable === plan.process.executable;
}
