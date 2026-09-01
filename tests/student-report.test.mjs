import test from "node:test";
import assert from "node:assert/strict";
import { calculateCloudgymReport, calculateHighestFrequencyReport, calculateWellhubReport } from "../app/domain/student-report.ts";

test("calculates Wellhub indicators from columns C and E starting at row 11", () => {
  const rows = Array.from({ length: 10 }, () => []);
  rows.push(
    [null, null, "Alice", null, 12],
    [null, null, "Bruno", null, 4],
    [null, null, "Carla", null, 3],
    [null, null, "Daniel", null, 18],
  );
  assert.deepEqual(calculateWellhubReport(rows), {
    frequent: 3,
    twelveOrMore: 2,
    belowFour: 1,
    twelveOrMorePeople: [
      { name: "Daniel", checkins: 18 },
      { name: "Alice", checkins: 12 },
    ],
  });
});

test("deduplicates CloudGym names and applies payment rules", () => {
  const rows = [[], [],
    ["Ana", null, null, null, null, "Cartão", null, "R$ 120,00"],
    [" ana ", null, null, null, null, "Pix", null, 80],
    ["Bruno", null, null, null, null, "TotalPass", null, "100,50"],
    ["Carla", null, null, null, null, "TotalPass", null, 90],
    ["Daniel", null, null, null, null, "Gympass", null, 150],
  ];
  assert.deepEqual(calculateCloudgymReport(rows), { enrolled: 1, frequentTotalPass: 1 });
});

test("ranks the 20 most repeated names from column B starting at row 3", () => {
  const rows = [[], [],
    [null, "Ana"], [null, "Bruno"], [null, " ana "], [null, "Carla"],
    [null, "ANA"], [null, "Bruno"], [null, "Daniel"],
  ];
  assert.deepEqual(calculateHighestFrequencyReport(rows), {
    topPeople: [
      { name: "Ana", days: 3 },
      { name: "Bruno", days: 2 },
      { name: "Carla", days: 1 },
      { name: "Daniel", days: 1 },
    ],
  });
});
