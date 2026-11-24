"use client";
import { isRecessOn } from "../domain/recess.ts";


import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { supabase } from "../supabase";
import { saveImageBlob } from "../domain/utils";
import { studentDayContent, studentMonthDays, type StudentCalendarCategory, type StudentCalendarNote } from "../domain/student-calendar";
import type { CalendarNoteRow, OperationExceptionRow, UnitRow } from "../domain/types";

const categories: { value: StudentCalendarCategory; label: string }[] = [
  { value: "event", label: "Evento da unidade" }, { value: "workshop", label: "Exame" },
  { value: "holiday", label: "Feriado" }, { value: "simulation", label: "Simulado" }, { value: "notice", label: "Aviso" },
];

export function StudentCalendar({ unit, personId, year, month, planningNotes, holidays }: {
  unit: UnitRow; personId: number; year: number; month: number; planningNotes: CalendarNoteRow[]; holidays: OperationExceptionRow[];
}) {
  const [notes, setNotes] = useState<StudentCalendarNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState<StudentCalendarCategory>("event");
  const boardRef = useRef<HTMLDivElement>(null);
  const days = studentMonthDays(year, month);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
  const content = (date: string) => studentDayContent(date, planningNotes, notes, holidays);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError(false);
    const timeout = window.setTimeout(() => {
      if (!cancelled) { setLoadError(true); setLoading(false); }
    }, 20000);
    void (async () => {
      const { data, error } = await supabase.from("student_calendar_notes").select("date,note,category").eq("unit_id", unit.id).gte("date", days[0]).lte("date", days.at(-1)!);
      if (cancelled) return;
      setLoadError(Boolean(error)); setNotes((data as StudentCalendarNote[] | null) ?? []); setLoading(false);
    })().catch(() => { if (!cancelled) { setLoadError(true); setLoading(false); } }).finally(() => window.clearTimeout(timeout));
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [unit.id, year, month, reload]);

  useLayoutEffect(() => {
    const board = boardRef.current;
    const parent = board?.parentElement;
    if (!board || !parent) return;
    const resize = () => board.style.setProperty("zoom", String(Math.min(1, parent.clientWidth / 1120)));
    resize(); const observer = new ResizeObserver(resize); observer.observe(parent);
    return () => observer.disconnect();
  }, [loading, loadError]);

  const selectDay = (date: string) => {
    if (isRecessOn(date, holidays)) return;
    const value = content(date);
    setSelected(date); setText(value.note); setCategory(value.category); setMessage("");
  };
  const save = async (restore = false) => {
    if (!selected || busy) return;
    setBusy(true); setMessage("");
    try {
      if (restore) {
        const { error } = await supabase.from("student_calendar_notes").delete().eq("unit_id", unit.id).eq("date", selected);
        if (error) throw error;
        setNotes(current => current.filter(item => item.date !== selected));
      } else {
        const payload = { unit_id: unit.id, date: selected, note: text.trim(), category, updated_by: personId, updated_at: new Date().toISOString() };
        const { data, error } = await supabase.from("student_calendar_notes").upsert(payload, { onConflict: "unit_id,date" }).select("date,note,category").single();
        if (error || !data) throw error || new Error("Sem retorno");
        setNotes(current => [...current.filter(item => item.date !== selected), data as StudentCalendarNote]);
      }
      setSelected(""); setMessage(restore ? "Observação do planejamento restaurada." : "Observação dos alunos salva. A escala da equipe foi preservada.");
    } catch { setMessage("Não foi possível salvar. Sua edição foi mantida; tente novamente."); }
    finally { setBusy(false); }
  };
  const exportImage = async (share: boolean) => {
    const board = boardRef.current;
    if (!board || busy || selected || loading || loadError) return;
    setBusy(true); setMessage("");
    const zoom = board.style.getPropertyValue("zoom");
    board.style.setProperty("zoom", "1");
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(board, { pixelRatio: 2, backgroundColor: "#f8f7f1" });
      const blob = await (await fetch(dataUrl)).blob();
      const filename = `calendario-alunos-${unit.id}-${days[0].slice(0, 7)}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${unit.name} · ${monthLabel}` });
      else await saveImageBlob(blob, filename, `${unit.name} · ${monthLabel}`);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Não foi possível gerar a imagem. Tente novamente neste dispositivo.");
    } finally { board.style.setProperty("zoom", zoom); setBusy(false); }
  };

  if (loading) return <div className="panel" role="status">Carregando calendário dos alunos…</div>;
  if (loadError) return <div className="panel" role="alert"><p>Não foi possível carregar as observações dos alunos.</p><button onClick={() => setReload(value => value + 1)}>Tentar novamente</button></div>;
  return <section className="student-calendar-area">
    <div className="panel student-calendar-controls"><div><h3>Calendário dos alunos</h3><p>As observações do planejamento aparecem automaticamente. Clique em um dia para personalizar a divulgação, inclusive aos sábados e domingos.</p></div><div className="student-calendar-buttons"><button disabled={busy || Boolean(selected)} onClick={() => exportImage(false)}>Baixar imagem</button><button className="primary" disabled={busy || Boolean(selected)} onClick={() => exportImage(true)}>{busy ? "Aguarde…" : "Compartilhar"}</button></div></div>
    {message && <p className="operation-message" role="status">{message}</p>}
    {selected && <form className="panel student-calendar-editor" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div><h3>Divulgação · {selected.split("-").reverse().join("/")}</h3><p>Esta edição vale apenas para o calendário dos alunos. Deixe o texto vazio para ocultar a observação neste calendário.</p></div>
      <label>Observação<textarea maxLength={240} rows={3} value={text} onChange={event => setText(event.target.value)} disabled={busy} autoFocus /></label>
      <label>Tipo<select value={category} onChange={event => setCategory(event.target.value as StudentCalendarCategory)} disabled={busy}>{categories.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
      <div className="student-calendar-buttons"><button className="primary" disabled={busy}>Salvar observação</button><button type="button" disabled={busy} onClick={() => setSelected("")}>Cancelar</button>{content(selected).custom && <button type="button" disabled={busy} onClick={() => save(true)}>Usar observação do planejamento</button>}</div>
    </form>}
    <div className="student-calendar-preview"><StudentCalendarPoster unitName={unit.name} year={year} month={month} planningNotes={planningNotes} holidays={holidays} notes={notes} disabled={busy || Boolean(selected)} onSelect={selectDay} boardRef={boardRef} /></div>
  </section>;
}

