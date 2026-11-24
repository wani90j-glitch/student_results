/** Row Level Security: who can read and write what. */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, freshDb } from "./pg";

const T1 = "11111111-1111-1111-1111-111111111111"; // teacher A
const T2 = "22222222-2222-2222-2222-222222222222"; // teacher B, another school
const U_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // student s_a (teacher A)
const U_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // student s_b (teacher A, same class)
const SC1 = "00000000-0000-0000-0000-0000000000a1", SC2 = "00000000-0000-0000-0000-0000000000a2";
const C1 = "00000000-0000-0000-0000-0000000000c1", C2 = "00000000-0000-0000-0000-0000000000c2";

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
  await db.exec(`
    insert into auth.users (id) values ('${T1}'),('${T2}'),('${U_A}'),('${U_B}');
    insert into schools (id, name) values ('${SC1}','مدرسة أ'),('${SC2}','مدرسة ب');
    insert into teachers (id, school_id, display_name) values ('${T1}','${SC1}','معلمة أ'),('${T2}','${SC2}','معلمة ب');
    insert into classes (id, school_id, teacher_id, name) values ('${C1}','${SC1}','${T1}','3/1'),('${C2}','${SC2}','${T2}','3/1');
    insert into students (id, school_id, teacher_id, class_id, seat_no, name, pin_lookup, pin_hash, auth_user_id) values
      ('s_a','${SC1}','${T1}','${C1}',1,'طالبة أ','lookupA','hashA','${U_A}'),
      ('s_b','${SC1}','${T1}','${C1}',2,'طالبة ب','lookupB','hashB','${U_B}'),
      ('s_x','${SC2}','${T2}','${C2}',1,'طالبة س','lookupX','hashX',null);
    insert into skills (id, school_id, teacher_id, chapter, level, name) values ('k1','${SC1}','${T1}','ف1','K','مهارة');
    insert into tests (id, school_id, teacher_id, name, type, date, qs) values ('t1','${SC1}','${T1}','اختبار','p1','2026-10-18','[{"id":"q1","ans":2,"key":"سر"}]');
    insert into test_results values ('t1','s_a','${SC1}','${T1}','{1,0}'), ('t1','s_b','${SC1}','${T1}','{1,1}');
    insert into sheets (school_id, teacher_id, student_id, key, storage_path, sent_at) values
      ('${SC1}','${T1}','s_a','t1','a.jpg', now()), ('${SC1}','${T1}','s_b','t1','b.jpg', null);
    insert into behavior_events (id, student_id, school_id, teacher_id, kind, type, date, shared) values
      ('b1','s_a','${SC1}','${T1}','pos','مشاركة','2026-10-20',true), ('b2','s_a','${SC1}','${T1}','neg','تأخر','2026-10-21',false);
  `);
});

describe("anonymous visitor", () => {
  it("reads nothing", async () => {
    await as(db, null, async (q) => {
      await expect(q("select * from students")).rejects.toThrow();
      await expect(q("select * from test_results")).rejects.toThrow();
    });
  });
});

