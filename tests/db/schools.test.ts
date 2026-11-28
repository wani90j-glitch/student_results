/** Many schools and school roles: who sees what. */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, freshDb } from "./pg";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const SCH = id(1), OTHER = id(2);
const P = id(11), AD = id(12), SD = id(13), CO = id(14);           // principal, academic deputy, student deputy, counselor
const TJ = id(21), TI = id(22), TR = id(23), TO = id(24);           // joined teacher, individual teacher (same school), requested, other school
const UX = id(31), UY = id(32), UG = id(33), G = id(40);           // student X, student Y, parent of both
const CJ = id(51), CI = id(52), CR = id(53), CO2 = id(54);

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
  await db.exec(`
    insert into auth.users (id) values ('${P}'),('${AD}'),('${SD}'),('${CO}'),('${TJ}'),('${TI}'),('${TR}'),('${TO}'),('${UX}'),('${UY}'),('${UG}');
    insert into schools (id, name, plan, ministry_no) values ('${SCH}','المتوسطة الأولى','school','111'),('${OTHER}','مدرسة أخرى','none','222');
    insert into teachers (id, school_id, display_name) values ('${TJ}','${SCH}','منضمة'),('${TI}','${SCH}','فردية'),('${TR}','${SCH}','طلبت'),('${TO}','${OTHER}','أخرى');
    insert into school_members (school_id, user_id, role, status) values
      ('${SCH}','${P}','principal','active'),('${SCH}','${AD}','academic_deputy','active'),('${SCH}','${SD}','student_deputy','active'),('${SCH}','${CO}','counselor','active'),
      ('${SCH}','${TJ}','teacher','active'),('${SCH}','${TR}','teacher','requested');
    insert into classes (id, school_id, teacher_id, name) values ('${CJ}','${SCH}','${TJ}','3/1'),('${CI}','${SCH}','${TI}','3/1'),('${CR}','${SCH}','${TR}','3/1'),('${CO2}','${OTHER}','${TO}','3/1');
    -- student X is taught by the joined teacher (science) and the individual teacher (maths); Y only by the joined one
    insert into students (id, school_id, teacher_id, class_id, seat_no, name, pin_lookup) values
      ('x_j','${SCH}','${TJ}','${CJ}',1,'س','LX'),('x_i','${SCH}','${TI}','${CI}',1,'س','LX'),('y_j','${SCH}','${TJ}','${CJ}',2,'ص','LY'),
      ('r1','${SCH}','${TR}','${CR}',1,'ع','LR'),('o1','${OTHER}','${TO}','${CO2}',1,'ق','LO');
    insert into student_identities (pin_lookup, pin_hash, auth_user_id) values ('LX','h','${UX}'),('LY','h','${UY}');
    insert into guardians (id, auth_user_id) values ('${G}','${UG}');
    insert into parent_codes (code_lookup, code_hash, student_pin_lookup, guardian_id) values ('c1','h','LX','${G}'),('c2','h','LY','${G}');
    insert into tests (id, school_id, teacher_id, name, type, date, qs) values
      ('tj','${SCH}','${TJ}','علوم','p1','2026-10-18','[]'),('ti','${SCH}','${TI}','رياضيات','p1','2026-10-18','[]'),('tr','${SCH}','${TR}','x','p1','2026-10-18','[]'),('to','${OTHER}','${TO}','x','p1','2026-10-18','[]');
    insert into test_results values ('tj','x_j','${SCH}','${TJ}','{1}'),('tj','y_j','${SCH}','${TJ}','{0}'),('ti','x_i','${SCH}','${TI}','{1}'),('tr','r1','${SCH}','${TR}','{1}'),('to','o1','${OTHER}','${TO}','{1}');
    insert into behavior_events (id, student_id, school_id, teacher_id, kind, type, date, shared) values
      ('bj','x_j','${SCH}','${TJ}','neg','تأخر','2026-10-20',false),('bi','x_i','${SCH}','${TI}','neg','تأخر','2026-10-20',false);
    insert into questions (id, school_id, teacher_id, type, text) values ('qj','${SCH}','${TJ}','mc','سؤال');
  `);
});
const ids = async (q: any, sql: string) => (await q(sql)).map((r: any) => Object.values(r)[0]).sort();

