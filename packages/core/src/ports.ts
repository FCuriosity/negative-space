import type { AppState } from './model';
import type { Sample } from './activity';
import type { ProcessIdentity } from './enforcement';
export interface StateRepository { load(): Promise<AppState | null>; save(state: AppState): Promise<void> }
export interface PlatformAdapter {
  capabilities(): Promise<{ platform: string; foreground: boolean; idle: boolean; safeQuit: boolean; forceQuit: boolean; background: boolean }>;
  sample(): Promise<Sample>;
  requestQuit(process: ProcessIdentity): Promise<'requested' | 'denied'>;
  forceQuit(process: ProcessIdentity, confirmationToken: string): Promise<void>;
}
export interface ApprovalPort { request(input: { ruleId: string; deviceId: string; expiresAt: number; nonce: string }): Promise<{ status: 'pending'; requestId: string }> }
export interface BrowserPolicy { version: 1; revision: number; enabled: boolean; hide: string[]; blockHosts: string[]; allowUrls: string[] }
export interface BrowserBridge { publish(policy: BrowserPolicy): Promise<void> }
