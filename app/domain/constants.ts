import type { FunctionTypeId, PersonTypeId, Role, Screen } from "./types";

declare const __APP_RELEASE__: string;

export const PERSON_TYPES = { manager: 1, teacher: 2, intern: 3, reception: 4 } as const;
export const FUNCTION_TYPES = { conductor: 1, follower: 2, both: 3 } as const;
export const CALENDAR_MODES = { simple: 1, colors: 2 } as const;
export const ASSIGNMENT_TYPES = { lead: 1, sound: 2, reception: 3 } as const;
export const CLASS_TYPES = [{ id: 3 as const, label: "Preta", code: "black" }, { id: 2 as const, label: "Azul", code: "blue" }, { id: 1 as const, label: "Branca", code: "white" }];
export const CAPABILITIES = { coverReception: 1, leadBlack: 2 } as const;
export const ADMIN_ACCESS_ROLE_ID = 5;
export const RECEPTION_PRIORITY_PERSON_IDS = [1, 2, 3, 4];
export const WEB_INACTIVITY_MS = 10 * 60 * 1000;
export const MOBILE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const APP_RELEASE = __APP_RELEASE__;
export const SESSION_ACTIVITY_KEY = "gestao-pd-session-activity";
export const SESSION_LOGIN_KEY = "gestao-pd-session-login";
export const SESSION_RELEASE_KEY = "gestao-pd-session-release";
export const CALENDAR_TEAM_RELEASE_AT = new Date("2026-09-01T00:00:00-03:00").getTime();

export const personTypeOptions: { id: PersonTypeId; label: string }[] = [{ id: 1, label: "Gestor" }, { id: 2, label: "Professor" }, { id: 3, label: "Estagiário" }, { id: 4, label: "Recepção" }];
export const functionTypeOptions: { id: FunctionTypeId; label: string }[] = [{ id: 1, label: "Condutor" }, { id: 2, label: "Conduzido" }, { id: 3, label: "Duas funções" }];
export const labels: Record<Screen, string> = { visao: "Visão geral", calendario: "Calendário", faltas: "Faltas", solo: "Aulas solo", substituicoes: "Substituições", relatorios: "Relatórios", parametros: "Parâmetros" };
export const menuIcons: Record<Screen, string> = { visao: "▦", calendario: "□", faltas: "✕", solo: "", substituicoes: "⇄", relatorios: "▤", parametros: "⚙" };
export const menus: Record<Role, Screen[]> = { gestor: ["visao", "calendario", "faltas", "solo", "substituicoes", "relatorios", "parametros"], professor: ["visao", "calendario", "faltas", "solo"], recepcao: ["visao", "calendario", "faltas"] };
export const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
