import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../app/domain/student-report.ts', import.meta.url), 'utf8');
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 });
const { calculateCloudgymReport, compareEnrolledPeople, previousStudentCompetence, studentDeltaLabel, studentTrendLabel } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const sheet = (...rows) => [[], [], ...rows];
const row = (name, payment = 'Mensal', gross = 0) => [name, '', '', '', '', payment, '', gross];

test('compares eligible unique names, ignoring case and extra spaces in both months', () => {
  const previous = calculateCloudgymReport(sheet(row('Ana'), row('Bruno'), row(' Carla '), row('Parceiro', 'Gympass'), row('Total', 'TotalPass', 181)));
  const current = calculateCloudgymReport(sheet(row('  ANA  '), row('ana'), row('Carla'), row('Diego'), row('Parceiro', ' gymPASS '), row('Total', ' TOTALpass ', 181)));
  assert.equal(current.enrolled, 3);
  assert.equal(current.frequentTotalPass, 1);
  assert.deepEqual(compareEnrolledPeople(current.enrolledPeople, previous.enrolledPeople), { lost: ['Bruno'], added: ['Diego'] });
});

test('handles partner transitions, empty months, and identical enrollments', () => {
  const previous = calculateCloudgymReport(sheet(row('Ana'), row('Bruno', 'Gympass')));
  const current = calculateCloudgymReport(sheet(row('Ana', 'TotalPass'), row('Bruno')));
  assert.deepEqual(compareEnrolledPeople(current.enrolledPeople, previous.enrolledPeople), { lost: ['Ana'], added: ['Bruno'] });
  assert.deepEqual(compareEnrolledPeople([], []), { lost: [], added: [] });
  assert.deepEqual(compareEnrolledPeople(['Ana'], ['ana']), { lost: [], added: [] });
  assert.deepEqual(compareEnrolledPeople([], ['Ana']), { lost: ['Ana'], added: [] });
  assert.deepEqual(calculateCloudgymReport(sheet()).enrolledPeople, []);
});

test('uses the immediately preceding competence including year boundaries', () => {
  assert.equal(previousStudentCompetence('2026-01'), '2025-12');
  assert.equal(previousStudentCompetence('2026-10'), '2026-09');
});

test('distinguishes unavailable comparison, zero, growth and deficit', () => {
  assert.equal(studentDeltaLabel(null), 'Sem comparação');
  assert.equal(studentDeltaLabel(0), 'Sem alteração (0)');
  assert.equal(studentDeltaLabel(4), 'Aumento de 4');
  assert.equal(studentDeltaLabel(-3), 'Déficit de 3');
});

test("monthly metric trends handle missing history, zero, singular and plural", () => {
 assert.equal(studentTrendLabel(3, null), "Sem comparação com o mês passado");
 assert.equal(studentTrendLabel(null, 3), "Sem comparação com o mês passado");
 assert.equal(studentTrendLabel(0, 0), "→ Sem alteração em relação ao mês passado");
 assert.equal(studentTrendLabel(4, 3), "↑ Maior que mês passado por 1 aluno");
 assert.equal(studentTrendLabel(0, 3), "↓ Menor que mês passado por 3 alunos");
});
