"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "./supabase";

type Screen = "visao" | "calendario" | "faltas" | "solo" | "substituicoes" | "relatorios" | "parametros";
type Role = "gestor" | "professor" | "recepcao";
type PersonTypeId = 1 | 2 | 3 | 4;
type AccessRoleTypeId = 1 | 2 | 3 | 4;
type FunctionTypeId = 1 | 2 | 3;
type Profile = { id: number; username: string; name: string; nickname: string | null; person_type_id: PersonTypeId; access_role_type_id: AccessRoleTypeId; function_type_id: FunctionTypeId | null; level: number | null; must_change_password: boolean };
type ClassRow = { id: number; name: string; allowed_for_half_day: boolean };
type SoloRow = { id: number; date: string; status: string; teacher_id: number; classes: { name: string } | null; people: { name: string; nickname: string | null } | null };
type AbsenceRow = { id: number; date: string; person_id: number; created_by: number; created_at: string };
type SubstitutionRow = { id: number; date: string; substitute_person_id: number | null; external_name: string | null; external_level: number | null; daily_type: string; created_by: number; people?: { name: string; nickname: string | null } | null };
type ManagerDayRow = { id: number; date: string; manager_id: number; created_by: number };
type DailyOverrideRow = { id: number; date: string; person_id: number; daily_type: string; created_by: number };
type OperationExceptionRow = { id: number; date: string; open: boolean; label: string | null };
type MonthlyPeriodRow = { id: number; year: number; month: number; status: "open" | "closed"; closes_at: string; closed_at: string | null; closed_by: number | null; reopened_at: string | null; reopened_by: number | null };
type MonthlyPeriodEventRow = { id: number; period_id: number; action: "closed" | "reopened"; actor_id: number | null; automated: boolean; created_at: string };
type PersonRow = { id: number; name: string; nickname: string | null; username: string; person_type_id: PersonTypeId; access_role_type_id: AccessRoleTypeId; function_type_id: FunctionTypeId | null; level: number | null; active: boolean; auth_user_id: string | null };
type ScheduleRow = { id: number; person_id: number; weekday: number; daily_type: "half" | "full" | "manager_support"; starts_on: string; ends_on: string | null };
type UnitRow = { id: number; name: string; minimum_teachers: number; calendar_mode_type_id: 1 | 2; active: boolean };
type CalendarPeriodRow = { id: number; year: number; month: number; status: "draft" | "published"; published_at: string | null };
type CalendarAssignmentRow = { id: number; date: string; assignment_type_id: 1 | 2 | 3; class_type_id: 1 | 2 | 3 | null; person_id: number; manually_assigned: boolean };
type CalendarNoteRow = { id: number; date: string; note: string };
type CapabilityRow = { person_id: number; capability_type_id: 1 | 2 };
const PERSON_TYPES = { manager: 1, teacher: 2, intern: 3, reception: 4 } as const;
const FUNCTION_TYPES = { conductor: 1, follower: 2, both: 3 } as const;
const CALENDAR_MODES = { simple: 1, colors: 2 } as const;
const ASSIGNMENT_TYPES = { lead: 1, sound: 2, reception: 3 } as const;
const CLASS_TYPES = [{ id: 1 as const, label: "Branca", code: "white" }, { id: 2 as const, label: "Azul", code: "blue" }, { id: 3 as const, label: "Preta", code: "black" }];
const CAPABILITIES = { coverReception: 1, leadBlack: 2 } as const;
const RECEPTION_PRIORITY_PERSON_IDS = [1, 2, 3, 4];
const CALENDAR_TEAM_RELEASE_AT = new Date("2026-09-01T00:00:00-03:00").getTime();
const personTypeOptions: { id: PersonTypeId; label: string }[] = [{ id: 1, label: "Gestor" }, { id: 2, label: "Professor" }, { id: 3, label: "Estagiário" }, { id: 4, label: "Recepção" }];
const functionTypeOptions: { id: FunctionTypeId; label: string }[] = [{ id: 1, label: "Condutor" }, { id: 2, label: "Conduzido" }, { id: 3, label: "Duas funções" }];
const isPersonType = (person: Pick<PersonRow, "person_type_id"> | Pick<Profile, "person_type_id">, type: keyof typeof PERSON_TYPES) => person.person_type_id === PERSON_TYPES[type];
const toUiRole = (value: AccessRoleTypeId): Role => value === PERSON_TYPES.manager ? "gestor" : value === PERSON_TYPES.teacher ? "professor" : "recepcao";

const labels: Record<Screen, string> = {
  visao: "Visão geral",
  calendario: "Calendário",
  faltas: "Faltas",
  solo: "Aulas solo",
  substituicoes: "Substituições",
  relatorios: "Relatórios",
  parametros: "Parâmetros",
};
const menuIcons: Record<Screen, string> = { visao: "▦", calendario: "□", faltas: "✕", solo: "", substituicoes: "⇄", relatorios: "▤", parametros: "⚙" };

const menus: Record<Role, Screen[]> = {
  gestor: ["visao", "calendario", "faltas", "solo", "substituicoes", "relatorios", "parametros"],
  professor: ["visao", "calendario", "faltas", "solo"],
  recepcao: ["visao", "calendario", "faltas"],
};

