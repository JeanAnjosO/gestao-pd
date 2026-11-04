import test from "node:test";
import assert from "node:assert/strict";
import { calculateCloudgymReport, calculateHighestFrequencyReport, calculateWellhubReport } from "../app/domain/student-report.ts";

test("calculates Wellhub indicators from columns C and E starting at row 11", () => {
  const rows = Array.from({ length: 10 }, () => []);
  rows.push(
    [null, null, "Alice", null, 12],
    [null, null, "Bruno", null, 8],
    [null, null, "Carla", null, 7],
    [null, null, "Daniel", null, 18],
  );
  assert.deepEqual(calculateWellhubReport(rows), {
    frequent: 3,
    twelveOrMore: 2,
    belowFour: 0,
    belowEight: 1,
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
    ["Bruno", null, null, null, null, "TotalPass", null, "180,50"],
    ["Carla", null, null, null, null, "TotalPass", null, 180],
    ["Daniel", null, null, null, null, "Gympass", null, 150],
  ];
  assert.deepEqual(calculateCloudgymReport(rows), { enrolled: 1, frequentTotalPass: 1, enrolledPeople: ["Ana"] });
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

test("frequency thresholds include 8 check-ins and exclude exactly 180 in TotalPass", () => {
 const rows = Array.from({ length: 10 }, () => []);
 for (const count of [0, 4, 7, 8, 11, 12]) rows.push([null, null, "Aluno " + count, null, count]);
 const wellhub = calculateWellhubReport(rows);
 assert.equal(wellhub.frequent, 3);
 assert.equal(wellhub.belowEight, 3);
 assert.equal(wellhub.twelveOrMore, 1);
 const cloud = calculateCloudgymReport([[], [],
 ["Ana", null, null, null, null, "TotalPass", null, 180],
 ["Ana", null, null, null, null, "TotalPass", null, 180.01],
 [" ana ", null, null, null, null, " TOTALPASS ", null, 200],
 ["Bruno", null, null, null, null, "TotalPass", null, 90],
 ["Bruno", null, null, null, null, "TotalPass", null, 100],
 ["Carla", null, null, null, null, "Gympass", null, 500]]);
 assert.equal(cloud.frequentTotalPass, 1);
});
