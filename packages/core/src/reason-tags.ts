export const RECOVERY_REASON_TAG = '无意识，但改邪归正';
export const DEFAULT_REASON_TAGS = [RECOVERY_REASON_TAG, '摸鱼', '回复消息', '查资料', '看课程', '休息一下'];
export const MAX_REASON_TAGS = 20;
export const MAX_REASON_TAG_LENGTH = 16;
export function normalizeReasonTags(tags: string[]): string[] {
  const result = [...new Set(tags.map(tag => tag.trim()).filter(Boolean))];
  if (result.length > MAX_REASON_TAGS) throw new Error('最多保存 20 个快捷标签');
  if (result.some(tag => tag.length > MAX_REASON_TAG_LENGTH || /[；\n\r]/.test(tag))) throw new Error('标签请使用 1–16 个字，不包含分号或换行');
  return result;
}
export function appendReasonTag(text: string, tag: string): string {
  const value = normalizeReasonTags([tag])[0];
  if (!value) return text;
  if (text.split(/[；\n]/).some(part => part.trim() === value)) return text;
  const next = text.trim() ? `${text.trim()}；${value}` : value;
  if (next.length > 300) throw new Error('理由已接近 300 字，请先精简后再添加标签');
  return next;
}

export const hasRecoveryReason=(text:string)=>text.split(/[；\n]/).some(part=>part.trim()===RECOVERY_REASON_TAG);