describe("student and parent across teachers", () => {
  it("a student signs in once and sees her records from every teacher who has her, nobody else's", async () => {
    await as(db, UX, async (q) => {
      expect(await ids(q, "select id from students")).toEqual(["x_i", "x_j"]);
      expect(await ids(q, "select test_id from test_results")).toEqual(["ti", "tj"]);
    });
  });
  it("one parent account follows both daughters", async () => {
    await as(db, UG, async (q) => {
      expect(await ids(q, "select id from students")).toEqual(["x_i", "x_j", "y_j"]);
      expect(await ids(q, "select student_id from test_results")).toEqual(["x_i", "x_j", "y_j"]);
    });
  });
});

describe("school staff", () => {
  it("the principal reads only the teachers who joined the school (not individual or pending ones)", async () => {
    await as(db, P, async (q) => {
      expect(await ids(q, "select id from tests")).toEqual(["tj"]);
      expect(await ids(q, "select student_id from test_results")).toEqual(["x_j", "y_j"]);
      expect(await ids(q, "select id from behavior_events")).toEqual(["bj"]);
      expect(await ids(q, "select display_name from teachers")).toEqual(["منضمة"]);
      expect((await q("select count(*)::int n from school_members"))[0].n).toBe(6);
    });
  });
  it("each role reads only its share", async () => {
    await as(db, AD, async (q) => { // academic deputy: results, not behaviour
      expect(await ids(q, "select student_id from test_results")).toEqual(["x_j", "y_j"]);
      expect(await q("select * from behavior_events")).toEqual([]);
      expect(await ids(q, "select id from questions")).toEqual(["qj"]);
    });
    await as(db, SD, async (q) => { // student deputy: behaviour and roster, not results
      expect(await ids(q, "select id from behavior_events")).toEqual(["bj"]);
      expect(await q("select * from test_results")).toEqual([]);
      expect(await ids(q, "select id from students")).toEqual(["x_j", "y_j"]);
    });
    await as(db, CO, async (q) => { // counselor: results (early warning) and behaviour, not the question bank
      expect(await ids(q, "select student_id from test_results")).toEqual(["x_j", "y_j"]);
      expect(await ids(q, "select id from behavior_events")).toEqual(["bj"]);
      expect(await q("select * from questions")).toEqual([]);
    });
  });
  it("staff never change teachers' work", async () => {
    await as(db, P, async (q) => {
      expect(await q("update test_results set marks = '{0}' where student_id = 'x_j' returning student_id")).toEqual([]);
      await expect(q(`insert into tests (id, school_id, teacher_id, name, type, date, qs) values ('z','${SCH}','${TJ}','z','p1','2026-01-01','[]')`)).rejects.toThrow();
    });
  });
  it("a school that is not subscribed opens nothing to its staff", async () => {
    await db.exec(`update schools set plan = 'none' where id = '${SCH}'`);
    await as(db, P, async (q) => { expect(await q("select * from tests")).toEqual([]); });
    await db.exec(`update schools set plan = 'school' where id = '${SCH}'`);
  });
});

describe("teachers", () => {
  it("a teacher who wrote the wrong school (or did not join) sees only her own work", async () => {
    await as(db, TI, async (q) => {
      expect(await ids(q, "select id from tests")).toEqual(["ti"]);
      expect(await ids(q, "select id from students")).toEqual(["x_i"]);
      expect(await q("select * from school_members")).toEqual([]);
    });
    await as(db, TR, async (q) => { // asked to join: nothing opens before the principal approves
      expect(await ids(q, "select id from tests")).toEqual(["tr"]);
      expect((await q("select status from school_members"))[0].status).toBe("requested");
    });
  });
  it("identities and parent codes are never readable from the app", async () => {
    await as(db, UX, async (q) => {
      expect(await q("select * from student_identities")).toEqual([]);
      expect(await q("select * from parent_codes")).toEqual([]);
    });
  });
});
