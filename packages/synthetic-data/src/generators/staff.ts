import { DEPARTMENTS, type Department, type StaffRole } from "@caduward/shared";
import type { TransformedPatient } from "../fhir/transform.js";
import type { SeededRandom } from "../random.js";

export interface GeneratedStaff {
  id: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  department: Department;
  shiftStart: string; // HH:MM format
  shiftEnd: string;
  address: string;
  isActive: boolean;
  /** When set, this staff member IS this patient (self-access scenario). */
  patientId: string | null;
}

const FIRST_NAMES = [
  "Emma",
  "Liam",
  "Olivia",
  "Noah",
  "Ava",
  "Ethan",
  "Sophia",
  "Mason",
  "Isabella",
  "William",
  "Mia",
  "James",
  "Charlotte",
  "Oliver",
  "Amelia",
  "Benjamin",
  "Harper",
  "Elijah",
  "Evelyn",
  "Lucas",
  "Abigail",
  "Henry",
  "Emily",
  "Alexander",
  "Ella",
  "Michael",
  "Elizabeth",
  "Daniel",
  "Sofia",
  "Matthew",
  "Grace",
  "Jackson",
  "Victoria",
  "Samuel",
  "Chloe",
  "Sebastian",
  "Penelope",
  "David",
  "Riley",
  "Joseph",
  "Layla",
  "Carter",
  "Lillian",
  "Owen",
  "Nora",
  "Wyatt",
  "Zoey",
  "John",
  "Hannah",
  "Jack",
];

const LAST_NAMES = [
  "Chen",
  "Park",
  "Kim",
  "Singh",
  "Patel",
  "Nguyen",
  "Lee",
  "Garcia",
  "Martinez",
  "Robinson",
  "Clark",
  "Lewis",
  "Walker",
  "Hall",
  "Allen",
  "Young",
  "Wright",
  "King",
  "Scott",
  "Torres",
  "Adams",
  "Nelson",
  "Baker",
  "Rivera",
  "Campbell",
  "Mitchell",
  "Carter",
  "Roberts",
  "Phillips",
  "Evans",
  "Turner",
  "Collins",
  "Stewart",
  "Morris",
  "Rogers",
  "Reed",
  "Cook",
  "Morgan",
  "Bell",
  "Murphy",
  "Bailey",
  "Cooper",
  "Richardson",
  "Cox",
  "Howard",
  "Ward",
  "Brooks",
  "Gray",
  "Watson",
  "James",
];

const STREETS = [
  "Oak Ave",
  "Pine St",
  "Maple Dr",
  "Cedar Ln",
  "Birch Rd",
  "Walnut St",
  "Willow Way",
  "Spruce Ct",
  "Ash Blvd",
  "Cherry Ln",
];

const CITIES = ["Riverside", "Lakewood", "Brookside", "Greenfield", "Hillcrest"];
const STATES = ["MA", "CT", "NY", "PA", "NJ"];

const ROLE_WEIGHTS: Record<StaffRole, number> = {
  nurse: 0.4,
  physician: 0.25,
  admin: 0.15,
  lab_tech: 0.1,
  radiologist: 0.1,
};

const SHIFT_SCHEDULES: Array<{ start: string; end: string }> = [
  { start: "06:00", end: "14:00" }, // day shift
  { start: "07:00", end: "15:00" },
  { start: "08:00", end: "16:00" },
  { start: "14:00", end: "22:00" }, // evening shift
  { start: "15:00", end: "23:00" },
  { start: "22:00", end: "06:00" }, // night shift
];

function generateAddress(rng: SeededRandom): string {
  const num = rng.int(100, 9999);
  const street = rng.pick(STREETS);
  const city = rng.pick(CITIES);
  const state = rng.pick(STATES);
  const zip = rng.int(10000, 99999);
  return `${num} ${street}, ${city}, ${state}, ${zip}`;
}

function generateUuid(rng: SeededRandom): string {
  const hex = "0123456789abcdef";
  let result = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += "-";
    } else if (i === 14) {
      result += "4";
    } else if (i === 19) {
      result += hex[rng.int(8, 11)];
    } else {
      result += hex[rng.int(0, 15)];
    }
  }
  return result;
}

export interface StaffGeneratorConfig {
  staffCount: number;
  /** Fraction of staff that share a last name with a patient (relationship-snoop scenario) */
  relationshipSnoopRate?: number;
  /** Fraction of staff that are inactive (dormant reactivation scenario) */
  dormantRate?: number;
  /** Fraction of staff that match a patient identity (self-access scenario) */
  selfAccessRate?: number;
}

export function generateStaff(
  patients: TransformedPatient[],
  config: StaffGeneratorConfig,
  rng: SeededRandom,
): GeneratedStaff[] {
  const {
    staffCount,
    relationshipSnoopRate = 0.05,
    dormantRate = 0.05,
    selfAccessRate = 0.02,
  } = config;

  const staff: GeneratedStaff[] = [];

  const snoopCount = Math.ceil(staffCount * relationshipSnoopRate);
  const dormantCount = Math.ceil(staffCount * dormantRate);
  const selfAccessCount = Math.min(Math.ceil(staffCount * selfAccessRate), patients.length);

  for (let i = 0; i < staffCount; i++) {
    const role = rng.weightedPick(ROLE_WEIGHTS);
    const department = rng.pick([...DEPARTMENTS]);
    const shift = rng.pick(SHIFT_SCHEDULES);
    const isDormant = i >= staffCount - dormantCount;

    let firstName: string;
    let lastName: string;
    let address: string;
    let patientId: string | null = null;

    if (i < selfAccessCount && i < patients.length) {
      // Self-access candidates: mirror a patient's identity and link by ID
      const patient = patients[i];
      firstName = patient.firstName;
      lastName = patient.lastName;
      address = patient.address;
      patientId = patient.id;
    } else if (i < selfAccessCount + snoopCount) {
      // Relationship-snoop candidates: share last name with a patient
      const patient = rng.pick(patients);
      firstName = rng.pick(FIRST_NAMES);
      lastName = patient.lastName;
      address = rng.chance(0.3) ? patient.address : generateAddress(rng);
    } else {
      firstName = rng.pick(FIRST_NAMES);
      lastName = rng.pick(LAST_NAMES);
      address = generateAddress(rng);
    }

    staff.push({
      id: generateUuid(rng),
      firstName,
      lastName,
      role,
      department,
      shiftStart: shift.start,
      shiftEnd: shift.end,
      address,
      isActive: !isDormant,
      patientId,
    });
  }

  return rng.shuffle(staff);
}
