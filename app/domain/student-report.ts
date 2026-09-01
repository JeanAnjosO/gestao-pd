import { read, utils } from "xlsx";

export const MAX_STUDENT_IMPORT_BYTES = 1024 * 1024;

export type WellhubStudentReport = {
  frequent: number;
  twelveOrMore: number;
  belowFour: number;
  twelveOrMorePeople: { name: string; checkins: number }[];
};

export type CloudgymStudentReport = {
  enrolled: number;
  frequentTotalPass: number;
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
    frequent: people.filter(person => person.checkins >= 4).length,
    twelveOrMore: twelveOrMorePeople.length,
    belowFour: people.filter(person => person.checkins < 4).length,
    twelveOrMorePeople,
  };
};

export const calculateCloudgymReport = (rows: SheetRows): CloudgymStudentReport => {
  const enrolled = new Set<string>();
  const frequentTotalPass = new Set<string>();
  rows.slice(2).forEach(row => {
    const name = cleanText(row[0]);
    const key = personKey(row[0]);
    if (!name || !key) return;
    const payment = paymentKey(row[5]);
    const gross = numericValue(row[7]);
    if (payment !== "totalpass" && payment !== "gympass") enrolled.add(key);
    if (payment === "totalpass" && gross !== null && gross > 90) frequentTotalPass.add(key);
  });
  return { enrolled: enrolled.size, frequentTotalPass: frequentTotalPass.size };
};
