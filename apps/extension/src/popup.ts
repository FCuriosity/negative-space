import { BrowserPolicySchema, defaultBrowserPolicy, featureIds, featureNames } from '../../../packages/core/src/browser';
let policy = defaultBrowserPolicy;
const enabled = document.querySelector<HTMLInputElement>('#enabled')!;
const allowed = document.querySelector<HTMLTextAreaElement>('#allowed')!;
const status = document.querySelector<HTMLElement>('#status')!;
const container = document.querySelector('#features')!;
for (const id of featureIds) {
  const label = document.createElement('label'); const input = document.createElement('input'); input.type = 'checkbox'; input.value = id; label.append(input,document.createTextNode(featureNames[id])); container.append(label);
}
chrome.storage.local.get('policy', data => {
  const parsed = BrowserPolicySchema.safeParse(data.policy); if (parsed.success) policy = parsed.data;
  enabled.checked = policy.enabled; allowed.value = policy.allowUrls.join('\n');
  container.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = policy.hide.includes(input.value as typeof featureIds[number]); });
});
document.querySelector('#save')!.addEventListener('click', async () => {
  const parsed = BrowserPolicySchema.safeParse({ ...policy, revision: policy.revision + 1, enabled: enabled.checked, hide: Array.from(container.querySelectorAll<HTMLInputElement>('input:checked')).map(i => i.value), allowUrls: allowed.value.split('\n').map(v => v.trim()).filter(Boolean) });
  if (!parsed.success) { status.textContent = '请填写完整的 http 或 https 页面地址'; return; }
  try { policy = parsed.data; await chrome.storage.local.set({ policy }); status.textContent = '已保存在本机，当前网页会自动更新'; } catch { status.textContent = '保存失败，请重试'; }
});

chrome.runtime.sendMessage({type:'liubai-status'}).then(r=>{document.querySelector('#connection')!.textContent=r.error?'未连接：请在留白中连接此浏览器':r.enabled?'已连接留白 · 网页管理中':'已连接留白 · 管理已暂停';}).catch(()=>{document.querySelector('#connection')!.textContent='连接失败，请重新加载扩展';});
