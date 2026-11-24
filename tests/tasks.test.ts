/** Performance tasks until mastery: rows in the database and back, and who may change what. */
import { describe, expect, it } from "vitest";
import { rowsToState, taskRowIdOf, taskSetToRows } from "@/lib/data/mapping";
import { upsertSql } from "@/lib/import/sql";
import { as, freshDb } from "./db/pg";

const own = { school_id: "00000000-0000-0000-0000-0000000000a1", teacher_id: "11111111-1111-1111-1111-111111111111" };
const T = {
  id: "ts_1", title: "نموذج للصدوع", desc: "صمّمي نموذجًا", del: "img", due: "2026-12-01", skills: ["k1"], mastery: 80,
  rubric: [{ c: "الدقة", max: 5, lv: ["أ", "ب", "ج"] }, { c: "التبرير", max: 5, lv: [] }], target: { kind: "group", cls: "3/1", group: 1 }, at: "2026-11-24T08:00:00.000Z",
  students: { s_a: { status: "assigned", subs: [] }, s_b: { status: "assigned", subs: [] } },
};

describe("task sets", () => {
  it("one row per student, and back to the same task with each student's status and attempts", () => {
    const rows = taskSetToRows(T, own);
    expect(rows.map((r) => r.id)).toEqual([taskRowIdOf("ts_1", "s_a"), taskRowIdOf("ts_1", "s_b")]);
    expect(rows.every((r) => r.test_id === null && r.set_id === "ts_1")).toBe(true);
    const db = rows.map((r) => ({ ...r, status: r.student_id === "s_a" ? "retry" : "mastered", teacher_grade: r.student_id === "s_b" ? 9 : null, ai_eval: { total: 6 }, attempts: 1 }));
    const subs = [{ id: "x1", task_id: rows[0].id, student_id: "s_a", kind: "img", thumbs: [], submitted_at: "2026-11-25T08:00:00Z" }, { id: "x2", task_id: rows[0].id, student_id: "s_a", kind: "pdf", thumbs: [], submitted_at: "2026-11-26T08:00:00Z" }];
    const st = rowsToState({ classes: [], students: [], skills: [], tests: [], test_results: [], improvement_rounds: [], improvement_items: [], perf_tasks: db, task_submissions: subs });
    const back = st.tasks.ts_1;
    expect({ title: back.title, desc: back.desc, rubric: back.rubric, skills: back.skills, mastery: back.mastery, target: back.target, due: back.due }).toEqual({ title: T.title, desc: T.desc, rubric: T.rubric, skills: T.skills, mastery: 80, target: T.target, due: T.due });
    expect(back.students.s_a.status).toBe("retry");
    expect(back.students.s_a.subs.map((x: any) => x.kind)).toEqual(["img", "pdf"]);
    expect(back.students.s_b).toMatchObject({ status: "mastered", tg: 9 });
    // tasks tied to a test are unaffected
    expect(Object.keys(st.acks)).toEqual([]);
  });

  it("the teacher writes them; a student can read hers but cannot mark herself as mastered", async () => {
    const db = await freshDb();
    const T1 = own.teacher_id, U_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", C1 = "00000000-0000-0000-0000-0000000000c1";
    await db.exec(`insert into auth.users (id) values ('${T1}'),('${U_A}');
      insert into schools (id, name) values ('${own.school_id}','x'); insert into teachers (id, school_id, display_name) values ('${T1}','${own.school_id}','t');
      insert into classes values ('${C1}','${own.school_id}','${T1}','3/1');
      insert into students (id, school_id, teacher_id, class_id, seat_no, name, auth_user_id) values ('s_a','${own.school_id}','${T1}','${C1}',1,'أ','${U_A}'),('s_b','${own.school_id}','${T1}','${C1}',2,'ب',null);`);
    await as(db, T1, async (q) => {
      for (const r of taskSetToRows(T, own)) { const { sql, vals } = upsertSql("perf_tasks", "id", r); await q(sql, vals); }
      expect((await q("select count(*)::int n from perf_tasks where set_id = 'ts_1'"))[0].n).toBe(2);
      await q(`update perf_tasks set status = 'mastered', teacher_grade = 9 where id = '${taskRowIdOf("ts_1", "s_b")}'`);
    });
    for (const r of taskSetToRows(T, own)) { const { sql, vals } = upsertSql("perf_tasks", "id", r); await db.query(sql, vals); } // kept for the student's check
    await as(db, U_A, async (q) => {
      expect((await q("select student_id from perf_tasks")).map((r) => r.student_id)).toEqual(["s_a"]);
      expect(await q(`update perf_tasks set status = 'mastered' where id = '${taskRowIdOf("ts_1", "s_a")}' returning id`)).toEqual([]);
    });
  });
});
