/**
 * Офлайн-черновики заявок. Хранятся ТОЛЬКО в localStorage этого устройства, отдельно для каждого пользователя,
 * без фотографий. Удаляются после отправки и при выходе из аккаунта. Черновик никогда не считается созданной заявкой.
 */
export type RequestDraft = {
  localId: string;
  savedAt: number;
  error?: string;
  data: Record<string, unknown>;
};

const key = (userId: string) => `ecolink.drafts.${userId}`;

export function loadDrafts(userId: string): RequestDraft[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? "[]") as RequestDraft[];
  } catch {
    return [];
  }
}
function save(userId: string, drafts: RequestDraft[]) {
  try {
    if (drafts.length) localStorage.setItem(key(userId), JSON.stringify(drafts));
    else localStorage.removeItem(key(userId));
    window.dispatchEvent(new Event("ecolink:drafts"));
  } catch {
    /* хранилище недоступно (приватный режим) — черновик не сохранён */
  }
}
export function addDraft(userId: string, data: Record<string, unknown>): boolean {
  const list = loadDrafts(userId);
  list.push({ localId: crypto.randomUUID(), savedAt: Date.now(), data });
  save(userId, list);
  return loadDrafts(userId).length === list.length;
}
export function removeDraft(userId: string, localId: string) {
  save(userId, loadDrafts(userId).filter((d) => d.localId !== localId));
}
export function markDraftError(userId: string, localId: string, error: string) {
  save(userId, loadDrafts(userId).map((d) => (d.localId === localId ? { ...d, error } : d)));
}
export function clearAllDrafts() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("ecolink.drafts.")).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