const week = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const firstBusinessDayOfCurrentMonth = () => {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), 1);
  while (day.getDay() === 0 || day.getDay() === 6) day.setDate(day.getDate() + 1);
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
};
const scheduleAppliesOn = (schedule: ScheduleRow, date: string) => schedule.starts_on.slice(0,7) <= date.slice(0,7) && (!schedule.ends_on || schedule.ends_on >= date);
const unitIsOpenOn = (date: string, openingDays: boolean[], exceptions: OperationExceptionRow[]) => exceptions.find(item => item.date === date)?.open ?? openingDays[new Date(`${date}T12:00:00`).getDay()];
const personLevelLabel = (person?: PersonRow) => !person ? "—" : isPersonType(person, "intern") ? "Estagiário(a)" : person.level ? `Nível ${person.level}` : "—";
const displayName = (person?: { name: string; nickname?: string | null } | null) => person?.nickname?.trim() || person?.name || "—";

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [role, setRole] = useState<Role>("gestor");
  const [screen, setScreen] = useState<Screen>("visao");
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [managerMoreOpen, setManagerMoreOpen] = useState(false);
  const [openingDays, setOpeningDays] = useState([false, true, true, true, true, true, false]);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [soloRows, setSoloRows] = useState<SoloRow[]>([]);
  const [substitutionRows, setSubstitutionRows] = useState<SubstitutionRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [operationExceptions, setOperationExceptions] = useState<OperationExceptionRow[]>([]);
  const calendarReleasedForTeam = Date.now() >= CALENDAR_TEAM_RELEASE_AT;
  const visibleMenus = role === "gestor" || calendarReleasedForTeam ? menus[role] : menus[role].filter(item => item !== "calendario");

  useEffect(() => {
    if (role !== "gestor" && !calendarReleasedForTeam && screen === "calendario") setScreen("visao");
  }, [role, calendarReleasedForTeam, screen]);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data } = await supabase.from("people").select("id,username,name,nickname,person_type_id,access_role_type_id,function_type_id,level,must_change_password").eq("auth_user_id", session.user.id).single();
        if (data) { setProfile(data as Profile); setRole(toUiRole(data.access_role_type_id as AccessRoleTypeId)); }
      }
      setAuthReady(true);
    };
    void loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const loadUnits = async () => {
      const { data: memberships } = await supabase.from("unit_memberships").select("unit_id").eq("person_id", profile.id);
      const unitIds = memberships?.map(item => Number(item.unit_id)) ?? [];
      if (!unitIds.length) { setUnits([]); setUnitId(null); return; }
      const { data } = await supabase.from("units").select("id,name,minimum_teachers,calendar_mode_type_id,active").in("id", unitIds).eq("active", true).order("name");
      const available = (data ?? []) as UnitRow[];
      setUnits(available);
      const remembered = Number(window.localStorage.getItem(`gestao-pd-unit-${profile.id}`));
      setUnitId(available.some(unit => unit.id === remembered) ? remembered : available[0]?.id ?? null);
    };
    void loadUnits();
  }, [profile]);

  useEffect(() => {
    if (!profile || !unitId) return;
    const loadData = async () => {
      const currentUnit = unitId;
      setOpeningDays([false, false, false, false, false, false, false]);
      setClasses([]); setSoloRows([]); setSubstitutionRows([]); setPeople([]); setSchedules([]); setOperationExceptions([]);
      const [{ data: days }, { data: classData }, { data: soloData }, { data: substitutionsData }, { data: scheduleData }, { data: exceptionData }] = await Promise.all([
        supabase.from("unit_open_days").select("weekday,open").eq("unit_id", currentUnit),
        supabase.from("classes").select("id,name,allowed_for_half_day").eq("unit_id", currentUnit).eq("active", true).order("id"),
        supabase.from("solo_classes").select("id,date,status,teacher_id,classes(name),people!solo_classes_teacher_id_fkey(name,nickname)").eq("unit_id", currentUnit).order("date", { ascending: false }),
        supabase.from("substitutions").select("id,date,substitute_person_id,external_name,external_level,daily_type,created_by,people!substitutions_substitute_person_id_fkey(name,nickname)").eq("unit_id", currentUnit).order("date", { ascending: false }),
        supabase.from("schedules").select("id,person_id,weekday,daily_type,starts_on,ends_on").eq("unit_id", currentUnit).order("weekday"),
        supabase.from("operation_exceptions").select("id,date,open,label").eq("unit_id", currentUnit).order("date"),
      ]);
      if (days) setOpeningDays(Array.from({ length: 7 }, (_, i) => Boolean(days.find((d) => d.weekday === i)?.open)));
      if (classData) setClasses(classData as ClassRow[]);
      if (soloData) setSoloRows(soloData as unknown as SoloRow[]);
      if (substitutionsData) setSubstitutionRows(substitutionsData as unknown as SubstitutionRow[]);
      if (scheduleData) setSchedules(scheduleData as ScheduleRow[]);
      if (exceptionData) setOperationExceptions(exceptionData as OperationExceptionRow[]);
      const { data: memberRows } = await supabase.from("unit_memberships").select("person_id").eq("unit_id", currentUnit);
      const personIds = memberRows?.map((m) => m.person_id) ?? [];
      if (personIds.length) {
        const { data: peopleData } = await supabase.from("people").select("id,name,nickname,username,person_type_id,access_role_type_id,function_type_id,level,active,auth_user_id").in("id", personIds).order("name");
        if (peopleData) setPeople(peopleData as PersonRow[]);
      }
    };
    void loadData();
    window.localStorage.setItem(`gestao-pd-unit-${profile.id}`, String(unitId));
  }, [profile, unitId]);

  const login = async (form: FormData) => {
    setAuthBusy(true); setAuthError("");
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email: `${username}@pd-buritis.local`, password });
    if (error) { setAuthError("Usuário ou senha inválidos."); setAuthBusy(false); return; }
    const { data, error: profileError } = await supabase.from("people").select("id,username,name,nickname,person_type_id,access_role_type_id,function_type_id,level,must_change_password").eq("auth_user_id", authData.user.id).single();
    if (profileError || !data) { await supabase.auth.signOut(); setAuthError("Conta sem perfil de acesso."); setAuthBusy(false); return; }
    setProfile(data as Profile); setRole(toUiRole(data.access_role_type_id as AccessRoleTypeId)); setScreen("visao"); setAuthBusy(false);
  };

  const changePassword = async (form: FormData) => {
    if (!profile) return;
    const password = String(form.get("new_password") ?? "");
    const confirmation = String(form.get("confirm_password") ?? "");
    if (password.length < 6) { setAuthError("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    if (password !== confirmation) { setAuthError("As senhas não coincidem."); return; }
    setAuthBusy(true); setAuthError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setAuthError("Não foi possível alterar a senha."); setAuthBusy(false); return; }
    const { data: completion, error: updateError } = await supabase.functions.invoke("manage-access", { body: { action: "complete_first_access" } });
    if (updateError || !completion?.completed) { setAuthError("A senha mudou, mas não foi possível concluir o primeiro acesso."); setAuthBusy(false); return; }
    setProfile({ ...profile, must_change_password: false }); setAuthBusy(false);
  };

  if (!authReady) return <main className="loading-page"><strong>PD Gestão Buritis</strong><span>Carregando acesso…</span></main>;

  if (!profile) {
    return (
      <main className="login-page">
        <section className="login-brand"><span>Gestão</span><h1>PD<br />Buritis</h1><p>Escalas, faltas e aulas solo em um só lugar.</p></section>
        <section className="login-panel">
          <form action={login}>
            <small>ACESSO À PLATAFORMA</small><h2>Bem-vindo</h2><p>Entre com seu usuário e senha.</p>
            <label>Usuário<input name="username" autoComplete="username" required /></label>
            <label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>
            {authError && <p className="form-error">{authError}</p>}
            <button className="primary" type="submit" disabled={authBusy}>{authBusy ? "Entrando…" : "Entrar"}</button>
          </form>
        </section>
      </main>
    );
  }

  if (profile.must_change_password) {
    return <main className="login-page"><section className="login-brand"><span>PD</span><h1>Primeiro<br />acesso</h1><p>Crie sua senha definitiva para continuar.</p></section><section className="login-panel"><form action={changePassword}><small>SEGURANÇA DA CONTA</small><h2>Olá, {profile.name.split(" ")[0]}</h2><p>A senha deve ter pelo menos 6 caracteres.</p><label>Nova senha<input name="new_password" type="password" minLength={6} autoComplete="new-password" required /></label><label>Confirmar senha<input name="confirm_password" type="password" minLength={6} autoComplete="new-password" required /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary" disabled={authBusy}>{authBusy ? "Salvando…" : "Definir nova senha"}</button></form></section></main>;
  }

  const logout = async () => { await supabase.auth.signOut(); setProfile(null); };
  const selectedUnit = units.find(unit => unit.id === unitId);
  const profileDetails = [
    personTypeOptions.find(option => option.id === profile.person_type_id)?.label,
    functionTypeOptions.find(option => option.id === profile.function_type_id)?.label,
    profile.level ? `nível ${profile.level}` : null,
  ].filter(Boolean).join(" - ");
  return (
    <main className={`app-shell role-${role} ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
      <aside aria-label="Navegação principal">
        <button type="button" className="sidebar-toggle" onClick={() => setSidebarExpanded(value => !value)} aria-label={sidebarExpanded ? "Ocultar barra lateral" : "Expandir barra lateral"}>{sidebarExpanded ? "‹" : "›"}</button>
        <div className="brand"><span>Gestão</span><div><strong>PD</strong><small>BURITIS</small></div></div>
        {sidebarExpanded ? <label className="unit-label">Unidade<select value={unitId ?? ""} onChange={event => { setUnitId(Number(event.target.value)); setScreen("visao"); }} disabled={units.length < 2}>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label> : <button type="button" className="unit-collapsed tooltip-item" data-tooltip={selectedUnit?.name ?? "Unidade"} onClick={() => setSidebarExpanded(true)} aria-label="Expandir para selecionar unidade"><span className="unit-icon" aria-hidden="true">⌂</span></button>}
        <nav className="desktop-nav">{visibleMenus.map((item) => <button key={item} data-tooltip={labels[item]} className={`${screen === item ? "active" : ""} tooltip-item`} onClick={() => setScreen(item)}><span className={`menu-icon menu-icon-${item}`} aria-hidden="true">{menuIcons[item]}</span><span className="menu-label">{labels[item]}</span></button>)}</nav>
        {role === "gestor" && <nav className="manager-mobile-nav">{(["visao", "calendario", "faltas", "solo"] as Screen[]).map((item) => <button key={item} className={screen === item ? "active" : ""} onClick={() => { setScreen(item); setManagerMoreOpen(false); }}><span className={`menu-icon menu-icon-${item}`} aria-hidden="true">{menuIcons[item]}</span><span className="menu-label">{labels[item]}</span></button>)}<button type="button" className={managerMoreOpen || ["substituicoes", "relatorios", "parametros"].includes(screen) ? "active" : ""} aria-expanded={managerMoreOpen} aria-controls="manager-more-menu" onClick={() => setManagerMoreOpen(value => !value)}><span className="menu-icon more-icon" aria-hidden="true">•••</span><span className="menu-label">Mais</span></button></nav>}
        <button className="logout tooltip-item" data-tooltip="Sair" onClick={logout}><span className="logout-icon" aria-hidden="true">↪</span><span className="menu-label">Sair</span></button>
      </aside>
      {role === "gestor" && managerMoreOpen && <><button type="button" className="manager-more-backdrop" aria-label="Fechar menu Mais" onClick={() => setManagerMoreOpen(false)} /><section className="manager-more-menu" id="manager-more-menu" aria-label="Mais opções de gestão"><div className="manager-more-heading"><strong>Mais opções</strong><button type="button" aria-label="Fechar" onClick={() => setManagerMoreOpen(false)}>×</button></div>{units.length > 1 && <label>Unidade<select value={unitId ?? ""} onChange={event => { setUnitId(Number(event.target.value)); setScreen("visao"); setManagerMoreOpen(false); }}>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label>}<div className="manager-more-actions">{(["substituicoes", "relatorios", "parametros"] as Screen[]).map(item => <button type="button" key={item} className={screen === item ? "active" : ""} onClick={() => { setScreen(item); setManagerMoreOpen(false); }}><span className={`menu-icon menu-icon-${item}`} aria-hidden="true">{menuIcons[item]}</span><span>{labels[item]}</span></button>)}<button type="button" className="manager-more-logout" onClick={logout}><span className="logout-icon" aria-hidden="true">↪</span><span>Sair</span></button></div></section></>}
      <section className="workspace">
        <header><div><small>{selectedUnit?.name.toUpperCase() ?? "SEM UNIDADE"}</small><strong>{labels[screen]}</strong></div><div className="profile"><div><strong>{profile.name}</strong><small>{profileDetails}</small></div><span>{profile.name.slice(0, 1)}</span></div></header>
        <div className="content">
          {screen === "visao" && <Overview role={role} profile={profile} unitId={unitId} minimumTeachers={selectedUnit?.minimum_teachers ?? 4} openingDays={openingDays} operationExceptions={operationExceptions} people={people} schedules={schedules} soloRows={soloRows} onReviewPending={() => setScreen("solo")} />}
          {screen === "calendario" && <OperationalCalendar role={role} profile={profile} unit={selectedUnit} openingDays={openingDays} operationExceptions={operationExceptions} people={people} schedules={schedules} />}
          {screen === "faltas" && <Absences role={role} profile={profile} unitId={unitId} minimumTeachers={selectedUnit?.minimum_teachers ?? 4} openingDays={openingDays} operationExceptions={operationExceptions} people={people} schedules={schedules} />}
          {screen === "solo" && <Solo role={role} profile={profile} unitId={unitId} classes={classes} schedules={schedules} substitutions={substitutionRows} rows={soloRows} setRows={setSoloRows} />}
          {screen === "substituicoes" && <Substitutions profile={profile} unitId={unitId} openingDays={openingDays} people={people} rows={substitutionRows} setRows={setSubstitutionRows} />}
          {screen === "relatorios" && <Reports unitId={unitId} openingDays={openingDays} people={people} schedules={schedules} operationExceptions={operationExceptions} soloRows={soloRows} substitutions={substitutionRows} />}
          {screen === "parametros" && <Parameters profile={profile} unitId={unitId} units={units} setUnits={setUnits} selectUnit={setUnitId} openingDays={openingDays} setOpeningDays={setOpeningDays} operationExceptions={operationExceptions} setOperationExceptions={setOperationExceptions} people={people} setPeople={setPeople} schedules={schedules} setSchedules={setSchedules} soloRows={soloRows} />}
        </div>
      </section>
    </main>
  );
}

function Overview({ role, profile, unitId, minimumTeachers, openingDays, operationExceptions, people, schedules, soloRows, onReviewPending }: { role: Role; profile: Profile; unitId: number | null; minimumTeachers: number; openingDays: boolean[]; operationExceptions: OperationExceptionRow[]; people: PersonRow[]; schedules: ScheduleRow[]; soloRows: SoloRow[]; onReviewPending: () => void }) {
  const [overviewAbsences, setOverviewAbsences] = useState<AbsenceRow[]>([]);
  const [overviewManagerDays, setOverviewManagerDays] = useState<ManagerDayRow[]>([]);
  const [overviewSubstitutions, setOverviewSubstitutions] = useState<SubstitutionRow[]>([]);
  const [overviewPeriodStatus, setOverviewPeriodStatus] = useState<"open" | "closed">("open");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = `${year}-${String(month + 1).padStart(2,"0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2,"0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2,"0")}`;
  useEffect(() => {
    if (!unitId) return;
    const loadCoverage = async () => {
      const [{ data: absenceData }, { data: managerData }, { data: substitutionData }, { data: periodData }] = await Promise.all([
        supabase.from("absences").select("id,date,person_id,created_by,created_at").eq("unit_id", unitId).gte("date", start).lte("date", end),
        supabase.from("manager_teaching_days").select("id,date,manager_id,created_by").eq("unit_id", unitId).gte("date", start).lte("date", end),
        supabase.from("substitutions").select("id,date,substitute_person_id,external_name,external_level,daily_type,created_by").eq("unit_id", unitId).gte("date", start).lte("date", end),
        supabase.from("monthly_periods").select("status").eq("unit_id", unitId).eq("year", year).eq("month", month + 1).limit(1),
      ]);
      if (absenceData) setOverviewAbsences(absenceData as AbsenceRow[]);
      if (managerData) setOverviewManagerDays(managerData as ManagerDayRow[]);
      if (substitutionData) setOverviewSubstitutions(substitutionData as SubstitutionRow[]);
      if (periodData?.[0]?.status) setOverviewPeriodStatus(periodData[0].status as "open" | "closed");
    };
    void loadCoverage();
  }, [role, unitId, start, end]);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDates = Array.from({ length: daysInMonth }, (_, index) => `${year}-${String(month + 1).padStart(2,"0")}-${String(index + 1).padStart(2,"0")}`);
  const monthTitle = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(now);
  if (role !== "gestor") {
    const scheduledDates = monthDates.filter(date => {
      if (!unitIsOpenOn(date, openingDays, operationExceptions)) return false;
      const weekday = new Date(`${date}T12:00:00`).getDay();
      return schedules.some(schedule => schedule.person_id === profile.id && schedule.weekday === weekday && scheduleAppliesOn(schedule, date));
    });
    const absenceDates = new Set(overviewAbsences.filter(row => row.person_id === profile.id).map(row => row.date));
    const substitutionDates = overviewSubstitutions.filter(row => row.substitute_person_id === profile.id && unitIsOpenOn(row.date, openingDays, operationExceptions)).map(row => row.date);
    const accountedDates = new Set([...scheduledDates.filter(date => !absenceDates.has(date)), ...substitutionDates]);
    const personSolo = soloRows.filter(row => row.teacher_id === profile.id && row.date >= start && row.date <= end);
    const pendingPersonSolo = personSolo.filter(row => row.status === "pending").length;
    return <><Title title={`Olá, ${profile.name.split(" ")[0]}`} text={`Seu resumo de ${monthTitle} · competência ${overviewPeriodStatus === "closed" ? "fechada" : "aberta"}.`} /><div className={`stats ${role === "professor" ? "stats-four" : ""}`}><Stat label="Dias previstos" value={String(scheduledDates.length)} /><Stat label="Faltas" value={String(absenceDates.size)} /><Stat label="Dias contabilizados" value={String(accountedDates.size)} />{role === "professor" && <Stat label="Aulas solo no mês" value={String(personSolo.length)} detail={pendingPersonSolo ? `${pendingPersonSolo} aguardando aprovação` : "Nenhuma pendente"} />}</div><TodayOperations unitId={unitId} people={people} /><OverviewCalendar role={role} profile={profile} month={now} minimumTeachers={minimumTeachers} openingDays={openingDays} operationExceptions={operationExceptions} people={people} schedules={schedules} absences={overviewAbsences} managerDays={overviewManagerDays} substitutions={overviewSubstitutions} soloRows={soloRows} /></>;
  }
  const coverageAlerts = Array.from({ length: daysInMonth }, (_, index) => index + 1).map(day => {
    const date = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const weekday = new Date(`${date}T12:00:00`).getDay();
    const scheduled = people.filter(person => person.active && !isPersonType(person, "reception") && unitIsOpenOn(date, openingDays, operationExceptions) && (schedules.some(schedule => schedule.person_id === person.id && schedule.weekday === weekday && scheduleAppliesOn(schedule, date)) || overviewManagerDays.some(extra => extra.manager_id === person.id && extra.date === date)));
    const presentIds = new Set(scheduled.filter(person => !overviewAbsences.some(absence => absence.person_id === person.id && absence.date === date)).map(person => person.id));
    const substitutionsToday = overviewSubstitutions.filter(substitution => substitution.date === date);
    substitutionsToday.forEach(substitution => { if (substitution.substitute_person_id) presentIds.add(substitution.substitute_person_id); });
    const externalCount = new Set(substitutionsToday.filter(substitution => !substitution.substitute_person_id && substitution.external_name).map(substitution => substitution.external_name!.trim().toLowerCase())).size;
    const present = presentIds.size + externalCount;
    return { date, scheduled: scheduled.length, present };
  }).filter(day => day.scheduled > 0 && day.present < minimumTeachers);
  const pendingSolo = soloRows.filter(row => row.status === "pending" && row.date >= start && row.date <= end).length;
  return <><Title title="Visão geral" text={`${monthTitle} · competência ${overviewPeriodStatus === "closed" ? "fechada" : "aberta"}`} action="Revisar pendências" onAction={onReviewPending} /><div className="stats"><Stat label="Cobertura crítica" value={`${coverageAlerts.length} ${coverageAlerts.length === 1 ? "dia" : "dias"}`} tone={coverageAlerts.length ? "danger" : undefined} /><Stat label="Aulas solo pendentes" value={String(pendingSolo)} /><Stat label="Fechamento automático" value="D+1 útil" detail="Após o fim da competência" /></div><TodayOperations unitId={unitId} people={people} /><OverviewCalendar role={role} profile={profile} month={now} minimumTeachers={minimumTeachers} openingDays={openingDays} operationExceptions={operationExceptions} people={people} schedules={schedules} absences={overviewAbsences} managerDays={overviewManagerDays} substitutions={overviewSubstitutions} soloRows={soloRows} /></>;
}

function TodayOperations({ unitId, people }: { unitId: number | null; people: PersonRow[] }) {
  const [rows, setRows] = useState<CalendarAssignmentRow[]>([]);
  const [note, setNote] = useState("");
  const today = new Date().toISOString().slice(0,10);
  useEffect(() => {
    if (!unitId) return;
    const load = async () => {
      const [{ data: periodData }, { data: assignmentData }, { data: noteData }] = await Promise.all([
        supabase.from("calendar_periods").select("status").eq("unit_id", unitId).eq("year", Number(today.slice(0,4))).eq("month", Number(today.slice(5,7))).maybeSingle(),
        supabase.from("calendar_assignments").select("id,date,assignment_type_id,class_type_id,person_id,manually_assigned").eq("unit_id", unitId).eq("date", today).order("class_type_id"),
        supabase.from("calendar_day_notes").select("note").eq("unit_id", unitId).eq("date", today).maybeSingle(),
      ]);
      if (periodData?.status === "published") { setRows((assignmentData as CalendarAssignmentRow[] | null) ?? []); setNote(noteData?.note ?? ""); }
      else { setRows([]); setNote(""); }
    };
    void load();
  }, [unitId, today]);
  if (!rows.length) return null;
  const getName = (type: number, classId: number | null) => { const person = people.find(item => item.id === rows.find(row => row.assignment_type_id === type && row.class_type_id === classId)?.person_id); return person ? displayName(person) : "Pendente"; };
  const classIds = Array.from(new Set(rows.filter(row => row.assignment_type_id !== 3).map(row => row.class_type_id)));
  return <section className="panel today-operations"><div><small>FUNÇÕES DE HOJE</small><h3>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${today}T12:00:00`))}</h3>{note && <p>{note}</p>}</div><div className="today-operation-grid">{classIds.map(classId => <div key={classId ?? "simple"}>{classId && <span className={`class-marker ${CLASS_TYPES.find(item => item.id === classId)?.code ?? ""}`}>{CLASS_TYPES.find(item => item.id === classId)?.label}</span>}<small>Roda</small><strong>{getName(1, classId)}</strong><small>Som</small><strong>{getName(2, classId)}</strong></div>)}<div className="today-reception"><small>Portaria</small><strong>{getName(3, null)}</strong></div></div></section>;
}

