import type { AccessRoleTypeId, OperationExceptionRow, PersonRow, Profile, Role, ScheduleRow } from "./types";
import { ADMIN_ACCESS_ROLE_ID, PERSON_TYPES, SESSION_ACTIVITY_KEY, SESSION_LOGIN_KEY, SESSION_RELEASE_KEY } from "./constants";

export const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
export const isPersonType = (person: Pick<PersonRow, "person_type_id"> | Pick<Profile, "person_type_id">, type: keyof typeof PERSON_TYPES) => person.person_type_id === PERSON_TYPES[type];
export const toUiRole = (value: AccessRoleTypeId): Role => value === PERSON_TYPES.manager || value === ADMIN_ACCESS_ROLE_ID ? "gestor" : value === PERSON_TYPES.teacher ? "professor" : "recepcao";
export const localIsoDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const scheduleAppliesOn = (schedule: ScheduleRow, date: string) => schedule.starts_on <= date && (!schedule.ends_on || schedule.ends_on >= date);
export const unitIsOpenOn = (date: string, openingDays: boolean[], exceptions: OperationExceptionRow[]) => exceptions.find(item => item.date === date)?.open ?? openingDays[new Date(`${date}T12:00:00`).getDay()];
export const isHolidayOn = (date: string, exceptions: OperationExceptionRow[]) => exceptions.some(item => item.date === date && !item.open);
export const personLevelLabel = (person?: PersonRow) => !person ? "—" : isPersonType(person, "intern") ? "Estagiário(a)" : person.level ? `Nível ${person.level}` : "—";
export const displayName = (person?: { name: string; nickname?: string | null } | null) => person?.nickname?.trim() || person?.name || "—";
export const isMobileSession = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || Boolean((navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile);
export const clearSessionMetadata = () => { window.localStorage.removeItem(SESSION_ACTIVITY_KEY); window.localStorage.removeItem(SESSION_LOGIN_KEY); window.localStorage.removeItem(SESSION_RELEASE_KEY); };
export const saveImageBlob = async (blob: Blob, fileName: string, title: string) => {
  const file = new File([blob], fileName, { type: "image/png" });
  const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isAppleMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) throw error; }
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
};
