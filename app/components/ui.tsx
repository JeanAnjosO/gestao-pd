"use client";

import { isValidElement, useState, type ReactNode } from "react";

export function Title({ title, text, action, onAction, actionDisabled }: { title: string; text: string; action?: string; onAction?: () => void; actionDisabled?: boolean }) {
  return <div className="title"><div><h2>{title}</h2><p>{text}</p></div>{action && <button type="button" className="primary" onClick={onAction} disabled={actionDisabled}>{action}</button>}</div>;
}

export function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: string }) {
  return <div className={`stat ${tone || ""}`}><small>{label}</small><strong>{value}</strong>{detail && <span>{detail}</span>}</div>;
}

export function Table({ headers, rows, highlightColumn, blueColumns = [], sortable = false }: { headers: string[]; rows: (string | ReactNode)[][]; highlightColumn?: number; blueColumns?: number[]; sortable?: boolean }) {
  const [sort, setSort] = useState<{ column: number; direction: 1 | -1 }>({ column: 0, direction: 1 });
  const rawValue = (cell: string | ReactNode) => typeof cell === "string" ? cell : isValidElement(cell) ? Number((cell.props as { "data-sort-value"?: number })["data-sort-value"] ?? 0) : 0;
  const levelColumn = headers.indexOf("Nível");
  const levelRank = (value: string) => value.toLowerCase().includes("estagi") ? 0 : Number(value.match(/\d+/)?.[0] ?? 99);
  const cellClass = (column: number) => column === highlightColumn ? "total-column" : blueColumns.includes(column) ? "report-blue-column" : "";
  const sortedRows = sortable ? [...rows].sort((a, b) => {
    const aRaw = rawValue(a[sort.column]);
    const bRaw = rawValue(b[sort.column]);
    const av = sort.column === levelColumn ? levelRank(String(aRaw)) : aRaw;
    const bv = sort.column === levelColumn ? levelRank(String(bRaw)) : bRaw;
    return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true })) * sort.direction;
  }) : rows;
  const toggleSort = (column: number) => setSort(current => current.column === column ? { column, direction: current.direction === 1 ? -1 : 1 } : { column, direction: 1 });
  return <div className="table-wrap responsive-card-table">{sortable && <div className="mobile-sort-controls"><label>Ordenar por<select value={sort.column} onChange={event => setSort({ column: Number(event.target.value), direction: 1 })}>{headers.map((header, index) => <option key={header} value={index}>{header}</option>)}</select></label><button type="button" onClick={() => setSort(current => ({ ...current, direction: current.direction === 1 ? -1 : 1 }))}>{sort.direction === 1 ? "Crescente ↑" : "Decrescente ↓"}</button></div>}<table><thead><tr>{headers.map((header, index) => <th className={cellClass(index)} key={header}>{sortable ? <button type="button" className="sort-header" onClick={() => toggleSort(index)}>{header}<span>{sort.column === index ? sort.direction === 1 ? "▲" : "▼" : "↕"}</span></button> : header}</th>)}</tr></thead><tbody>{sortedRows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td data-label={headers[cellIndex]} className={cellClass(cellIndex)} key={cellIndex}>{cell === "Pendente" || cell === "Aprovada" ? <span className={`pill ${cell === "Pendente" ? "pending" : "approved"}`}>{cell}</span> : cell}</td>)}</tr>)}</tbody></table></div>;
}
