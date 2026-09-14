/**
 * Generates a synthetic FHIR bundle fixture for development/testing.
 * Run with: npx tsx packages/synthetic-data/scripts/generate-fixture.ts
 *
 * This replaces the need to install and run Synthea locally.
 * The generated data mimics Synthea's FHIR Bundle output format.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const FIRST_NAMES = [
  "James",
  "Mary",
  "Robert",
  "Patricia",
  "John",
  "Jennifer",
  "Michael",
  "Linda",
  "David",
  "Elizabeth",
  "William",
  "Barbara",
  "Richard",
  "Susan",
  "Joseph",
  "Jessica",
  "Thomas",
  "Sarah",
  "Christopher",
  "Karen",
  "Charles",
  "Lisa",
  "Daniel",
  "Nancy",
  "Matthew",
  "Betty",
  "Anthony",
  "Margaret",
  "Mark",
  "Sandra",
  "Donald",
  "Ashley",
  "Steven",
  "Dorothy",
  "Andrew",
  "Kimberly",
  "Paul",
  "Emily",
  "Joshua",
  "Donna",
  "Kenneth",
  "Michelle",
  "Kevin",
  "Carol",
  "Brian",
  "Amanda",
  "George",
  "Melissa",
  "Timothy",
  "Deborah",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
  "Taylor",
  "Moore",
  "Jackson",
  "Martin",
  "Lee",
  "Perez",
  "Thompson",
  "White",
  "Harris",
  "Sanchez",
  "Clark",
  "Ramirez",
  "Lewis",
  "Robinson",
  "Walker",
  "Young",
  "Allen",
  "King",
  "Wright",
  "Scott",
  "Torres",
  "Nguyen",
  "Hill",
  "Flores",
  "Green",
  "Adams",
  "Nelson",
  "Baker",
  "Hall",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
];

const STREETS = [
  "Main St",
  "Oak Ave",
  "Elm St",
  "Park Blvd",
  "Cedar Ln",
  "Maple Dr",
  "Washington Ave",
  "Lake Rd",
  "Hill St",
  "River Rd",
];

const CITIES = [
  "Springfield",
  "Georgetown",
  "Franklin",
  "Clinton",
  "Fairview",
  "Madison",
  "Arlington",
  "Chester",
  "Salem",
  "Bristol",
];

const STATES = ["MA", "CT", "NY", "PA", "NJ", "NH", "VT", "ME", "RI", "MD"];

const ENCOUNTER_CLASSES = ["ambulatory", "outpatient", "inpatient", "emergency", "wellness"];

const PROVIDER_NAMES = [
  "Dr. Sarah Chen",
  "Dr. Michael Park",
  "Dr. Emily Rodriguez",
  "Dr. James Wilson",
  "Dr. Lisa Thompson",
  "Dr. Robert Kim",
  "Dr. Maria Santos",
  "Dr. David Brown",
  "Dr. Jennifer Lee",
  "Dr. William Taylor",
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function uuid(rng: () => number): string {
  const hex = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += "-";
    } else if (i === 14) {
      result += "4";
    } else if (i === 19) {
      result += hex[Math.floor(rng() * 4) + 8];
    } else {
      result += hex[Math.floor(rng() * 16)];
    }
  }
  return result;
}

const PATIENT_COUNT = 50;
const MIN_ENCOUNTERS_PER_PATIENT = 2;
const MAX_ENCOUNTERS_PER_PATIENT = 8;

const rng = seededRandom(42);

interface FhirEntry {
  resource: Record<string, unknown>;
}

const entries: FhirEntry[] = [];
const patientIds: string[] = [];

// Generate patients
for (let i = 0; i < PATIENT_COUNT; i++) {
  const id = uuid(rng);
  patientIds.push(id);

  const birthYear = 1940 + Math.floor(rng() * 60);
  const birthMonth = String(1 + Math.floor(rng() * 12)).padStart(2, "0");
  const birthDay = String(1 + Math.floor(rng() * 28)).padStart(2, "0");

  const hasContact = rng() < 0.7;

  const patient: Record<string, unknown> = {
    resourceType: "Patient",
    id,
    name: [
      {
        family: pick(LAST_NAMES, rng),
        given: [pick(FIRST_NAMES, rng)],
      },
    ],
    birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
    address: [
      {
        line: [`${Math.floor(rng() * 9999) + 1} ${pick(STREETS, rng)}`],
        city: pick(CITIES, rng),
        state: pick(STATES, rng),
        postalCode: String(10000 + Math.floor(rng() * 89999)),
      },
    ],
  };

  if (hasContact) {
    patient.contact = [
      {
        relationship: [{ text: "Emergency Contact" }],
        name: {
          family: pick(LAST_NAMES, rng),
          given: [pick(FIRST_NAMES, rng)],
        },
      },
    ];
  }

  entries.push({ resource: patient });
}

// Generate encounters for each patient
for (const patientId of patientIds) {
  const numEncounters =
    MIN_ENCOUNTERS_PER_PATIENT +
    Math.floor(rng() * (MAX_ENCOUNTERS_PER_PATIENT - MIN_ENCOUNTERS_PER_PATIENT + 1));

  for (let j = 0; j < numEncounters; j++) {
    const daysAgo = Math.floor(rng() * 90);
    const hour = 6 + Math.floor(rng() * 14); // 6am to 8pm
    const startDate = new Date(2025, 0, 15);
    startDate.setDate(startDate.getDate() - daysAgo);
    startDate.setHours(hour, Math.floor(rng() * 60), 0, 0);

    const durationMinutes = 15 + Math.floor(rng() * 120);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

    const encounterClass = pick(ENCOUNTER_CLASSES, rng);

    entries.push({
      resource: {
        resourceType: "Encounter",
        id: uuid(rng),
        subject: { reference: `Patient/${patientId}` },
        participant: [
          {
            individual: {
              display: pick(PROVIDER_NAMES, rng),
            },
          },
        ],
        class: { code: encounterClass },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        type: [{ text: encounterClass === "emergency" ? "Emergency visit" : "Office visit" }],
      },
    });
  }
}

const bundle = {
  resourceType: "Bundle",
  type: "collection",
  entry: entries,
};

const outPath = join(import.meta.dirname, "..", "fixtures", "synthea-bundle.json");
writeFileSync(outPath, JSON.stringify(bundle, null, 2));

const encounterCount = entries.length - PATIENT_COUNT;
console.log(`Generated FHIR bundle: ${PATIENT_COUNT} patients, ${encounterCount} encounters`);
console.log(`Written to: ${outPath}`);
