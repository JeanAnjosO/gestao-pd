export const MAX_STUDENT_IMPORT_BYTES = 1024 * 1024;

export type WellhubStudentReport = {
  frequent: number;
  twelveOrMore: number;
  belowFour: number;
  belowEight: number;
  twelveOrMorePeople: { name: string; checkins: number }[];
};

export type CloudgymStudentReport = {
  enrolled: number;
  frequentTotalPass: number;
  enrolledPeople?: string[] | null;
};

export type HighestFrequencyReport = {
  topPeople: { name: string; days: number }[];
};

type Cell = string | number | boolean | Date | null | undefined;
type SheetRows = Cell[][];

const cleanText = (value: Cell) => String(value ?? "").trim().replace(/\s+/g, " ");
const personKey = (value: Cell) => cleanText(value).toLocaleLowerCase("pt-BR");
const paymentKey = (value: Cell) => cleanText(value).toLocaleLowerCase("pt-BR");
const numericValue = (value: Cell) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = cleanText(value).replace(/[^\d,.-]/g, "");
  if (!text) return null;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseWorkbookRows = async (file: File): Promise<SheetRows> => {
  if (file.size > MAX_STUDENT_IMPORT_BYTES) throw new Error("O arquivo deve ter no máximo 1 MB.");
  const { read, utils } = await import("xlsx");
  const workbook = read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error("A planilha não possui uma aba válida.");
  return utils.sheet_to_json<Cell[]>(firstSheet, { header: 1, defval: null, raw: true }) as SheetRows;
};

export const calculateWellhubReport = (rows: SheetRows): WellhubStudentReport => {
  const people = rows.slice(10).flatMap(row => {
    const name = cleanText(row[2]);
    const checkins = numericValue(row[4]);
    return name && checkins !== null ? [{ name, checkins }] : [];
  });
  const twelveOrMorePeople = people.filter(person => person.checkins >= 12).sort((a, b) => b.checkins - a.checkins || a.name.localeCompare(b.name, "pt-BR"));
  return {
    frequent: people.filter(person => person.checkins >= 8).length,
    twelveOrMore: twelveOrMorePeople.length,
    belowFour: people.filter(person => person.checkins < 4).length,
    belowEight: people.filter(person => person.checkins < 8).length,
    twelveOrMorePeople,
  };
};

export const calculateCloudgymReport = (rows: SheetRows): CloudgymStudentReport => {
  const enrolled = new Map<string, string>();
  const frequentTotalPass = new Set<string>();
  rows.slice(2).forEach(row => {
    const name = cleanText(row[0]);
    const key = personKey(row[0]);
    if (!name || !key) return;
    const payment = paymentKey(row[5]);
    const gross = numericValue(row[7]);
    if (payment !== "totalpass" && payment !== "gympass" && !enrolled.has(key)) enrolled.set(key, name);
    if (payment === "totalpass" && gross !== null && gross > 180) frequentTotalPass.add(key);
  });
  return { enrolled: enrolled.size, frequentTotalPass: frequentTotalPass.size, enrolledPeople: [...enrolled.values()].sort((a, b) => a.localeCompare(b, "pt-BR")) };
};

export const compareEnrolledPeople = (current: string[], previous: string[]) => {
  const currentKeys = new Set(current.map(personKey));
  const previousKeys = new Set(previous.map(personKey));
  return {
    lost: previous.filter(name => !currentKeys.has(personKey(name))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    added: current.filter(name => !previousKeys.has(personKey(name))).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
};

export const previousStudentCompetence = (competence: string) => {
  const [year, month] = competence.split("-").map(Number);
  const previous = new Date(year, month - 2, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;
};

export const studentDeltaLabel = (delta: number | null) => delta === null ? "Sem comparação" : delta > 0 ? `Aumento de ${delta}` : delta < 0 ? `Déficit de ${Math.abs(delta)}` : "Sem alteração (0)";

export const calculateHighestFrequencyReport = (rows: SheetRows): HighestFrequencyReport => {
  const people = new Map<string, { name: string; days: number }>();
  rows.slice(2).forEach(row => {
    const name = cleanText(row[1]);
    const key = personKey(row[1]);
    if (!name || !key) return;
    const current = people.get(key);
    people.set(key, { name: current?.name ?? name, days: (current?.days ?? 0) + 1 });
  });
  return {
    topPeople: [...people.values()].sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, "pt-BR")).slice(0, 20),
  };
};

export const studentTrendLabel = (current: number | null | undefined, previous: number | null | undefined) => {
  if (current == null || previous == null) return "Sem comparação com o mês passado";
  const delta = current - previous;
  if (delta === 0) return "→ Sem alteração em relação ao mês passado";
  const count = Math.abs(delta);
  return `${delta > 0 ? "↑ Maior" : "↓ Menor"} que mês passado por ${count} ${count === 1 ? "aluno" : "alunos"}`;
};