describe("student", () => {
  it("sees only her own student row, results and sent sheets", async () => {
    await as(db, U_A, async (q) => {
      expect((await q("select id from students")).map((r) => r.id)).toEqual(["s_a"]);
      expect((await q("select student_id from test_results")).map((r) => r.student_id)).toEqual(["s_a"]);
      expect((await q("select storage_path from sheets")).map((r) => r.storage_path)).toEqual(["a.jpg"]);
    });
    await as(db, U_B, async (q) => {
      expect(await q("select * from sheets")).toEqual([]); // her sheet was not sent yet
    });
  });
  it("cannot read the PIN columns, the test papers (answer keys) or other schools", async () => {
    await as(db, U_A, async (q) => {
      await expect(q("select pin_hash from students")).rejects.toThrow(/permission denied/);
      await expect(q("select pin_lookup from students")).rejects.toThrow(/permission denied/);
      expect(await q("select * from tests")).toEqual([]);
      expect(await q("select * from questions")).toEqual([]);
      expect(await q("select * from improvement_rounds")).toEqual([]);
      expect((await q("select name from schools")).map((r) => r.name)).toEqual(["مدرسة أ"]);
    });
  });
  it("sees only behaviour notes the teacher shared, and may only mark them seen", async () => {
    await as(db, U_A, async (q) => {
      expect((await q("select id from behavior_events")).map((r) => r.id)).toEqual(["b1"]);
      await q("update behavior_events set parent_seen_at = now() where id = 'b1'");
      await expect(q("update behavior_events set type = 'x' where id = 'b1'")).rejects.toThrow();
    });
  });
  it("can acknowledge and write a parent note only for herself", async () => {
    await as(db, U_A, async (q) => {
      await q(`insert into acks (student_id, key, school_id) values ('s_a','t1','${SC1}')`);
      await q(`insert into notes (student_id, school_id, by, text) values ('s_a','${SC1}','p','شكرًا')`);
      await expect(q(`insert into acks (student_id, key, school_id) values ('s_b','t1','${SC1}')`)).rejects.toThrow();
      await expect(q(`insert into notes (student_id, school_id, by, text) values ('s_a','${SC1}','t','انتحال')`)).rejects.toThrow();
    });
  });
  it("cannot change results or give herself stars", async () => {
    await as(db, U_A, async (q) => {
      expect(await q("update test_results set marks = '{1,1}' where student_id = 's_a' returning *")).toEqual([]);
      expect(await q("update students set stars = 99 where id = 's_a' returning id")).toEqual([]);
    });
  });
});

describe("teacher", () => {
  it("reads and writes only her own classes", async () => {
    await as(db, T1, async (q) => {
      expect((await q("select id from students order by id")).map((r) => r.id)).toEqual(["s_a", "s_b"]);
      expect((await q("select id from tests")).map((r) => r.id)).toEqual(["t1"]);
      expect(await q("update test_results set marks = '{0,0}' where student_id = 's_b' returning student_id")).toHaveLength(1);
      expect((await q("select id from behavior_events order by id")).map((r) => r.id)).toEqual(["b1", "b2"]);
    });
    await as(db, T2, async (q) => {
      expect((await q("select id from students")).map((r) => r.id)).toEqual(["s_x"]);
      expect(await q("select * from tests")).toEqual([]);
      expect(await q("select * from test_results")).toEqual([]);
      await expect(q(`insert into tests (id, school_id, teacher_id, name, type, date, qs) values ('t9','${SC1}','${T1}','x','p1','2026-01-01','[]')`)).rejects.toThrow();
    });
  });
  it("cannot read PIN hashes or move herself to another school", async () => {
    await as(db, T1, async (q) => {
      await expect(q("select pin_hash from students")).rejects.toThrow(/permission denied/);
      await expect(q(`update teachers set school_id = '${SC2}'`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe("file storage", () => {
  const path = (sid: string) => `${SC1}/student/${sid}/t1/page1.jpg`;
  it("teacher can add files for her students only", async () => {
    await as(db, T1, async (q) => {
      await q(`insert into storage.objects (bucket_id, name) values ('sheets', '${path("s_a")}')`);
    });
    await as(db, T2, async (q) => {
      await expect(q(`insert into storage.objects (bucket_id, name) values ('sheets', '${path("s_a")}')`)).rejects.toThrow();
    });
  });
  it("student can upload task work only into her own folder, and cannot touch sheets", async () => {
    await as(db, U_A, async (q) => {
      await q(`insert into storage.objects (bucket_id, name) values ('submissions', '${path("s_a")}')`);
      await expect(q(`insert into storage.objects (bucket_id, name) values ('submissions', '${path("s_b")}')`)).rejects.toThrow();
      await expect(q(`insert into storage.objects (bucket_id, name) values ('sheets', '${path("s_a")}')`)).rejects.toThrow();
    });
  });
});