function OverviewCalendar({ role, profile, month, minimumTeachers, openingDays, operationExceptions, people, schedules, absences, managerDays, substitutions, soloRows }: { role: Role; profile: Profile; month: Date; minimumTeachers: number; openingDays: boolean[]; operationExceptions: OperationExceptionRow[]; people: PersonRow[]; schedules: ScheduleRow[]; absences: AbsenceRow[]; managerDays: ManagerDayRow[]; substitutions: SubstitutionRow[]; soloRows: SoloRow[] }) {
  const year = month.getFullYear(), monthIndex = month.getMonth(), days = new Date(year, monthIndex + 1, 0).getDate(), offset = new Date(year, monthIndex, 1).getDay(), cells = Math.ceil((offset + days) / 7) * 7;
  const personName = (id: number) => { const person = people.find(item => item.id === id); return person ? displayName(person) : "Pessoa cadastrada"; };
  return <section className="panel overview-calendar-panel">
    <div className="overview-calendar-heading"><div><h3>Resumo do mês</h3><p>{role === "gestor" ? "Cobertura da equipe e aulas solo por dia." : "Sua escala, faltas e aulas solo em um só lugar."}</p></div><div className="overview-legend">{role === "gestor" ? <><span><i className="coverage-good" />Cobertura atingida</span><span><i className="coverage-bad" />Abaixo do mínimo</span></> : <><span><i className="personal-work" />Dia previsto</span><span><i className="personal-absence" />Falta</span><span><i className="personal-solo" />Aula solo</span></>}</div></div>
    <div className="overview-calendar">{week.map(day => <small key={day}>{day}</small>)}{Array.from({ length: cells }, (_, index) => {
      const day = index - offset + 1;
      if (day < 1 || day > days) return <i key={index} />;
      const date = `${year}-${String(monthIndex + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const weekday = new Date(`${date}T12:00:00`).getDay();
      const unitOpen = unitIsOpenOn(date, openingDays, operationExceptions);
      const daySolo = soloRows.filter(row => row.date === date);
      if (role === "gestor") {
        const scheduled = people.filter(person => person.active && !isPersonType(person, "reception") && unitOpen && (schedules.some(schedule => schedule.person_id === person.id && schedule.weekday === weekday && scheduleAppliesOn(schedule, date)) || managerDays.some(extra => extra.manager_id === person.id && extra.date === date)));
        const absentIds = new Set(absences.filter(row => row.date === date).map(row => row.person_id));
        const presentIds = new Set(scheduled.filter(person => !absentIds.has(person.id)).map(person => person.id));
        const todaySubs = substitutions.filter(row => row.date === date);
        todaySubs.forEach(row => { if (row.substitute_person_id) presentIds.add(row.substitute_person_id); });
        const externalNames = Array.from(new Set(todaySubs.filter(row => !row.substitute_person_id && row.external_name).map(row => row.external_name!.trim())));
        const presentNames = [...Array.from(presentIds).map(personName), ...externalNames];
        const absentNames = scheduled.filter(person => absentIds.has(person.id)).map(person => displayName(person));
        const present = presentNames.length;
        const hasCoverage = scheduled.length > 0 || todaySubs.length > 0;
        const critical = hasCoverage && present < minimumTeachers;
        const soloPeople = Array.from(new Map(daySolo.map(row => [row.teacher_id, row.people ? displayName(row.people) : personName(row.teacher_id)])).values());
        const label = `${day}: ${present} presentes, mínimo ${minimumTeachers}${absentNames.length ? `, ${absentNames.length} faltas` : ""}${soloPeople.length ? `, ${soloPeople.length} com aula solo` : ""}`;
        return <div tabIndex={0} aria-label={label} className={`overview-day ${hasCoverage ? critical ? "coverage-critical" : "coverage-regular" : ""}`} key={date}><b>{day}</b>{soloPeople.length > 0 && <><span className="overview-solo-names">{soloPeople.map((name, i) => <em className={`solo-person color-${i % 6}`} key={name}>{name}</em>)}</span><span className="mobile-day-count">{soloPeople.length}</span></>}<span className="day-popover"><strong>{present} presentes · mínimo {minimumTeachers}</strong><small>{presentNames.length ? `Presentes: ${presentNames.join(", ")}` : "Nenhuma presença prevista"}</small>{absentNames.length > 0 && <small>Faltas: {absentNames.join(", ")}</small>}{soloPeople.length > 0 && <small>Aulas solo: {soloPeople.join(", ")}</small>}</span></div>;
      }
      const scheduled = unitOpen && schedules.some(schedule => schedule.person_id === profile.id && schedule.weekday === weekday && scheduleAppliesOn(schedule, date));
      const absent = absences.some(row => row.person_id === profile.id && row.date === date);
      const personSoloRows = daySolo.filter(row => row.teacher_id === profile.id);
      const soloCount = personSoloRows.length;
      const label = `${day}: ${absent ? "falta marcada" : scheduled ? "dia previsto" : unitOpen ? "sem escala" : "unidade fechada"}${soloCount ? `, ${soloCount} ${soloCount === 1 ? "aula solo" : "aulas solo"}` : ""}`;
      return <div tabIndex={0} aria-label={label} className={`overview-day ${absent ? "person-absent" : scheduled ? "person-scheduled" : ""}`} key={date}><b>{day}</b>{absent && <em className="personal-mark absence-mark">Falta</em>}{soloCount > 0 && <><em className="personal-mark solo-mark">{soloCount} {soloCount === 1 ? "solo" : "solos"}</em><span className="mobile-day-count">{soloCount}</span></>}<span className="day-popover"><strong>Dia {day}</strong><small>{absent ? "Falta marcada" : scheduled ? "Dia previsto na escala" : unitOpen ? "Sem escala" : "Unidade fechada"}</small>{soloCount > 0 && <small>{soloCount} {soloCount === 1 ? "aula solo registrada" : "aulas solo registradas"}</small>}</span></div>;
    })}</div>
  </section>;
}

function OperationalCalendar({ role, profile, unit, openingDays, operationExceptions, people, schedules }: { role: Role; profile: Profile; unit?: UnitRow; openingDays: boolean[]; operationExceptions: OperationExceptionRow[]; people: PersonRow[]; schedules: ScheduleRow[] }) {
  const [viewMonth, setViewMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [period, setPeriod] = useState<CalendarPeriodRow | null>(null);
  const [assignments, setAssignments] = useState<CalendarAssignmentRow[]>([]);
  const [notes, setNotes] = useState<CalendarNoteRow[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityRow[]>([]);
  const [tab, setTab] = useState<"planning" | "board">(role === "gestor" ? "planning" : "board");
  const [range, setRange] = useState<"month" | "first" | "second">("first");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);
  const year = viewMonth.getFullYear(), month = viewMonth.getMonth();
  const start = `${year}-${String(month + 1).padStart(2,"0")}-01`;
  const end = `${year}-${String(month + 1).padStart(2,"0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2,"0")}`;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(viewMonth);
  const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(viewMonth);
  const isManager = role === "gestor";

  useEffect(() => {
    if (!unit) return;
    const load = async () => {
      const [{ data: periodData }, { data: assignmentData }, { data: noteData }, { data: absenceData }, { data: capabilityData }] = await Promise.all([
        supabase.from("calendar_periods").select("id,year,month,status,published_at").eq("unit_id", unit.id).eq("year", year).eq("month", month + 1).maybeSingle(),
        supabase.from("calendar_assignments").select("id,date,assignment_type_id,class_type_id,person_id,manually_assigned").eq("unit_id", unit.id).gte("date", start).lte("date", end).order("date"),
        supabase.from("calendar_day_notes").select("id,date,note").eq("unit_id", unit.id).gte("date", start).lte("date", end).order("date"),
        supabase.from("absences").select("id,date,person_id,created_by,created_at").eq("unit_id", unit.id).gte("date", start).lte("date", end),
        supabase.from("person_operational_capabilities").select("person_id,capability_type_id"),
      ]);
      setPeriod((periodData as CalendarPeriodRow | null) ?? null);
      setAssignments((assignmentData as CalendarAssignmentRow[] | null) ?? []);
      setNotes((noteData as CalendarNoteRow[] | null) ?? []);
      setAbsences((absenceData as AbsenceRow[] | null) ?? []);
      setCapabilities((capabilityData as CapabilityRow[] | null) ?? []);
    };
    void load();
  }, [unit?.id, year, month, start, end]);

  if (!unit) return <><Title title="Calendário" text="Selecione uma unidade para consultar a escala." /></>;
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => {
    const date = `${year}-${String(month + 1).padStart(2,"0")}-${String(index + 1).padStart(2,"0")}`;
    return date;
  }).filter(date => unitIsOpenOn(date, openingDays, operationExceptions));
  const classSlots = unit.calendar_mode_type_id === CALENDAR_MODES.colors ? CLASS_TYPES : [{ id: null, label: "", code: "simple" }];
  const personName = (id?: number | null) => { const person = people.find(item => item.id === id); return person ? displayName(person) : "Não definido"; };
  const assignmentFor = (date: string, type: number, classId: number | null) => assignments.find(item => item.date === date && item.assignment_type_id === type && item.class_type_id === classId);
  const hasCapability = (personId: number, capabilityId: number) => capabilities.some(item => item.person_id === personId && item.capability_type_id === capabilityId);
  const scheduledFor = (date: string, includeReception = false) => {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    return people.filter(person => person.active && (includeReception || !isPersonType(person, "reception")) && !absences.some(item => item.date === date && item.person_id === person.id) && schedules.some(schedule => schedule.person_id === person.id && schedule.weekday === weekday && scheduleAppliesOn(schedule, date)));
  };
  const candidatesFor = (date: string, type: number, classId: number | null) => {
    if (type === ASSIGNMENT_TYPES.reception) {
      const scheduled = scheduledFor(date, true);
      return [...scheduled.filter(person => isPersonType(person, "reception")), ...scheduled.filter(person => !isPersonType(person, "reception") && (RECEPTION_PRIORITY_PERSON_IDS.includes(person.id) || hasCapability(person.id, CAPABILITIES.coverReception)))];
    }
    const scheduled = scheduledFor(date);
    return type === ASSIGNMENT_TYPES.lead && classId === 3 ? scheduled.filter(person => hasCapability(person.id, CAPABILITIES.leadBlack)) : scheduled;
  };
  const requiredSlots = days.flatMap(date => [{ date, type: ASSIGNMENT_TYPES.reception, classId: null }, ...classSlots.flatMap(classType => [{ date, type: ASSIGNMENT_TYPES.lead, classId: classType.id }, { date, type: ASSIGNMENT_TYPES.sound, classId: classType.id }])]);
  const missingCount = requiredSlots.filter(slot => !assignmentFor(slot.date, slot.type, slot.classId)).length;
  const conflictCount = assignments.filter(assignment => absences.some(absence => absence.date === assignment.date && absence.person_id === assignment.person_id)).length;

  const generateCalendar = async (rebuildFrom?: string) => {
    if (!isManager) return;
    setBusy(true); setMessage("");
    let activePeriod = period;
    if (!activePeriod) {
      const { data, error } = await supabase.from("calendar_periods").insert({ unit_id: unit.id, year, month: month + 1, status: "draft", created_by: profile.id }).select("id,year,month,status,published_at").single();
      if (error || !data) { setMessage("Não foi possível iniciar o calendário deste mês."); setBusy(false); return; }
      activePeriod = data as CalendarPeriodRow; setPeriod(activePeriod);
    }
    let baseAssignments = assignments;
    const previousFutureAssignments = rebuildFrom ? assignments.filter(item => item.date >= rebuildFrom && item.date <= end) : [];
    const slotsToFill = rebuildFrom ? requiredSlots.filter(slot => slot.date >= rebuildFrom) : requiredSlots;
    if (rebuildFrom) {
      const { error: deleteError } = await supabase.from("calendar_assignments").delete().eq("unit_id", unit.id).gte("date", rebuildFrom).lte("date", end);
      if (deleteError) { setMessage("Não foi possível limpar a escala futura para refazê-la."); setBusy(false); return; }
      baseAssignments = assignments.filter(item => item.date < rebuildFrom);
      if (activePeriod.status === "published") {
        const { data: draftData } = await supabase.from("calendar_periods").update({ status: "draft", published_at: null, published_by: null, updated_at: new Date().toISOString() }).eq("id", activePeriod.id).select("id,year,month,status,published_at").single();
        if (draftData) { activePeriod = draftData as CalendarPeriodRow; setPeriod(activePeriod); }
      }
    }
    const counts = new Map<number, number>();
    baseAssignments.forEach(item => counts.set(item.person_id, (counts.get(item.person_id) ?? 0) + 1));
    const generated: { unit_id: number; date: string; assignment_type_id: number; class_type_id: number | null; person_id: number; manually_assigned: boolean; created_by: number; updated_by: number }[] = [];
    const occupied = new Map<string, Set<number>>();
    baseAssignments.forEach(item => { const set = occupied.get(item.date) ?? new Set<number>(); set.add(item.person_id); occupied.set(item.date, set); });
    const choose = (date: string, type: number, classId: number | null) => {
      const daily = occupied.get(date) ?? new Set<number>();
      const available = candidatesFor(date, type, classId).filter(person => !daily.has(person.id));
      let person: PersonRow | undefined;
      if (type === ASSIGNMENT_TYPES.reception) {
        const fixedReception = available.filter(item => isPersonType(item, "reception"));
        const priorityGroup = available.filter(item => !isPersonType(item, "reception") && RECEPTION_PRIORITY_PERSON_IDS.includes(item.id));
        const remainingGroup = available.filter(item => !isPersonType(item, "reception") && !RECEPTION_PRIORITY_PERSON_IDS.includes(item.id));
        const drawPool = fixedReception.length ? fixedReception : priorityGroup.length ? priorityGroup : remainingGroup;
        person = drawPool[Math.floor(Math.random() * drawPool.length)];
      } else {
        person = available.sort((a,b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0) || a.name.localeCompare(b.name))[0];
      }
      if (!person) return null;
      daily.add(person.id); occupied.set(date, daily); counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
      return person.id;
    };
    for (const slot of slotsToFill) {
      if (baseAssignments.some(item => item.date === slot.date && item.assignment_type_id === slot.type && item.class_type_id === slot.classId)) continue;
      const personId = choose(slot.date, slot.type, slot.classId);
      if (personId) generated.push({ unit_id: unit.id, date: slot.date, assignment_type_id: slot.type, class_type_id: slot.classId, person_id: personId, manually_assigned: false, created_by: profile.id, updated_by: profile.id });
    }
    if (generated.length) {
      const { data, error } = await supabase.from("calendar_assignments").insert(generated).select("id,date,assignment_type_id,class_type_id,person_id,manually_assigned");
      if (error) {
        if (rebuildFrom && previousFutureAssignments.length) await supabase.from("calendar_assignments").insert(previousFutureAssignments.map(item => ({ unit_id: unit.id, date: item.date, assignment_type_id: item.assignment_type_id, class_type_id: item.class_type_id, person_id: item.person_id, manually_assigned: item.manually_assigned, created_by: profile.id, updated_by: profile.id })));
        setAssignments(assignments); setMessage(rebuildFrom ? "Não foi possível refazer o calendário; a escala anterior foi restaurada." : "A geração encontrou um problema. Nenhuma atribuição existente foi alterada.");
      }
      else { setAssignments([...baseAssignments, ...data as CalendarAssignmentRow[]]); setMessage(rebuildFrom ? `Calendário refeito a partir de ${rebuildFrom.split("-").reverse().join("/")}. Revise e publique novamente.` : `${data.length} atribuições preenchidas. ${requiredSlots.length - baseAssignments.length - data.length > 0 ? "Revise as pendências destacadas." : "Escala completa para revisão."}`); }
    } else { setAssignments(baseAssignments); setMessage(rebuildFrom ? "O calendário futuro foi limpo, mas não há pessoas elegíveis suficientes para preenchê-lo." : missingCount ? "Não há pessoas elegíveis suficientes para preencher as pendências." : "A escala já está completa."); }
    setBusy(false);
  };

  const rebuildCalendar = async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    const rebuildFrom = start > today ? start : today;
    if (rebuildFrom > end) { setMessage("Esta competência já terminou e não pode ser refeita."); return; }
    if (!window.confirm(`Refazer todas as atribuições de ${rebuildFrom.split("-").reverse().join("/")} em diante? Os dias anteriores e as observações serão preservados.`)) return;
    await generateCalendar(rebuildFrom);
  };

  const changeAssignment = async (date: string, type: 1 | 2 | 3, classId: 1 | 2 | 3 | null, personId: number) => {
    if (!isManager) return;
    const current = assignmentFor(date, type, classId);
    if (!personId && current) {
      const { error } = await supabase.from("calendar_assignments").delete().eq("id", current.id);
      if (!error) setAssignments(assignments.filter(item => item.id !== current.id));
      return;
    }
    if (!personId) return;
    if (current) {
      const { data, error } = await supabase.from("calendar_assignments").update({ person_id: personId, manually_assigned: true, updated_by: profile.id, updated_at: new Date().toISOString() }).eq("id", current.id).select("id,date,assignment_type_id,class_type_id,person_id,manually_assigned").single();
      if (!error && data) setAssignments(assignments.map(item => item.id === current.id ? data as CalendarAssignmentRow : item));
    } else {
      const { data, error } = await supabase.from("calendar_assignments").insert({ unit_id: unit.id, date, assignment_type_id: type, class_type_id: classId, person_id: personId, manually_assigned: true, created_by: profile.id, updated_by: profile.id }).select("id,date,assignment_type_id,class_type_id,person_id,manually_assigned").single();
      if (!error && data) setAssignments([...assignments, data as CalendarAssignmentRow]);
    }
  };

  const saveNote = async (date: string, note: string) => {
    if (!isManager) return;
    const clean = note.trim();
    const current = notes.find(item => item.date === date);
    if (!clean && current) { const { error } = await supabase.from("calendar_day_notes").delete().eq("id", current.id); if (!error) setNotes(notes.filter(item => item.id !== current.id)); return; }
    if (!clean || clean === current?.note) return;
    const { data, error } = await supabase.from("calendar_day_notes").upsert({ unit_id: unit.id, date, note: clean.slice(0,240), updated_by: profile.id, updated_at: new Date().toISOString() }, { onConflict: "unit_id,date" }).select("id,date,note").single();
    if (!error && data) setNotes([...notes.filter(item => item.date !== date), data as CalendarNoteRow]);
  };

  const publishCalendar = async () => {
    if (!isManager || !period) return;
    if ((missingCount || conflictCount) && !window.confirm(`Ainda existem ${missingCount} posições sem responsável e ${conflictCount} atribuições afetadas por falta. Publicar mesmo assim?`)) return;
    const now = new Date().toISOString();
    const { data, error } = await supabase.from("calendar_periods").update({ status: "published", published_by: profile.id, published_at: now, updated_at: now }).eq("id", period.id).select("id,year,month,status,published_at").single();
    if (!error && data) { setPeriod(data as CalendarPeriodRow); setMessage("Calendário publicado para toda a equipe."); }
  };

  const firstFriday = (() => { const firstDay = new Date(`${start}T12:00:00`).getDay(); return 1 + ((5 - firstDay + 7) % 7); })();
  const firstBoardEndDay = firstFriday + 7;
  const visibleDays = days.filter(date => range === "month" || (range === "first" ? Number(date.slice(-2)) <= firstBoardEndDay : Number(date.slice(-2)) > firstBoardEndDay));
  const calendarWeek = (date: string) => { const day = Number(date.slice(-2)); const firstWeekday = new Date(`${start}T12:00:00`).getDay(); const mondayOffset = (firstWeekday + 6) % 7; return Math.floor((day + mondayOffset - 1) / 7) + 1; };
  const exportImage = async (share = false) => {
    if (!boardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(boardRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#f7f4ec" });
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `escala-${unit.name.toLowerCase().replace(/[^a-z0-9]+/gi,"-")}-${start.slice(0,7)}-${range}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `Escala ${unit.name} — ${monthLabel}` });
      else { const link = document.createElement("a"); link.download = fileName; link.href = dataUrl; link.click(); }
    } catch { setMessage("Não foi possível gerar a imagem neste dispositivo. Use a opção Imprimir/PDF."); }
    setBusy(false);
  };

  const formatDay = (date: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00`)).replace(".", "");
  const selectFor = (date: string, type: 1 | 2 | 3, classId: 1 | 2 | 3 | null) => {
    const current = assignmentFor(date, type, classId);
    const candidates = candidatesFor(date, type, classId);
    const currentPerson = current ? people.find(person => person.id === current.person_id) : undefined;
    const options = currentPerson && !candidates.some(person => person.id === currentPerson.id) ? [currentPerson, ...candidates] : candidates;
    return <select aria-label={`${type === 1 ? "Roda" : type === 2 ? "Som" : "Portaria"} em ${date}`} value={current?.person_id ?? ""} onChange={event => changeAssignment(date, type, classId, Number(event.target.value))}><option value="">Pendente</option>{options.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select>;
  };
  if (!isManager && period?.status !== "published") return <><Title title="Calendário" text="Consulte as funções da equipe por dia de aula." /><div className="panel calendar-empty"><strong>Calendário ainda não publicado</strong><p>A gestão está preparando a escala de {monthLabel}.</p><div className="calendar-month-nav"><button onClick={() => setViewMonth(new Date(year, month - 1, 1))}>‹</button><span>{monthLabel}</span><button onClick={() => setViewMonth(new Date(year, month + 1, 1))}>›</button></div></div></>;

  return <>
    <Title title="Calendário" text={unit.calendar_mode_type_id === CALENDAR_MODES.simple ? "Escala simples de Roda, Som e Portaria." : "Escala por cores: Branca, Azul e Preta."} />
    <div className="calendar-toolbar panel">
      <div className="calendar-month-nav"><button onClick={() => setViewMonth(new Date(year, month - 1, 1))}>‹</button><strong>{monthLabel}</strong><button onClick={() => setViewMonth(new Date(year, month + 1, 1))}>›</button></div>
      <div className="calendar-tabs"><button className={tab === "planning" ? "active" : ""} onClick={() => setTab("planning")}>{isManager ? "Planejamento" : "Lista"}</button><button className={tab === "board" ? "active" : ""} onClick={() => setTab("board")}>Quadro para compartilhar</button></div>
      <span className={`calendar-status ${period?.status ?? "draft"}`}>{period?.status === "published" ? "Publicado" : "Rascunho"}</span>
    </div>
    {message && <p className="operation-message calendar-message">{message}</p>}
    {tab === "planning" ? <div className="calendar-planning">
      {isManager && <div className="calendar-actions panel"><div><strong>{missingCount || conflictCount ? `${missingCount} pendentes · ${conflictCount} afetadas por falta` : "Escala completa"}</strong><small>Ao refazer, dias anteriores e observações são preservados.</small></div><button className="primary" disabled={busy} onClick={assignments.length ? rebuildCalendar : () => generateCalendar()}>{busy ? "Gerando…" : assignments.length ? "Refazer calendário" : "Montar escala do mês"}</button><button disabled={!period || busy} onClick={publishCalendar}>Publicar escala</button></div>}
      <div className="calendar-days">{days.map(date => <section className={`calendar-day-card ${requiredSlots.some(slot => slot.date === date && !assignmentFor(date, slot.type, slot.classId)) ? "has-pending" : ""} ${assignments.some(item => item.date === date && absences.some(absence => absence.date === date && absence.person_id === item.person_id)) ? "has-conflict" : ""}`} key={date}><header><div><strong>{formatDay(date)}</strong><small>{assignments.some(item => item.date === date && absences.some(absence => absence.date === date && absence.person_id === item.person_id)) ? "Atenção: responsável com falta" : unit.calendar_mode_type_id === CALENDAR_MODES.simple ? "Escala simples" : "3 turmas"}</small></div>{isManager ? <input maxLength={240} defaultValue={notes.find(item => item.date === date)?.note ?? ""} placeholder="Observação do dia" onBlur={event => saveNote(date, event.target.value)} /> : <span>{notes.find(item => item.date === date)?.note || "Sem observação"}</span>}</header><div className="calendar-day-rows">{classSlots.map(classType => <div className={`calendar-duty-row class-${classType.code}`} key={classType.id ?? "simple"}>{classType.id && <span className="class-marker">{classType.label}</span>}<label><small>Roda</small>{isManager ? selectFor(date, 1, classType.id) : <strong>{personName(assignmentFor(date, 1, classType.id)?.person_id)}</strong>}</label><label><small>Som</small>{isManager ? selectFor(date, 2, classType.id) : <strong>{personName(assignmentFor(date, 2, classType.id)?.person_id)}</strong>}</label></div>)}</div><div className="calendar-reception"><small>Portaria</small>{isManager ? selectFor(date, 3, null) : <strong>{personName(assignmentFor(date, 3, null)?.person_id)}</strong>}</div></section>)}</div>
    </div> : <div className="calendar-board-area">
      <div className="board-controls panel"><label>Período<select value={range} onChange={event => setRange(event.target.value as typeof range)}><option value="first">1º quadro · até a 2ª sexta</option><option value="second">2º quadro · restante do mês</option><option value="month">Mês completo</option></select></label><button onClick={() => exportImage(false)} disabled={busy}>Baixar imagem</button><button className="primary" onClick={() => exportImage(true)} disabled={busy}>Compartilhar</button><button onClick={() => window.print()}>Imprimir / PDF</button></div>
      <div className="calendar-board-scroll"><div className={`calendar-share-board mode-${unit.calendar_mode_type_id === 1 ? "simple" : "colors"}`} ref={boardRef}><div className="share-board-heading"><div className="share-board-brand"><div><span>GESTÃO PD</span><h3>{unit.name}</h3></div><strong>Calendário {monthName}</strong></div><div><small>{range === "month" ? "Mês completo" : range === "first" ? "1º quadro · até a 2ª sexta" : "2º quadro · restante do mês"}</small></div></div><table><thead><tr><th>Data</th><th>Roda</th><th>Som</th><th>Portaria</th><th>Observação</th></tr></thead><tbody>{visibleDays.flatMap((date, dayIndex) => { const rows = classSlots.map((classType, index) => <tr className={`class-${classType.code}`} key={`${date}-${classType.id ?? "simple"}`}><td className="board-date-cell" style={{ backgroundColor: "#d9ecff" }}>{index === 0 ? formatDay(date) : ""}</td><td>{classType.id && <span className="board-class-marker">{classType.label}</span>}<strong>{personName(assignmentFor(date, 1, classType.id)?.person_id)}</strong></td><td>{personName(assignmentFor(date, 2, classType.id)?.person_id)}</td><td>{index === 0 ? personName(assignmentFor(date, 3, null)?.person_id) : ""}</td><td className="board-note-cell" style={{ backgroundColor: "#def2e2" }}>{index === 0 ? notes.find(item => item.date === date)?.note ?? "" : ""}</td></tr>); const showWeek = dayIndex === 0 || calendarWeek(visibleDays[dayIndex - 1]) !== calendarWeek(date); return [<tr className="board-week-row" key={`week-${date}`}><td colSpan={5}>Semana {calendarWeek(date)}</td></tr>, ...rows].filter((_, index) => showWeek || index > 0); })}</tbody></table><div className="share-board-footer"><span>Roda · Som · Portaria</span><small>Atualizado em {new Date().toLocaleDateString("pt-BR")}</small></div></div></div>
    </div>}
  </>;
}

function Absences({ role, profile, unitId, minimumTeachers, openingDays, operationExceptions, people, schedules }: { role: Role; profile: Profile; unitId: number | null; minimumTeachers: number; openingDays: boolean[]; operationExceptions: OperationExceptionRow[]; people: PersonRow[]; schedules: ScheduleRow[] }) {
  const today = new Date();
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedPersonId, setSelectedPersonId] = useState(profile.id);
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [extraManagerDays, setExtraManagerDays] = useState<ManagerDayRow[]>([]);
  const [monthSubstitutions, setMonthSubstitutions] = useState<SubstitutionRow[]>([]);
  const [periodOpen, setPeriodOpen] = useState(true);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthDate);
  const targetPersonId = role === "gestor" ? selectedPersonId : profile.id;
  useEffect(() => {
    if (!unitId) return;
    const loadMonth = async () => {
      const [{ data }, { data: periods }, { data: managerDayData }, { data: substitutionData }] = await Promise.all([
        supabase.from("absences").select("id,date,person_id,created_by,created_at").eq("unit_id", unitId).gte("date", monthStart).lte("date", monthEnd).order("date"),
        supabase.from("monthly_periods").select("status").eq("unit_id", unitId).eq("year", year).eq("month", month + 1).limit(1),
        supabase.from("manager_teaching_days").select("id,date,manager_id,created_by").eq("unit_id", unitId).gte("date", monthStart).lte("date", monthEnd),
        supabase.from("substitutions").select("id,date,substitute_person_id,external_name,external_level,daily_type,created_by").eq("unit_id", unitId).gte("date", monthStart).lte("date", monthEnd),
      ]);
      if (data) setRows(data as AbsenceRow[]);
      if (managerDayData) setExtraManagerDays(managerDayData as ManagerDayRow[]);
      if (substitutionData) setMonthSubstitutions(substitutionData as SubstitutionRow[]);
      setPeriodOpen(periods?.[0]?.status !== "closed");
    };
    void loadMonth();
  }, [unitId, monthStart, monthEnd, year, month]);
  const isScheduled = (personId: number, date: string) => {
    const weekday = new Date(`${date}T12:00:00`).getDay();
    return unitIsOpenOn(date, openingDays, operationExceptions) && (schedules.some(schedule => schedule.person_id === personId && schedule.weekday === weekday && scheduleAppliesOn(schedule, date)) || extraManagerDays.some(day => day.manager_id === personId && day.date === date));
  };
  const toggle = async (date: string) => {
    if (!unitId || !periodOpen || !isScheduled(targetPersonId, date)) return;
    setBusyDate(date);
    const existing = rows.find(row => row.person_id === targetPersonId && row.date === date);
    if (existing) {
      const { error } = await supabase.from("absences").delete().eq("id", existing.id);
      if (!error) setRows(rows.filter(row => row.id !== existing.id));
    } else {
      const { data, error } = await supabase.from("absences").insert({ unit_id: unitId, person_id: targetPersonId, date, created_by: profile.id }).select("id,date,person_id,created_by,created_at").single();
      if (!error && data) setRows([...rows, data as AbsenceRow].sort((a,b) => a.date.localeCompare(b.date)));
    }
    setBusyDate(null);
  };
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const selectedRows = rows.filter(row => row.person_id === targetPersonId);
  const coverageAlerts = role === "gestor" ? Array.from({ length: daysInMonth }, (_, index) => index + 1).map(day => {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const scheduledTeachers = people.filter(person => person.active && !isPersonType(person, "reception") && isScheduled(person.id, date));
    const presentIds = new Set(scheduledTeachers.filter(person => !rows.some(row => row.person_id === person.id && row.date === date)).map(person => person.id));
    const substitutionsToday = monthSubstitutions.filter(substitution => substitution.date === date);
    substitutionsToday.forEach(substitution => { if (substitution.substitute_person_id) presentIds.add(substitution.substitute_person_id); });
    const externalCount = new Set(substitutionsToday.filter(substitution => !substitution.substitute_person_id && substitution.external_name).map(substitution => substitution.external_name!.trim().toLowerCase())).size;
    const present = presentIds.size + externalCount;
    return { date, present, scheduled: scheduledTeachers.length };
  }).filter(day => day.scheduled > 0 && day.present < minimumTeachers) : [];
  coverageAlerts.splice(0);
  const selectablePeople = people.filter(person => person.active);
  return <><Title title={role === "gestor" ? "Faltas" : "Minhas faltas"} text="Marque ou desmarque faltas nos dias previstos da escala." />{role === "gestor" && <section className="panel absence-toolbar"><label>Pessoa<select value={selectedPersonId} onChange={event => setSelectedPersonId(Number(event.target.value))}>{selectablePeople.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label><div><small>Competência</small><strong>{periodOpen ? "Aberta para alterações" : "Fechada"}</strong></div></section>}<div className="panel calendar-panel"><div className="calendar-bar"><button type="button" onClick={() => setMonthDate(new Date(year, month - 1, 1))}>‹</button><strong className="month-name">{monthLabel}</strong><button type="button" onClick={() => setMonthDate(new Date(year, month + 1, 1))}>›</button></div>{!periodOpen && <p className="period-closed">Esta competência está fechada e não permite alterações.</p>}<div className="calendar">{week.map(day => <small key={day}>{day}</small>)}{Array.from({ length: cells }, (_, index) => { const day = index - offset + 1; if (day < 1 || day > daysInMonth) return <i key={index} />; const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const scheduled = isScheduled(targetPersonId, date); const absent = selectedRows.some(row => row.date === date); return <button key={date} disabled={!scheduled || !periodOpen || busyDate === date} className={absent ? "absent" : scheduled ? "scheduled" : ""} onClick={() => toggle(date)}><b>{day}</b><span>{absent ? "Falta" : scheduled ? "Trabalho" : unitIsOpenOn(date, openingDays, operationExceptions) ? "Sem escala" : "Fechada"}</span></button>; })}</div><div className="calendar-legend"><span><i className="legend-work" />Dia previsto</span><span><i className="legend-absence" />Falta marcada</span></div></div>{role === "gestor" && coverageAlerts.length > 0 && <section className="panel"><h3>Alertas de cobertura</h3><div className="coverage-list">{coverageAlerts.map(alert => <div className="coverage critical" key={alert.date}><div><strong>{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${alert.date}T12:00:00`))}</strong><p>{alert.present} {alert.present === 1 ? "professor presente" : "professores presentes"} · mínimo necessário: 4</p></div></div>)}</div></section>}<section className="panel"><h3>Faltas registradas no mês</h3><div className="table-wrap absence-table"><table><thead><tr><th>Data</th>{role === "gestor" && <th>Pessoa</th>}<th>Registrado por</th><th>Registro</th></tr></thead><tbody>{selectedRows.length ? selectedRows.map(row => <tr key={row.id}><td data-label="Data">{row.date.split("-").reverse().slice(0,2).join("/")}</td>{role === "gestor" && <td data-label="Pessoa">{displayName(people.find(person => person.id === row.person_id))}</td>}<td data-label="Registrado por">{people.find(person => person.id === row.created_by)?.name ?? (row.created_by === profile.id ? profile.name : "—")}</td><td data-label="Registro">{row.created_at ? new Date(row.created_at).toLocaleDateString("pt-BR") : "—"}</td></tr>) : <tr><td colSpan={role === "gestor" ? 4 : 3}>Nenhuma falta registrada nesta competência.</td></tr>}</tbody></table></div></section></>;
}

function Solo({ role, profile, unitId, classes, schedules, substitutions, rows, setRows }: { role: Role; profile: Profile; unitId: number | null; classes: ClassRow[]; schedules: ScheduleRow[]; substitutions: SubstitutionRow[]; rows: SoloRow[]; setRows: (v: SoloRow[]) => void }) {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const [recordDate, setRecordDate] = useState(todayIso);
  const [viewMonth, setViewMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [dailyType, setDailyType] = useState<"full" | "half" | null>(null);
  const [canRecord, setCanRecord] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (role !== "professor" || !unitId || !recordDate) return;
    const checkDay = async () => {
      const selected = new Date(`${recordDate}T12:00:00`);
      const weekday = selected.getDay();
      const [{ data: overrideData }, { data: absenceData }, { data: periodData }, { data: scheduleData }, { data: substitutionData }] = await Promise.all([
        supabase.from("daily_overrides").select("daily_type").eq("unit_id", unitId).eq("person_id", profile.id).eq("date", recordDate).limit(1),
        supabase.from("absences").select("id").eq("unit_id", unitId).eq("person_id", profile.id).eq("date", recordDate).limit(1),
        supabase.from("monthly_periods").select("status").eq("unit_id", unitId).eq("year", selected.getFullYear()).eq("month", selected.getMonth() + 1).limit(1),
        supabase.from("schedules").select("id,person_id,weekday,daily_type,starts_on,ends_on").eq("unit_id", unitId).eq("person_id", profile.id).eq("weekday", weekday),
        supabase.from("substitutions").select("daily_type,date,substitute_person_id").eq("unit_id", unitId).eq("substitute_person_id", profile.id).eq("date", recordDate).limit(1),
      ]);
      const directSchedules = (scheduleData ?? []) as ScheduleRow[];
      const schedule = directSchedules.find(item => scheduleAppliesOn(item, recordDate)) ?? schedules.find(item => item.person_id === profile.id && item.weekday === weekday && scheduleAppliesOn(item, recordDate));
      const directSubstitution = substitutionData?.[0] as Pick<SubstitutionRow, "daily_type" | "date" | "substitute_person_id"> | undefined;
      const substitution = directSubstitution ?? substitutions.find(item => item.substitute_person_id === profile.id && item.date === recordDate);
      const type = overrideData?.[0]?.daily_type ?? substitution?.daily_type ?? schedule?.daily_type;
      const normalizedType = type === "half" ? "half" : type === "full" || type === "manager_support" ? "full" : null;
      const open = periodData?.[0]?.status !== "closed";
      setPeriodOpen(open);
      setDailyType(normalizedType);
      setCanRecord(Boolean(open && !absenceData?.length && normalizedType && recordDate <= todayIso));
      setMessage(!open ? "Esta competência está fechada." : absenceData?.length ? "Existe uma falta registrada nesta data." : !normalizedType ? "A data não possui escala, substituição ou ajuste de diária." : recordDate > todayIso ? "Aulas solo só podem ser registradas hoje ou em datas passadas." : "");
    };
    void checkDay();
  }, [role, unitId, profile.id, recordDate, schedules, substitutions, todayIso]);
  const monthPrefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2,"0")}`;
  const visibleRows = rows.filter(row => (role === "professor" ? row.teacher_id === profile.id : true) && row.date.startsWith(monthPrefix));
  const rowsOnDate = rows.filter(row => row.teacher_id === profile.id && row.date === recordDate);
  const allowedClasses = dailyType === "half" ? classes.filter(item => item.allowed_for_half_day) : classes;
  const dailyLimit = dailyType === "half" ? 2 : dailyType === "full" ? 3 : 0;
  const save = async (form: FormData) => {
    if (!unitId || !canRecord || !dailyType) return;
    const classId = Number(form.get("class_id"));
    const selectedClass = classes.find(item => item.id === classId);
    if (!selectedClass || (dailyType === "half" && !selectedClass.allowed_for_half_day)) { setMessage("Esta turma não é permitida para meia diária."); return; }
    if (rowsOnDate.length >= dailyLimit) { setMessage(`O limite desta data é de ${dailyLimit} aulas solo.`); return; }
    if (rowsOnDate.some(row => row.classes?.name === selectedClass.name)) { setMessage("Esta turma já foi registrada nesta data."); return; }
    const { data, error } = await supabase.from("solo_classes").insert({ unit_id: unitId, teacher_id: profile.id, class_id: classId, date: recordDate, status: "pending" }).select("id,date,status,teacher_id,classes(name),people!solo_classes_teacher_id_fkey(name,nickname)").single();
    if (!error && data) { setRows([data as unknown as SoloRow, ...rows]); setMessage(""); }
    else setMessage("Não foi possível salvar. Verifique se a turma já foi registrada.");
  };
  const isMonthOpen = async (date: string) => { if (!unitId) return false; const selected = new Date(`${date}T12:00:00`); const { data } = await supabase.from("monthly_periods").select("status").eq("unit_id", unitId).eq("year", selected.getFullYear()).eq("month", selected.getMonth() + 1).limit(1); return data?.[0]?.status !== "closed"; };
  const approve = async (row: SoloRow) => { if (!(await isMonthOpen(row.date))) { setMessage("Esta competência está fechada."); return; } const { error } = await supabase.from("solo_classes").update({ status: "approved", reviewed_by: profile.id, reviewed_at: new Date().toISOString() }).eq("id", row.id); if (!error) setRows(rows.map(item => item.id === row.id ? { ...item, status: "approved" } : item)); };
  const remove = async (row: SoloRow) => { if (!(await isMonthOpen(row.date))) { setMessage("Esta competência está fechada."); return; } const { error } = await supabase.from("solo_classes").delete().eq("id", row.id); if (!error) setRows(rows.filter(item => item.id !== row.id)); };
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(viewMonth);
  return <><Title title={role === "gestor" ? "Aulas solo" : "Minhas aulas solo"} text={role === "gestor" ? "Aprove os registros enviados pelos professores." : "Cada turma registrada corresponde a uma aula solo."} />{role === "professor" && <div className="stats"><Stat label="Aprovadas no mês" value={String(visibleRows.filter(row => row.status === "approved").length)} /><Stat label="Aguardando aprovação" value={String(visibleRows.filter(row => row.status === "pending").length)} /><Stat label="Total no mês" value={String(visibleRows.length)} /></div>}{role === "professor" && <section className="panel"><form action={save} className="solo-form"><label>Data<input value={recordDate} onChange={event => setRecordDate(event.target.value)} name="date" type="date" max={todayIso} required /></label><label>Turma<select name="class_id" disabled={!canRecord || !allowedClasses.length}>{allowedClasses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="primary" disabled={!canRecord || rowsOnDate.length >= dailyLimit}>Salvar aula solo</button></form><div className="solo-day-status"><span>{dailyType ? `Diária ${dailyType === "full" ? "completa" : "meia"}` : "Diária não identificada"}</span><strong>{rowsOnDate.length}/{dailyLimit} aulas registradas</strong></div>{message && <p className="operation-message">{message}</p>}<p className="hint">Na meia diária são permitidas até 2 turmas, sem Preta e Preta Av. Na diária completa, até 3 turmas.</p></section>}<div className="panel solo-month-bar"><button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button><strong>{monthLabel}</strong><button onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button></div>{role === "gestor" && message && <p className="operation-message">{message}</p>}<SoloCalendar month={viewMonth} rows={visibleRows} role={role} profile={profile} /><div className="table-wrap solo-table"><table><thead><tr><th>Professor</th><th>Data</th><th>Turma</th><th>Status</th><th>Ação</th></tr></thead><tbody>{visibleRows.length ? visibleRows.map(row => <tr key={row.id}><td data-label="Professor">{displayName(row.people ?? profile)}</td><td data-label="Data">{row.date.split("-").reverse().join("/")}</td><td data-label="Turma">{row.classes?.name ?? "—"}</td><td data-label="Status"><span className={`pill ${row.status === "pending" ? "pending" : "approved"}`}>{row.status === "pending" ? "Pendente" : "Aprovada"}</span></td><td data-label="Ação"><div className="row-actions">{role === "gestor" && row.status === "pending" && <button onClick={() => approve(row)}>Aprovar</button>}{(role === "gestor" || row.status === "pending") && <button className="delete-action" onClick={() => remove(row)}>Excluir</button>}</div></td></tr>) : <tr><td colSpan={5}>Nenhuma aula solo registrada nesta competência.</td></tr>}</tbody></table></div></>;
}

function SoloCalendar({ month, rows, role, profile }: { month: Date; rows: SoloRow[]; role: Role; profile: Profile }) {
  const year = month.getFullYear(); const monthIndex = month.getMonth(); const days = new Date(year, monthIndex + 1, 0).getDate(); const offset = new Date(year, monthIndex, 1).getDay(); const cells = Math.ceil((offset + days) / 7) * 7;
  return <section className="panel solo-calendar-panel"><h3>Calendário de aulas solo</h3><div className="solo-calendar">{week.map(day => <small key={day}>{day}</small>)}{Array.from({ length: cells }, (_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > days) return <i key={index} />;
    const date = `${year}-${String(monthIndex + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayRows = rows.filter(row => row.date === date);
    const teachers = Array.from(new Map(dayRows.map(row => [row.teacher_id, displayName(row.people ?? profile)])).entries());
    const details = dayRows.map(row => `${displayName(row.people ?? profile)}: ${row.classes?.name ?? "Turma"} (${row.status === "pending" ? "pendente" : "aprovada"})`);
    const label = `${day}: ${dayRows.length ? `${dayRows.length} ${dayRows.length === 1 ? "aula solo" : "aulas solo"}` : "nenhuma aula solo"}`;
    return <div tabIndex={dayRows.length ? 0 : -1} aria-label={label} className={dayRows.length ? "has-solo" : ""} key={date}><b>{day}</b><span className="solo-calendar-marks">{role === "gestor" ? teachers.map(([id,name]) => <em className={`solo-person color-${id % 6}`} key={id}>{name}</em>) : dayRows.length ? <em className="solo-person color-self">{dayRows.length} {dayRows.length === 1 ? "aula" : "aulas"}</em> : null}</span>{dayRows.length > 0 && <><span className="mobile-day-count">{dayRows.length}</span><span className="day-popover"><strong>Dia {day} · {dayRows.length} {dayRows.length === 1 ? "aula solo" : "aulas solo"}</strong>{details.map((detail, detailIndex) => <small key={`${date}-${detailIndex}`}>{detail}</small>)}</span></>}</div>;
  })}</div></section>;
}

function Substitutions({ profile, unitId, openingDays, people, rows, setRows }: { profile: Profile; unitId: number | null; openingDays: boolean[]; people: PersonRow[]; rows: SubstitutionRow[]; setRows: (v: SubstitutionRow[]) => void }) {
  const today = new Date().toISOString().slice(0,10);
  const [managerDays, setManagerDays] = useState<ManagerDayRow[]>([]);
  const [overrides, setOverrides] = useState<DailyOverrideRow[]>([]);
  const [message, setMessage] = useState("");
  const [subMode, setSubMode] = useState<"internal" | "external">("internal");
  const [subDate, setSubDate] = useState(today);
  const [subPersonId, setSubPersonId] = useState(0);
  const [externalName, setExternalName] = useState("");
  const [externalLevel, setExternalLevel] = useState(1);
  const [subDailyType, setSubDailyType] = useState("full");
  const [managerDate, setManagerDate] = useState(today);
  const [managerId, setManagerId] = useState(0);
  const [overrideDate, setOverrideDate] = useState(today);
  const [overridePersonId, setOverridePersonId] = useState(0);
  const [overrideType, setOverrideType] = useState("full");
  useEffect(() => {
    if (!unitId) return;
    const load = async () => {
      const [{ data: managerData }, { data: overrideData }] = await Promise.all([
        supabase.from("manager_teaching_days").select("id,date,manager_id,created_by").eq("unit_id", unitId).order("date", { ascending: false }),
        supabase.from("daily_overrides").select("id,date,person_id,daily_type,created_by").eq("unit_id", unitId).order("date", { ascending: false }),
      ]);
      if (managerData) setManagerDays(managerData as ManagerDayRow[]);
      if (overrideData) setOverrides(overrideData as DailyOverrideRow[]);
    };
    void load();
  }, [unitId]);
  const canChangeDate = async (date: string) => {
    if (!unitId) return false;
    const currentMonth = new Date(); currentMonth.setDate(1); currentMonth.setHours(0,0,0,0);
    const selectedMonth = new Date(`${date.slice(0,7)}-01T12:00:00`);
    if (selectedMonth < currentMonth) { setMessage("Não é possível incluir registros em meses anteriores ao vigente."); return false; }
    if (!openingDays[new Date(`${date}T12:00:00`).getDay()]) { setMessage("A unidade está configurada como fechada nesta data."); return false; }
    const selected = new Date(`${date}T12:00:00`);
    const { data } = await supabase.from("monthly_periods").select("status").eq("unit_id", unitId).eq("year", selected.getFullYear()).eq("month", selected.getMonth() + 1).limit(1);
    if (data?.[0]?.status === "closed") { setMessage("Esta competência está fechada e não permite alterações."); return false; }
    setMessage(""); return true;
  };
  const saveSubstitution = async () => {
    if (!unitId || !(await canChangeDate(subDate))) return;
    if ((subMode === "internal" && !subPersonId) || (subMode === "external" && !externalName.trim())) { setMessage("Informe o substituto."); return; }
    const payload = { unit_id: unitId, date: subDate, substitute_person_id: subMode === "internal" ? subPersonId : null, external_name: subMode === "external" ? externalName.trim() : null, external_level: subMode === "external" ? externalLevel : null, daily_type: subDailyType, created_by: profile.id };
    const { data, error } = await supabase.from("substitutions").insert(payload).select("id,date,substitute_person_id,external_name,external_level,daily_type,created_by,people!substitutions_substitute_person_id_fkey(name,nickname)").single();
    if (!error && data) { setRows([data as unknown as SubstitutionRow, ...rows]); setExternalName(""); }
  };
  const deleteSubstitution = async (row: SubstitutionRow) => { if (!(await canChangeDate(row.date))) return; const { error } = await supabase.from("substitutions").delete().eq("id", row.id); if (!error) setRows(rows.filter(item => item.id !== row.id)); };
  const saveManagerDay = async () => {
    if (!unitId || !managerId || !(await canChangeDate(managerDate))) return;
    const payload = { unit_id: unitId, manager_id: managerId, date: managerDate, created_by: profile.id };
    const { data, error } = await supabase.from("manager_teaching_days").insert(payload).select("id,date,manager_id,created_by").single();
    if (!error && data) setManagerDays([data as ManagerDayRow, ...managerDays]);
  };
  const deleteManagerDay = async (row: ManagerDayRow) => { if (!(await canChangeDate(row.date))) return; const { error } = await supabase.from("manager_teaching_days").delete().eq("id", row.id); if (!error) setManagerDays(managerDays.filter(item => item.id !== row.id)); };
  const saveOverride = async () => {
    if (!unitId || !overridePersonId || !(await canChangeDate(overrideDate))) return;
    const payload = { unit_id: unitId, person_id: overridePersonId, date: overrideDate, daily_type: overrideType, created_by: profile.id };
    const { data, error } = await supabase.from("daily_overrides").upsert(payload, { onConflict: "unit_id,person_id,date" }).select("id,date,person_id,daily_type,created_by").single();
    if (!error && data) { const saved = data as DailyOverrideRow; setOverrides([saved, ...overrides.filter(row => row.id !== saved.id)]); }
  };
  const deleteOverride = async (row: DailyOverrideRow) => { if (!(await canChangeDate(row.date))) return; const { error } = await supabase.from("daily_overrides").delete().eq("id", row.id); if (!error) setOverrides(overrides.filter(item => item.id !== row.id)); };
  const teachers = people.filter(person => person.active && (isPersonType(person, "teacher") || isPersonType(person, "intern")));
  const managers = people.filter(person => person.active && isPersonType(person, "manager"));
  const dailyPeople = people.filter(person => person.active && !isPersonType(person, "manager"));
  const selectedSubstitute = people.find(person => person.id === subPersonId);
  return <><Title title="Exceções e substituições" text="Registre situações pontuais sem alterar a escala fixa." />{message && <p className="operation-message">{message}</p>}<details className="panel collapsible operation-section"><summary><div><h3>Substituições</h3><p>Diária extra para profissional da unidade ou externo.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content"><div className="operation-form"><label>Data<input type="date" min={today.slice(0,7) + "-01"} value={subDate} onChange={event => setSubDate(event.target.value)} /></label><label>Origem<select value={subMode} onChange={event => setSubMode(event.target.value as "internal" | "external")}><option value="internal">Pessoa cadastrada</option><option value="external">Profissional externo</option></select></label>{subMode === "internal" ? <label>Substituto<select value={subPersonId} onChange={event => setSubPersonId(Number(event.target.value))}><option value={0}>Selecionar</option>{teachers.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label> : <label>Nome completo<input value={externalName} onChange={event => setExternalName(event.target.value)} /></label>}<label>Nível{subMode === "internal" ? <input value={personLevelLabel(selectedSubstitute)} disabled /> : <select value={externalLevel} onChange={event => setExternalLevel(Number(event.target.value))}>{[1,2,3,4].map(level => <option key={level} value={level}>Nível {level}</option>)}</select>}</label><label>Diária<select value={subDailyType} onChange={event => setSubDailyType(event.target.value)}><option value="full">Completa</option><option value="half">Meia</option></select></label><button type="button" className="primary" onClick={saveSubstitution}>Adicionar substituição</button></div><OperationTable headers={["Substituto","Data","Nível","Diária","Ação"]} rows={rows.map(row => { const internal = people.find(person => person.id === row.substitute_person_id); return [row.people ? displayName(row.people) : row.external_name ?? "—", row.date.split("-").reverse().join("/"), internal ? personLevelLabel(internal) : row.external_level ? `Nível ${row.external_level}` : "—", row.daily_type === "full" ? "Completa" : "Meia", <div className="row-actions" key={row.id}><button className="delete-action" onClick={() => deleteSubstitution(row)}>Excluir</button></div>]; })} /></div></details><details className="panel collapsible operation-section"><summary><div><h3>Gestor em dia extra</h3><p>Contabilize um dia de aula fora da escala habitual.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content"><div className="operation-form compact"><label>Data<input type="date" min={today.slice(0,7) + "-01"} value={managerDate} onChange={event => setManagerDate(event.target.value)} /></label><label>Gestor<select value={managerId} onChange={event => setManagerId(Number(event.target.value))}><option value={0}>Selecionar</option>{managers.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label><button type="button" className="primary" onClick={saveManagerDay}>Adicionar dia</button></div><OperationTable headers={["Gestor","Data","Registrado por","Ação"]} rows={managerDays.map(row => [displayName(people.find(person => person.id === row.manager_id)), row.date.split("-").reverse().join("/"), displayName(people.find(person => person.id === row.created_by)), <div className="row-actions" key={row.id}><button className="delete-action" onClick={() => deleteManagerDay(row)}>Excluir</button></div>])} /></div></details><details className="panel collapsible operation-section"><summary><div><h3>Ajuste de diária</h3><p>Altere meia ou completa somente para uma data.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content"><div className="operation-form compact"><label>Data<input type="date" min={today.slice(0,7) + "-01"} value={overrideDate} onChange={event => setOverrideDate(event.target.value)} /></label><label>Pessoa<select value={overridePersonId} onChange={event => setOverridePersonId(Number(event.target.value))}><option value={0}>Selecionar</option>{dailyPeople.map(person => <option key={person.id} value={person.id}>{displayName(person)}</option>)}</select></label><label>Diária<select value={overrideType} onChange={event => setOverrideType(event.target.value)}><option value="full">Completa</option><option value="half">Meia</option></select></label><button type="button" className="primary" onClick={saveOverride}>Adicionar ajuste</button></div><OperationTable headers={["Pessoa","Data","Diária","Ação"]} rows={overrides.map(row => [displayName(people.find(person => person.id === row.person_id)), row.date.split("-").reverse().join("/"), row.daily_type === "full" ? "Completa" : "Meia", <div className="row-actions" key={row.id}><button className="delete-action" onClick={() => deleteOverride(row)}>Excluir</button></div>])} /></div></details></>;
}

function OperationTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) { return <div className="table-wrap operation-table"><table><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={headers[cellIndex]}>{cell}</td>)}</tr>) : <tr><td colSpan={headers.length}>Nenhum registro cadastrado.</td></tr>}</tbody></table></div>; }
function Reports({ unitId, openingDays, people, schedules, operationExceptions, soloRows, substitutions }: { unitId: number | null; openingDays: boolean[]; people: PersonRow[]; schedules: ScheduleRow[]; operationExceptions: OperationExceptionRow[]; soloRows: SoloRow[]; substitutions: SubstitutionRow[] }) {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [overrides, setOverrides] = useState<DailyOverrideRow[]>([]);
  const [periodStatus, setPeriodStatus] = useState("open");
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2,"0")}`;
  const monthStart = `${prefix}-01`;
  const monthEnd = `${prefix}-${String(new Date(year, month + 1, 0).getDate()).padStart(2,"0")}`;
  useEffect(() => {
    if (!unitId) return;
    const loadReport = async () => {
      const [{ data: absenceData }, { data: overrideData }, { data: periodData }] = await Promise.all([
        supabase.from("absences").select("id,date,person_id,created_by,created_at").eq("unit_id", unitId).gte("date", monthStart).lte("date", monthEnd),
        supabase.from("daily_overrides").select("id,date,person_id,daily_type,created_by").eq("unit_id", unitId).gte("date", monthStart).lte("date", monthEnd),
        supabase.from("monthly_periods").select("status").eq("unit_id", unitId).eq("year", year).eq("month", month + 1).limit(1),
      ]);
      setAbsences((absenceData ?? []) as AbsenceRow[]);
      setOverrides((overrideData ?? []) as DailyOverrideRow[]);
      setPeriodStatus(periodData?.[0]?.status ?? "open");
    };
    void loadReport();
  }, [unitId, monthStart, monthEnd, year, month]);
  const reportPeople = people.filter(person => !isPersonType(person, "manager"));
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => `${prefix}-${String(index + 1).padStart(2,"0")}`);
  const rows = reportPeople.map(person => {
    let total = 0;
    let complete = 0;
    const scheduledDays = days.filter(date => {
      if (!unitIsOpenOn(date, openingDays, operationExceptions)) return false;
      const weekday = new Date(`${date}T12:00:00`).getDay();
      return schedules.some(schedule => schedule.person_id === person.id && schedule.weekday === weekday && scheduleAppliesOn(schedule, date)) && !absences.some(absence => absence.person_id === person.id && absence.date === date);
    });
    scheduledDays.forEach(date => {
      const weekday = new Date(`${date}T12:00:00`).getDay();
      const schedule = schedules.find(item => item.person_id === person.id && item.weekday === weekday && scheduleAppliesOn(item, date));
      const type = overrides.find(item => item.person_id === person.id && item.date === date)?.daily_type ?? schedule?.daily_type;
      total += 1;
      if (type === "full") complete += 1;
    });
    const personSubstitutions = substitutions.filter(item => item.substitute_person_id === person.id && item.date.startsWith(prefix) && unitIsOpenOn(item.date, openingDays, operationExceptions));
    personSubstitutions.forEach(item => { total += 1; if (item.daily_type === "full") complete += 1; });
    const baseIsHalf = schedules.some(item => item.person_id === person.id && item.daily_type === "half" && scheduleAppliesOn(item, monthEnd));
    const totalLabel = baseIsHalf && complete ? `${total}, ${complete} comp` : String(total);
    const approvedSolo = soloRows.filter(item => item.teacher_id === person.id && item.status === "approved" && item.date.startsWith(prefix)).length;
    const absenceCount = absences.filter(item => item.person_id === person.id).length;
    const fullSubs = personSubstitutions.filter(item => item.daily_type === "full").length;
    const halfSubs = personSubstitutions.length - fullSubs;
    const substitutionLabel = !personSubstitutions.length ? "—" : fullSubs && halfSubs ? `${personSubstitutions.length} (${fullSubs} comp)` : fullSubs ? `${fullSubs} comp` : `${halfSubs} meia`;
    const functionLabel = isPersonType(person, "teacher") ? "Professor(a)" : isPersonType(person, "reception") ? "Recepção" : "Estagiário(a)";
    return [displayName(person), totalLabel, functionLabel, personLevelLabel(person), String(absenceCount), isPersonType(person, "teacher") ? String(approvedSolo) : "—", substitutionLabel];
  });
  const externalRows = Array.from(new Set(substitutions.filter(item => !item.substitute_person_id && item.external_name && item.date.startsWith(prefix) && unitIsOpenOn(item.date, openingDays, operationExceptions)).map(item => item.external_name!.trim()))).map(name => {
    const records = substitutions.filter(item => !item.substitute_person_id && item.external_name?.trim() === name && item.date.startsWith(prefix) && unitIsOpenOn(item.date, openingDays, operationExceptions));
    const full = records.filter(item => item.daily_type === "full").length;
    const level = records.find(item => item.external_level)?.external_level;
    return [name, full ? `${records.length}, ${full} comp` : String(records.length), "Substituto externo", level ? `Nível ${level}` : "—", "0", "—", full === records.length ? `${full} comp` : `${records.length} (${full} comp)`];
  });
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(viewMonth);
  return <><Title title="Relatório mensal" text="Resumo objetivo de professores e recepção. Gestores não são contabilizados." /><div className="panel report-month-bar"><button onClick={() => setViewMonth(new Date(year, month - 1, 1))}>‹</button><div><strong>{monthLabel}</strong><small className={periodStatus === "closed" ? "closed" : "open"}>{periodStatus === "closed" ? "Competência fechada" : "Competência aberta"}</small></div><button onClick={() => setViewMonth(new Date(year, month + 1, 1))}>›</button></div><Table sortable highlightColumn={1} headers={["Pessoa","Total de diárias","Função","Nível","Faltas","Aulas solo","Substituições"]} rows={[...rows, ...externalRows]} /></>;
}

function Parameters({ profile, unitId, units, setUnits, selectUnit, openingDays, setOpeningDays, operationExceptions, setOperationExceptions, people, setPeople, schedules, setSchedules, soloRows }: { profile: Profile; unitId: number | null; units: UnitRow[]; setUnits: (v: UnitRow[]) => void; selectUnit: (v: number) => void; openingDays: boolean[]; setOpeningDays: (v: boolean[]) => void; operationExceptions: OperationExceptionRow[]; setOperationExceptions: (v: OperationExceptionRow[]) => void; people: PersonRow[]; setPeople: (v: PersonRow[]) => void; schedules: ScheduleRow[]; setSchedules: (v: ScheduleRow[]) => void; soloRows: SoloRow[] }) {
  const [newPersonType, setNewPersonType] = useState<PersonTypeId>(PERSON_TYPES.teacher);
  const [newFunctionType, setNewFunctionType] = useState<FunctionTypeId>(FUNCTION_TYPES.both);
  const [schedulePersonId, setSchedulePersonId] = useState<number>(0);
  const [temporaryAccess, setTemporaryAccess] = useState<{ personId: number; password: string; expiresAt: number; copied: boolean } | null>(null);
  const [accessError, setAccessError] = useState<{ personId: number; message: string } | null>(null);
  const [accessBusy, setAccessBusy] = useState<number | null>(null);
  const [scheduleWeekdays, setScheduleWeekdays] = useState<number[]>([]);
  const [editingSchedulePersonId, setEditingSchedulePersonId] = useState<number | null>(null);
  const [editScheduleWeekdays, setEditScheduleWeekdays] = useState<number[]>([]);
  const [editScheduleDailyType, setEditScheduleDailyType] = useState("full");
  const today = new Date();
  const currentMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,"0")}-01`;
  const [exceptionDate, setExceptionDate] = useState(currentMonthStart);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [exceptionLabel, setExceptionLabel] = useState("");
  const [exceptionMessage, setExceptionMessage] = useState("");
  const [periods, setPeriods] = useState<MonthlyPeriodRow[]>([]);
  const [periodEvents, setPeriodEvents] = useState<MonthlyPeriodEventRow[]>([]);
  const [periodMessage, setPeriodMessage] = useState("");
  const [unitMessage, setUnitMessage] = useState("");
  const [unitBusy, setUnitBusy] = useState(false);
  const [directoryPeople, setDirectoryPeople] = useState<PersonRow[]>([]);
  const [capabilities, setCapabilities] = useState<CapabilityRow[]>([]);
  const [membershipBusy, setMembershipBusy] = useState<number | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  useEffect(() => {
    if (!temporaryAccess) return;
    const timeout = window.setTimeout(() => setTemporaryAccess(current => current?.personId === temporaryAccess.personId ? null : current), Math.max(0, temporaryAccess.expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [temporaryAccess]);
  useEffect(() => {
    if (!unitId) return;
    const loadPeriods = async () => {
      const [{ data: periodData }, { data: eventData }] = await Promise.all([
        supabase.from("monthly_periods").select("id,year,month,status,closes_at,closed_at,closed_by,reopened_at,reopened_by").eq("unit_id", unitId).order("year", { ascending: false }).order("month", { ascending: false }),
        supabase.from("monthly_period_events").select("id,period_id,action,actor_id,automated,created_at").eq("unit_id", unitId).order("created_at", { ascending: false }).limit(30),
      ]);
      if (periodData) setPeriods(periodData as MonthlyPeriodRow[]);
      if (eventData) setPeriodEvents(eventData as MonthlyPeriodEventRow[]);
    };
    void loadPeriods();
  }, [unitId]);
  useEffect(() => {
    const loadDirectory = async () => {
      const [{ data }, { data: capabilityData }] = await Promise.all([
        supabase.from("people").select("id,name,nickname,username,person_type_id,access_role_type_id,function_type_id,level,active,auth_user_id").order("name"),
        supabase.from("person_operational_capabilities").select("person_id,capability_type_id"),
      ]);
      if (data) setDirectoryPeople(data as PersonRow[]);
      if (capabilityData) setCapabilities(capabilityData as CapabilityRow[]);
    };
    void loadDirectory();
  }, [unitId]);
  const toggleDay = async (index: number) => { if (!unitId) return; const next = !openingDays[index]; const { error } = await supabase.from("unit_open_days").upsert({ unit_id: unitId, weekday: index, open: next }, { onConflict: "unit_id,weekday" }); if (!error) setOpeningDays(openingDays.map((v, i) => i === index ? next : v)); };
  const updatePerson = async (person: PersonRow, values: Partial<PersonRow>) => { const { error } = await supabase.from("people").update(values).eq("id", person.id); if (!error) setPeople(people.map(p => p.id === person.id ? { ...p, ...values } : p)); };
  const toggleCapability = async (personId: number, capabilityTypeId: 1 | 2) => {
    const active = capabilities.some(item => item.person_id === personId && item.capability_type_id === capabilityTypeId);
    const request = active ? supabase.from("person_operational_capabilities").delete().eq("person_id", personId).eq("capability_type_id", capabilityTypeId) : supabase.from("person_operational_capabilities").insert({ person_id: personId, capability_type_id: capabilityTypeId });
    const { error } = await request;
    if (!error) setCapabilities(active ? capabilities.filter(item => !(item.person_id === personId && item.capability_type_id === capabilityTypeId)) : [...capabilities, { person_id: personId, capability_type_id: capabilityTypeId }]);
  };
  const addPerson = async (form: FormData) => {
    if (!unitId) return;
    const personTypeId = Number(form.get("person_type_id")) as PersonTypeId;
    const functionTypeId = personTypeId === PERSON_TYPES.reception ? null : Number(form.get("function_type_id")) as FunctionTypeId;
    const level = personTypeId === PERSON_TYPES.intern ? null : Number(form.get("level"));
    const payload = { name: String(form.get("name")).trim(), nickname: String(form.get("nickname") ?? "").trim() || null, username: String(form.get("username")).trim().toLowerCase(), person_type_id: personTypeId, access_role_type_id: personTypeId, function_type_id: functionTypeId, level, active: true };
    const { data, error } = await supabase.from("people").insert(payload).select("id,name,nickname,username,person_type_id,access_role_type_id,function_type_id,level,active,auth_user_id").single();
    if (error || !data) return;
    const { error: membershipError } = await supabase.from("unit_memberships").insert({ unit_id: unitId, person_id: data.id });
    if (!membershipError) setPeople([...people, data as PersonRow].sort((a,b) => a.name.localeCompare(b.name)));
  };
  const changeProfile = async (person: PersonRow, nextTypeId: PersonTypeId) => {
    const level = nextTypeId === PERSON_TYPES.intern ? null : nextTypeId === PERSON_TYPES.reception ? (person.level && person.level <= 3 ? person.level : 1) : (person.level && person.level <= 4 ? person.level : 1);
    const functionTypeId = nextTypeId === PERSON_TYPES.reception ? null : person.function_type_id ?? FUNCTION_TYPES.both;
    await updatePerson(person, { person_type_id: nextTypeId, access_role_type_id: nextTypeId, function_type_id: functionTypeId, level });
  };
  const manageAccess = async (person: PersonRow) => {
    setAccessBusy(person.id); setTemporaryAccess(null); setAccessError(null);
    const action = person.auth_user_id ? "reset" : "create";
    const { data, error } = await supabase.functions.invoke("manage-access", { body: { person_id: person.id, action } });
    const credential = data?.credentials?.[0];
    if (!error && credential) {
      setTemporaryAccess({ personId: person.id, password: credential.temporary_password, expiresAt: Date.now() + 60_000, copied: false });
      if (!person.auth_user_id) setPeople(people.map(p => p.id === person.id ? { ...p, auth_user_id: "created" } : p));
    } else setAccessError({ personId: person.id, message: "Não foi possível gerar a senha. Tente novamente." });
    setAccessBusy(null);
  };
  const copyTemporaryPassword = async () => {
    if (!temporaryAccess) return;
    await navigator.clipboard.writeText(temporaryAccess.password);
    setTemporaryAccess({ ...temporaryAccess, copied: true });
  };
  const selectedSchedulePerson = people.find(p => p.id === schedulePersonId);
  const availableScheduleWeekdays = [1,2,3,4,5,6,0].filter(index => openingDays[index]);
  const addSchedule = async (form: FormData) => {
    const selectedOpenDays = scheduleWeekdays.filter(index => openingDays[index]);
    if (!unitId || !selectedSchedulePerson || !selectedOpenDays.length) return;
    const dailyType = isPersonType(selectedSchedulePerson, "manager") ? "manager_support" : String(form.get("daily_type"));
    const payload = selectedOpenDays.map(weekday => ({ unit_id: unitId, person_id: selectedSchedulePerson.id, weekday, daily_type: dailyType, starts_on: firstBusinessDayOfCurrentMonth(), ends_on: null }));
    const { data, error } = await supabase.from("schedules").insert(payload).select("id,person_id,weekday,daily_type,starts_on,ends_on");
    if (!error && data) {
      setSchedules([...schedules, ...(data as ScheduleRow[])].sort((a,b) => a.weekday - b.weekday));
      setScheduleWeekdays([]);
    }
  };
  const scheduleGroups = Array.from(new Set(schedules.map(schedule => schedule.person_id))).map(personId => {
    const personSchedules = schedules.filter(schedule => schedule.person_id === personId);
    const active = personSchedules.filter(schedule => !schedule.ends_on);
    const latestEnd = personSchedules.map(schedule => schedule.ends_on).filter(Boolean).sort().at(-1) ?? null;
    return { personId, rows: active.length ? active : personSchedules.filter(schedule => schedule.ends_on === latestEnd), active: active.length > 0, latestEnd };
  }).sort((a,b) => (people.find(p => p.id === a.personId)?.name ?? "").localeCompare(people.find(p => p.id === b.personId)?.name ?? ""));
  const startScheduleEdit = (group: (typeof scheduleGroups)[number]) => {
    setEditingSchedulePersonId(group.personId);
    setEditScheduleWeekdays(group.rows.map(row => row.weekday));
    setEditScheduleDailyType(group.rows[0]?.daily_type === "half" ? "half" : "full");
  };
  const saveScheduleEdit = async (personId: number) => {
    if (!unitId) return;
    const person = people.find(item => item.id === personId);
    const selectedOpenDays = editScheduleWeekdays.filter(index => openingDays[index]);
    if (!person || !selectedOpenDays.length) return;
    const activeRows = schedules.filter(schedule => schedule.person_id === personId && !schedule.ends_on);
    const dailyType = isPersonType(person, "manager") ? "manager_support" : editScheduleDailyType;
    const endDate = new Date().toISOString().slice(0,10);
    const removedIds = activeRows.filter(row => !selectedOpenDays.includes(row.weekday)).map(row => row.id);
    const keptIds = activeRows.filter(row => selectedOpenDays.includes(row.weekday)).map(row => row.id);
    const addedDays = selectedOpenDays.filter(day => !activeRows.some(row => row.weekday === day));
    if (removedIds.length) await supabase.from("schedules").update({ ends_on: endDate }).in("id", removedIds);
    if (keptIds.length) await supabase.from("schedules").update({ daily_type: dailyType }).in("id", keptIds);
    if (addedDays.length) await supabase.from("schedules").insert(addedDays.map(weekday => ({ unit_id: unitId, person_id: personId, weekday, daily_type: dailyType, starts_on: firstBusinessDayOfCurrentMonth(), ends_on: null })));
    const { data, error } = await supabase.from("schedules").select("id,person_id,weekday,daily_type,starts_on,ends_on").eq("unit_id", unitId);
    if (!error && data) setSchedules(data as ScheduleRow[]);
    setEditingSchedulePersonId(null);
  };
  const closeSchedule = async (personId: number) => {
    const endDate = new Date().toISOString().slice(0,10);
    const activeIds = schedules.filter(schedule => schedule.person_id === personId && !schedule.ends_on).map(schedule => schedule.id);
    if (!activeIds.length) return;
    const { error } = await supabase.from("schedules").update({ ends_on: endDate }).in("id", activeIds);
    if (!error) setSchedules(schedules.map(schedule => activeIds.includes(schedule.id) ? { ...schedule, ends_on: endDate } : schedule));
  };
  const saveOperationException = async () => {
    if (!unitId || !exceptionDate) return;
    setExceptionMessage("");
    const payload = { unit_id: unitId, date: exceptionDate, open: exceptionOpen, label: exceptionLabel.trim() || null };
    const { data, error } = await supabase.from("operation_exceptions").upsert(payload, { onConflict: "unit_id,date" }).select("id,date,open,label").single();
    if (error || !data) { setExceptionMessage("Não foi possível salvar esta configuração."); return; }
    const next = [...operationExceptions.filter(item => item.date !== data.date), data as OperationExceptionRow].sort((a,b) => a.date.localeCompare(b.date));
    setOperationExceptions(next);
    setExceptionLabel("");
    setExceptionMessage("Configuração salva.");
  };
  const deleteOperationException = async (row: OperationExceptionRow) => {
    const { error } = await supabase.from("operation_exceptions").delete().eq("id", row.id);
    if (!error) setOperationExceptions(operationExceptions.filter(item => item.id !== row.id));
  };
  const savePeriodEvent = async (period: MonthlyPeriodRow, action: "closed" | "reopened") => {
    if (!unitId) return;
    setPeriodMessage("");
    if (action === "closed") {
      const prefix = `${period.year}-${String(period.month).padStart(2,"0")}`;
      const pending = soloRows.filter(row => row.status === "pending" && row.date.startsWith(prefix)).length;
      if (pending && !window.confirm(`Existem ${pending} aulas solo pendentes nesta competência. Deseja fechar mesmo assim?`)) return;
    }
    const nowIso = new Date().toISOString();
    const values = action === "closed" ? { status: "closed", closed_at: nowIso, closed_by: profile.id, reopened_at: null, reopened_by: null } : { status: "open", closed_at: null, closed_by: null, reopened_at: nowIso, reopened_by: profile.id };
    const { data, error } = await supabase.from("monthly_periods").update(values).eq("id", period.id).select("id,year,month,status,closes_at,closed_at,closed_by,reopened_at,reopened_by").single();
    if (error || !data) { setPeriodMessage("Não foi possível alterar esta competência."); return; }
    const { data: eventData } = await supabase.from("monthly_period_events").insert({ unit_id: unitId, period_id: period.id, action, actor_id: profile.id, automated: false }).select("id,period_id,action,actor_id,automated,created_at").single();
    setPeriods(periods.map(item => item.id === period.id ? data as MonthlyPeriodRow : item));
    if (eventData) setPeriodEvents([eventData as MonthlyPeriodEventRow, ...periodEvents]);
    setPeriodMessage(action === "closed" ? "Competência fechada." : "Competência reaberta para ajustes manuais.");
  };
  const createUnit = async (form: FormData) => {
    setUnitBusy(true); setUnitMessage("");
    const { data, error } = await supabase.functions.invoke("manage-units", { body: { action: "create", name: String(form.get("unit_name") ?? ""), minimum_teachers: Number(form.get("minimum_teachers") ?? 4), calendar_mode_type_id: Number(form.get("calendar_mode_type_id") ?? 1) } });
    const unit = data?.unit as UnitRow | undefined;
    if (error || !unit) { setUnitMessage("Não foi possível cadastrar a unidade."); setUnitBusy(false); return; }
    setUnits([...units, unit].sort((a,b) => a.name.localeCompare(b.name)));
    selectUnit(unit.id);
    setUnitMessage("Unidade cadastrada e vinculada ao seu acesso.");
    setUnitBusy(false);
  };
  const updateCurrentUnit = async (form: FormData) => {
    if (!editingUnitId) return;
    setUnitBusy(true); setUnitMessage("");
    const values = { name: String(form.get("current_unit_name") ?? "").trim(), minimum_teachers: Math.min(20, Math.max(1, Number(form.get("current_minimum_teachers")) || 4)), calendar_mode_type_id: Number(form.get("current_calendar_mode_type_id")) as 1 | 2 };
    const { data, error } = await supabase.from("units").update(values).eq("id", editingUnitId).select("id,name,minimum_teachers,calendar_mode_type_id,active").single();
    if (error || !data) setUnitMessage("Não foi possível atualizar a unidade.");
    else { setUnits(units.map(unit => unit.id === editingUnitId ? data as UnitRow : unit).sort((a,b) => a.name.localeCompare(b.name))); setUnitMessage("Dados da unidade atualizados."); setEditingUnitId(null); }
    setUnitBusy(false);
  };
  const toggleUnitMembership = async (person: PersonRow) => {
    if (!unitId || person.id === profile.id) return;
    setMembershipBusy(person.id); setUnitMessage("");
    const linked = people.some(item => item.id === person.id);
    const request = linked
      ? supabase.from("unit_memberships").delete().eq("unit_id", unitId).eq("person_id", person.id)
      : supabase.from("unit_memberships").insert({ unit_id: unitId, person_id: person.id });
    const { error } = await request;
    if (error) setUnitMessage("Não foi possível alterar este vínculo.");
    else {
      setPeople(linked ? people.filter(item => item.id !== person.id) : [...people, person].sort((a,b) => a.name.localeCompare(b.name)));
      setUnitMessage(linked ? `${displayName(person)} foi desvinculado(a) desta unidade.` : `${displayName(person)} foi vinculado(a) a esta unidade.`);
    }
    setMembershipBusy(null);
  };
  return <><Title title="Parâmetros" text="Configurações próprias da unidade selecionada." />
    <details className="panel collapsible parameters-units"><summary><div><h3>Unidades</h3><p>Cadastre uma unidade e vincule-a automaticamente ao seu acesso.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content">
      <form action={createUnit} className="solo-form parameter-form"><label>Nome da unidade<input name="unit_name" placeholder="Ex.: PD Savassi" required minLength={2} /></label><label>Mínimo de professores<input name="minimum_teachers" type="number" min={1} max={20} defaultValue={4} required /></label><label>Modelo do calendário<select name="calendar_mode_type_id" defaultValue={CALENDAR_MODES.simple}><option value={CALENDAR_MODES.simple}>Escala simples</option><option value={CALENDAR_MODES.colors}>Escala por cores</option></select></label><button className="primary" disabled={unitBusy}>{unitBusy ? "Cadastrando…" : "Adicionar unidade"}</button></form>
      {unitMessage && <p className="operation-message">{unitMessage}</p>}
      <div className="table-wrap responsive-card-table"><table><thead><tr><th>Unidade</th><th>Cobertura mínima</th><th>Calendário</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{units.map(unit => <tr key={unit.id}><td data-label="Unidade"><strong>{unit.name}</strong>{unit.id === unitId ? <small className="unit-current">Em uso</small> : null}</td><td data-label="Cobertura mínima">{unit.minimum_teachers}</td><td data-label="Calendário">{unit.calendar_mode_type_id === CALENDAR_MODES.colors ? "Por cores" : "Simples"}</td><td data-label="Situação"><span className="pill approved">Ativa</span></td><td data-label="Ação"><button type="button" className="edit-action" onClick={() => setEditingUnitId(editingUnitId === unit.id ? null : unit.id)}>{editingUnitId === unit.id ? "Cancelar" : "Editar"}</button></td></tr>)}</tbody></table></div>
      {units.find(unit => unit.id === editingUnitId) && <form key={editingUnitId} action={updateCurrentUnit} className="solo-form parameter-form unit-edit-form"><label>Nome da unidade<input name="current_unit_name" defaultValue={units.find(unit => unit.id === editingUnitId)?.name} required minLength={2} /></label><label>Cobertura mínima<input name="current_minimum_teachers" type="number" min={1} max={20} defaultValue={units.find(unit => unit.id === editingUnitId)?.minimum_teachers ?? 4} required /></label><label>Modelo do calendário<select name="current_calendar_mode_type_id" defaultValue={units.find(unit => unit.id === editingUnitId)?.calendar_mode_type_id ?? 1}><option value={CALENDAR_MODES.simple}>Escala simples</option><option value={CALENDAR_MODES.colors}>Escala por cores</option></select></label><button className="primary" disabled={unitBusy}>Salvar alterações</button></form>}
      <div className="unit-team-header"><h4>Equipe vinculada</h4><p>Selecione quem terá acesso e fará parte dos cálculos desta unidade.</p></div>
      <div className="unit-members-grid">{directoryPeople.map(person => { const linked = people.some(item => item.id === person.id); const ownAccess = person.id === profile.id; return <label key={person.id} className={linked ? "linked" : ""}><input type="checkbox" checked={linked} disabled={ownAccess || membershipBusy === person.id} onChange={() => toggleUnitMembership(person)} /><span><strong>{displayName(person)}</strong><small>{personTypeOptions.find(option => option.id === person.person_type_id)?.label ?? "Perfil"}{ownAccess ? " · seu acesso" : ""}</small></span></label>; })}</div>
    </div></details>
    <details className="panel collapsible parameters-team"><summary><div><h3>Equipe</h3><p>Cadastre a equipe e ajuste nível e situação.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content">
      <form action={addPerson} className="solo-form parameter-form"><label>Nome completo<input name="name" required /></label><label>Apelido<input name="nickname" maxLength={40} placeholder="Como aparecerá no sistema" /></label><label>Usuário<input name="username" required /></label><label>Perfil<select name="person_type_id" value={newPersonType} onChange={e => setNewPersonType(Number(e.target.value) as PersonTypeId)}>{personTypeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>Função<select name="function_type_id" value={newPersonType === PERSON_TYPES.reception ? "" : newFunctionType} disabled={newPersonType === PERSON_TYPES.reception} onChange={e => setNewFunctionType(Number(e.target.value) as FunctionTypeId)}><option value="">Não se aplica</option>{functionTypeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label>Nível<select name="level" disabled={newPersonType === PERSON_TYPES.intern}><option value="1">Nível 1</option><option value="2">Nível 2</option><option value="3">Nível 3</option><option value="4">Nível 4</option></select></label><button className="primary">Adicionar pessoa</button></form>
      <div className="table-wrap team-table"><table><thead><tr><th>Pessoa</th><th>Apelido</th><th>Perfil</th><th>Função</th><th>Nível</th><th>Calendário</th><th>Acesso</th><th>Situação</th></tr></thead><tbody>{people.map(person => <tr key={person.id}><td data-label="Pessoa"><strong>{person.name}</strong><small>@{person.username} · {person.auth_user_id ? "acesso ativo" : "acesso pendente"}</small></td><td data-label="Apelido"><label className="nickname-editor"><span>Nome de exibição</span><input className="nickname-input" defaultValue={person.nickname ?? ""} maxLength={40} placeholder="Adicionar apelido" aria-label={`Apelido de ${person.name}`} onBlur={event => { const nickname = event.target.value.trim() || null; if (nickname !== person.nickname) void updatePerson(person, { nickname }); }} /></label></td><td data-label="Perfil"><select value={person.person_type_id} onChange={e => changeProfile(person, Number(e.target.value) as PersonTypeId)}>{personTypeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></td><td data-label="Função"><select value={person.function_type_id ?? ""} disabled={isPersonType(person, "reception")} onChange={e => updatePerson(person, { function_type_id: Number(e.target.value) as FunctionTypeId })}><option value="">Não se aplica</option>{functionTypeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></td><td data-label="Nível">{!isPersonType(person, "intern") ? <select value={person.level ?? 1} onChange={e => updatePerson(person, { level: Number(e.target.value) })}>{[1,2,3,4].filter(n => !isPersonType(person, "reception") || n < 4).map(n => <option key={n} value={n}>Nível {n}</option>)}</select> : "Estagiário(a)"}</td><td data-label="Calendário">{isPersonType(person, "reception") ? <small>Portaria principal</small> : <div className="capability-checks"><label><input type="checkbox" checked={capabilities.some(item => item.person_id === person.id && item.capability_type_id === CAPABILITIES.coverReception)} onChange={() => toggleCapability(person.id, CAPABILITIES.coverReception)} />Cobre Portaria</label><label><input type="checkbox" checked={capabilities.some(item => item.person_id === person.id && item.capability_type_id === CAPABILITIES.leadBlack)} onChange={() => toggleCapability(person.id, CAPABILITIES.leadBlack)} />Puxa Preta</label></div>}</td><td data-label="Acesso">{temporaryAccess?.personId === person.id ? <div className="temporary-password"><input value={temporaryAccess.password} readOnly aria-label={`Senha temporária de ${person.name}`} /><button type="button" className="copy-access" onClick={copyTemporaryPassword} title="Copiar senha" aria-label="Copiar senha"><span aria-hidden="true" /></button>{temporaryAccess.copied && <small>Copiada</small>}</div> : <button type="button" className="access-button" disabled={accessBusy === person.id} onClick={() => manageAccess(person)}>{accessBusy === person.id ? "Gerando…" : person.auth_user_id ? "Redefinir senha" : "Criar acesso"}</button>}{accessError?.personId === person.id && <small className="access-error">{accessError.message}</small>}</td><td data-label="Situação"><button type="button" className={person.active ? "status-button active" : "status-button"} onClick={() => updatePerson(person, { active: !person.active })}>{person.active ? "Ativo" : "Inativo"}</button></td></tr>)}</tbody></table></div>
    </div></details>
    <details className="panel collapsible parameters-schedules"><summary><div><h3>Escalas</h3><p>Defina os dias habituais de trabalho e a vigência.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content">
      <form action={addSchedule} className="schedule-form"><label>Pessoa<select value={schedulePersonId} onChange={e => setSchedulePersonId(Number(e.target.value))} required><option value={0}>Selecionar</option>{people.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{displayName(p)}</option>)}</select></label><fieldset className="weekday-multi"><legend>Dias da semana</legend>{availableScheduleWeekdays.length ? <div>{availableScheduleWeekdays.map(index => <button key={index} type="button" className={scheduleWeekdays.includes(index) ? "selected" : ""} aria-pressed={scheduleWeekdays.includes(index)} onClick={() => setScheduleWeekdays(current => current.includes(index) ? current.filter(day => day !== index) : [...current, index])}>{week[index]}</button>)}</div> : <small>Defina primeiro os dias de funcionamento.</small>}</fieldset><label>Tipo de diária<select name="daily_type" disabled={selectedSchedulePerson ? isPersonType(selectedSchedulePerson, "manager") : false}><option value="full">Completa</option><option value="half">Meia</option></select></label><button className="primary" disabled={!selectedSchedulePerson || !scheduleWeekdays.some(index => openingDays[index])}>Adicionar escala</button></form>
      <div className="table-wrap schedule-table"><table><thead><tr><th>Pessoa</th><th>Dias da semana</th><th>Diária</th><th>Ação</th></tr></thead><tbody>{scheduleGroups.length ? scheduleGroups.map(group => { const person = people.find(p => p.id === group.personId); const days = Array.from(new Set(group.rows.map(row => row.weekday))).sort((a,b) => [1,2,3,4,5,6,0].indexOf(a) - [1,2,3,4,5,6,0].indexOf(b)); const editing = editingSchedulePersonId === group.personId; return <Fragment key={group.personId}><tr><td data-label="Pessoa"><strong>{displayName(person)}</strong></td><td data-label="Dias da semana"><div className="schedule-days">{days.map(day => <span key={day}>{week[day]}</span>)}</div></td><td data-label="Diária">{group.rows[0]?.daily_type === "manager_support" ? "Dia de aula" : group.rows[0]?.daily_type === "full" ? "Completa" : "Meia"}</td><td data-label="Ação"><div className="schedule-actions">{group.active ? <><button type="button" className="edit-action" onClick={() => editing ? setEditingSchedulePersonId(null) : startScheduleEdit(group)}>{editing ? "Cancelar" : "Editar"}</button><button type="button" className="end-action" onClick={() => closeSchedule(group.personId)}>Encerrar hoje</button></> : <span>Vínculo encerrado</span>}</div></td></tr>{editing && <tr className="schedule-edit-row"><td colSpan={4}><div className="schedule-edit"><fieldset className="weekday-multi"><legend>Dias da semana</legend><div>{availableScheduleWeekdays.map(index => <button key={index} type="button" className={editScheduleWeekdays.includes(index) ? "selected" : ""} onClick={() => setEditScheduleWeekdays(current => current.includes(index) ? current.filter(day => day !== index) : [...current, index])}>{week[index]}</button>)}</div></fieldset><label>Tipo de diária<select value={editScheduleDailyType} onChange={event => setEditScheduleDailyType(event.target.value)} disabled={person ? isPersonType(person, "manager") : false}><option value="full">Completa</option><option value="half">Meia</option></select></label><button type="button" className="primary" disabled={!editScheduleWeekdays.some(index => openingDays[index])} onClick={() => saveScheduleEdit(group.personId)}>Salvar alterações</button></div></td></tr>}</Fragment> }) : <tr><td colSpan={4}>Nenhuma escala cadastrada.</td></tr>}</tbody></table></div>
    </div></details>
    <details className="panel collapsible parameters-open-days"><summary><div><h3>Dias de funcionamento da unidade</h3><p>Defina em quais dias da semana esta unidade abre regularmente.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content"><div className="weekday-toggles">{week.map((day, index) => <button key={day} className={openingDays[index] ? "selected" : ""} onClick={() => toggleDay(index)}><small>{day}</small><strong>{openingDays[index] ? "Aberta" : "Fechada"}</strong></button>)}</div><p className="hint">Aberturas e fechamentos excepcionais continuarão disponíveis no calendário de funcionamento.</p></div></details>
    <details className="panel collapsible operation-section parameters-holidays"><summary><div><h3>Feriados e funcionamento</h3><p>Registre aberturas e fechamentos excepcionais por data.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content">
      <div className="operation-form exception-form"><label>Data<input type="date" min={currentMonthStart} value={exceptionDate} onChange={event => setExceptionDate(event.target.value)} /></label><label>Funcionamento<select value={exceptionOpen ? "open" : "closed"} onChange={event => setExceptionOpen(event.target.value === "open")}><option value="closed">Unidade fechada</option><option value="open">Unidade aberta</option></select></label><label>Identificação (opcional)<input value={exceptionLabel} onChange={event => setExceptionLabel(event.target.value)} placeholder="Ex.: feriado municipal" /></label><button type="button" className="primary" onClick={saveOperationException}>Salvar configuração</button></div>
      {exceptionMessage && <p className="operation-message">{exceptionMessage}</p>}
      <OperationTable headers={["Data","Funcionamento","Identificação","Ação"]} rows={operationExceptions.map(row => [row.date.split("-").reverse().join("/"), row.open ? "Aberta" : "Fechada", row.label ?? "—", <div className="row-actions" key={row.id}><button className="delete-action" onClick={() => deleteOperationException(row)}>Excluir</button></div>])} />
    </div></details>
    <details className="panel collapsible operation-section parameters-periods"><summary><div><h3>Competências</h3><p>Fechamento automático D+1 útil e reaberturas controladas.</p></div><span className="summary-action">Ocultar</span></summary><div className="collapsible-content">
      <div className="competency-note"><strong>Fechamento automático ativo</strong><span>A rotina verifica as competências a cada hora e fecha no primeiro dia útil após o fim do mês.</span></div>
      {periodMessage && <p className="operation-message">{periodMessage}</p>}
      <OperationTable headers={["Competência","Situação","Fechamento previsto","Última alteração","Ação"]} rows={periods.map(period => [new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(period.year, period.month - 1, 1)), <span className={`pill ${period.status === "closed" ? "period-closed-pill" : "approved"}`} key={`status-${period.id}`}>{period.status === "closed" ? "Fechada" : period.reopened_at ? "Reaberta" : "Aberta"}</span>, new Date(period.closes_at).toLocaleDateString("pt-BR"), period.closed_at ? new Date(period.closed_at).toLocaleString("pt-BR") : period.reopened_at ? new Date(period.reopened_at).toLocaleString("pt-BR") : "—", <div className="row-actions" key={period.id}>{period.status === "closed" ? <button onClick={() => savePeriodEvent(period, "reopened")}>Reabrir</button> : <button className="delete-action" onClick={() => savePeriodEvent(period, "closed")}>Fechar agora</button>}</div>])} />
      <h4 className="history-title">Histórico de fechamento</h4>
      <OperationTable headers={["Competência","Ação","Responsável","Data"]} rows={periodEvents.map(event => { const period = periods.find(item => item.id === event.period_id); return [period ? `${String(period.month).padStart(2,"0")}/${period.year}` : "—", event.action === "closed" ? "Fechamento" : "Reabertura", event.automated ? "Automático" : displayName(people.find(person => person.id === event.actor_id)) || "Gestão", new Date(event.created_at).toLocaleString("pt-BR")]; })} />
    </div></details>
    </>;
}

function Title({ title, text, action, onAction, actionDisabled }: { title: string; text: string; action?: string; onAction?: () => void; actionDisabled?: boolean }) { return <div className="title"><div><h2>{title}</h2><p>{text}</p></div>{action && <button type="button" className="primary" onClick={onAction} disabled={actionDisabled}>{action}</button>}</div>; }
function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: string }) { return <div className={`stat ${tone || ""}`}><small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</div>; }
function Table({ headers, rows, highlightColumn, sortable = false }: { headers: string[]; rows: string[][]; highlightColumn?: number; sortable?: boolean }) { const [sort, setSort] = useState<{ column: number; direction: 1 | -1 }>({ column: 0, direction: 1 }); const levelRank = (value: string) => value.toLowerCase().includes("estagi") ? 0 : Number(value.match(/\d+/)?.[0] ?? 99); const sortedRows = sortable ? [...rows].sort((a,b) => { const av = sort.column === 3 ? levelRank(a[sort.column]) : a[sort.column], bv = sort.column === 3 ? levelRank(b[sort.column]) : b[sort.column]; return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true })) * sort.direction; }) : rows; const toggleSort = (column: number) => setSort(current => current.column === column ? { column, direction: current.direction === 1 ? -1 : 1 } : { column, direction: 1 }); return <div className="table-wrap responsive-card-table">{sortable && <div className="mobile-sort-controls"><label>Ordenar por<select value={sort.column} onChange={event => setSort({ column: Number(event.target.value), direction: 1 })}>{headers.map((header, index) => <option key={header} value={index}>{header}</option>)}</select></label><button type="button" onClick={() => setSort(current => ({ ...current, direction: current.direction === 1 ? -1 : 1 }))}>{sort.direction === 1 ? "Crescente ↑" : "Decrescente ↓"}</button></div>}<table><thead><tr>{headers.map((h, i) => <th className={i === highlightColumn ? "total-column" : ""} key={h}>{sortable ? <button type="button" className="sort-header" onClick={() => toggleSort(i)}>{h}<span>{sort.column === i ? sort.direction === 1 ? "▲" : "▼" : "↕"}</span></button> : h}</th>)}</tr></thead><tbody>{sortedRows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td data-label={headers[j]} className={j === highlightColumn ? "total-column" : ""} key={j}>{cell === "Pendente" || cell === "Aprovada" ? <span className={`pill ${cell === "Pendente" ? "pending" : "approved"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div>; }
