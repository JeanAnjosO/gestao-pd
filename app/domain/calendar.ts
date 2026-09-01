import { ASSIGNMENT_TYPES, PERSON_TYPES, RECEPTION_PRIORITY_PERSON_IDS } from "./constants";
import type { CalendarAssignmentRow, PersonRow } from "./types";

type AssignmentLike = Pick<CalendarAssignmentRow, "date" | "assignment_type_id" | "class_type_id" | "person_id">;

type SelectionInput = {
  date: string;
  type: number;
  classId: number | null;
  existingAssignments: AssignmentLike[];
  generatedAssignments: AssignmentLike[];
  candidates: PersonRow[];
  classSlots: readonly { id: number }[];
  counts: Map<number, number>;
  random?: () => number;
};

export function chooseCalendarPerson({ date, type, classId, existingAssignments, generatedAssignments, candidates, classSlots, counts, random = Math.random }: SelectionInput) {
  const allAssignments = [...existingAssignments, ...generatedAssignments];
  const assignedSoFar = allAssignments.filter(item => item.date === date);
  const unavailable = new Set(
    assignedSoFar
      .filter(item => type === ASSIGNMENT_TYPES.reception || item.assignment_type_id === ASSIGNMENT_TYPES.reception || item.class_type_id === classId)
      .map(item => item.person_id),
  );
  const available = candidates.filter(person => !unavailable.has(person.id));
  let person: PersonRow | undefined;

  if (type === ASSIGNMENT_TYPES.reception) {
    const fixedReception = available.filter(item => item.person_type_id === PERSON_TYPES.reception);
    const priorityGroup = available.filter(item => item.person_type_id !== PERSON_TYPES.reception && RECEPTION_PRIORITY_PERSON_IDS.includes(item.id));
    const remainingGroup = available.filter(item => item.person_type_id !== PERSON_TYPES.reception && !RECEPTION_PRIORITY_PERSON_IDS.includes(item.id));
    const drawPool = fixedReception.length ? fixedReception : priorityGroup.length ? priorityGroup : remainingGroup;
    person = drawPool[Math.floor(random() * drawPool.length)];
  } else {
    const classIndex = classSlots.findIndex(item => item.id === classId);
    const previousClassId = classIndex > 0 ? classSlots[classIndex - 1].id : undefined;
    const previousPersonId = previousClassId === undefined ? undefined : assignedSoFar.find(item => item.assignment_type_id === type && item.class_type_id === previousClassId)?.person_id;
    const rotationPool = available.some(item => item.id !== previousPersonId) ? available.filter(item => item.id !== previousPersonId) : available;
    const target = new Date(`${date}T12:00:00Z`);
    const mondayOffset = (target.getUTCDay() + 6) % 7;
    const weekStart = new Date(target); weekStart.setUTCDate(target.getUTCDate() - mondayOffset);
    const weekEnd = new Date(weekStart); weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);
    const repeatedThisWeek = new Set(allAssignments
      .filter(item => item.assignment_type_id === type && item.date >= weekStartIso && item.date <= weekEndIso)
      .map(item => item.person_id));
    const weeklyPool = rotationPool.some(item => !repeatedThisWeek.has(item.id))
      ? rotationPool.filter(item => !repeatedThisWeek.has(item.id))
      : rotationPool;
    const roleCount = (personId: number) => allAssignments.filter(item => item.person_id === personId && item.assignment_type_id === type).length;
    const lowestRoleCount = weeklyPool.length ? Math.min(...weeklyPool.map(item => roleCount(item.id))) : 0;
    const roleBalancedPool = weeklyPool.filter(item => roleCount(item.id) === lowestRoleCount);
    const lowestTotalCount = roleBalancedPool.length ? Math.min(...roleBalancedPool.map(item => counts.get(item.id) ?? 0)) : 0;
    const balancedPool = roleBalancedPool.filter(item => (counts.get(item.id) ?? 0) === lowestTotalCount);
    person = balancedPool[Math.floor(random() * balancedPool.length)];
  }

  if (!person) return null;
  counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
  return person.id;
}