export function StudentCalendarPoster({ unitName, year, month, planningNotes, holidays, notes, disabled, onSelect, boardRef }: {
 unitName: string; year: number; month: number; planningNotes: { date: string; note: string }[]; holidays: OperationExceptionRow[]; notes: StudentCalendarNote[]; disabled: boolean; onSelect: (date: string) => void; boardRef?: React.Ref<HTMLDivElement>;
}) {
 const days = studentMonthDays(year, month);
 const offset = new Date(year, month, 1).getDay();
 const cellCount = Math.ceil((offset + days.length) / 7) * 7;
 const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
 const content = (date: string) => studentDayContent(date, planningNotes, notes, holidays);
 return <div className="student-calendar-poster" ref={boardRef}>
      <header className="student-calendar-heading"><div><span>{unitName}</span><h2>{new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, month, 1))}</h2></div><div><strong>{year}</strong><span>Agenda do mês</span></div></header>
      <div className="student-calendar-grid" role="grid" aria-label={`Calendário dos alunos · ${monthLabel}`}>
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map(day => <div className="student-calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {Array.from({ length: cellCount }, (_, index) => {
          const date = days[index - offset];
          if (!date) return <div className="student-calendar-blank" key={`empty-${index}`} aria-hidden="true" />;
          const item = content(date);
          return <button type="button" role="gridcell" className={`student-calendar-date ${item.note ? `student-event-${item.category}` : ""} ${index % 7 === 0 || index % 7 === 6 ? "student-weekend" : ""}`} key={date} disabled={disabled || isRecessOn(date, holidays)} onClick={() => onSelect(date)} aria-label={`${Number(date.slice(-2))} de ${monthLabel}${item.note ? `: ${item.note}` : ": adicionar observação"}`}><b>{Number(date.slice(-2))}</b><span>{item.note}</span></button>;
        })}
      </div>
      <footer className="student-calendar-footer"><div>{categories.map(item => <span key={item.value}><i className={`student-event-${item.value}`} />{item.label}</span>)}</div><p>Programe-se e venha dançar com a gente!</p></footer>
    </div>;
}
