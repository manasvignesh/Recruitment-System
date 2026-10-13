import "dotenv/config";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { defaultStages } from "../src/server/rules";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const c = await pool.connect();
try {
  await c.query("BEGIN");
  await c.query("select pg_advisory_xact_lock(7314592)");
  const existing = (
    await c.query(
      "select id,is_demo from morrow.organizations where slug='northstar-demo'",
    )
  ).rows[0];
  if (existing) {
    if (!existing.is_demo)
      throw Error("The slug belongs to a real organization. Refusing to seed.");
    console.log(
      "Demo workspace already exists. No records changed. Credentials file present:",
      existsSync("demo-credentials.json"),
    );
    await c.query("ROLLBACK");
  } else {
    const org = (
      await c.query(
        "insert into morrow.organizations(name,slug,description,is_demo) values('Northstar Studio','northstar-demo','We are an independent product studio building thoughtful digital experiences. Join a small, ambitious team that values craft, curiosity, and meaningful work.',true) returning id",
      )
    ).rows[0].id;
    const password = "Morrow-" + randomBytes(12).toString("base64url") + "!";
    const hash = await hashPassword(password);
    const identities: Record<
      string,
      { email: string; password: string; id: string }
    > = {};
    async function user(name: string, email: string) {
      const id = randomUUID();
      await c.query(
        "insert into morrow.users(id,name,email,email_verified) values($1,$2,$3,false)",
        [id, name, email],
      );
      await c.query(
        "insert into morrow.accounts(id,account_id,provider_id,user_id,password) values($1,$2::text,'credential',$2::uuid,$3)",
        [randomUUID(), id, hash],
      );
      return id;
    }
    for (const [role, name] of [
      ["admin", "Alex Morgan"],
      ["recruiter", "Jamie Parker"],
      ["manager", "Jordan Ellis"],
      ["interviewer", "Taylor Reed"],
    ]) {
      const email = role + "@northstar.example";
      const id = await user(name, email);
      await c.query(
        "insert into morrow.memberships(org_id,user_id,role) values($1,$2,$3)",
        [org, id, role],
      );
      identities[role] = { email, password, id };
    }
    for (const [i, name] of defaultStages.entries())
      await c.query(
        "insert into morrow.pipeline_stages(org_id,name,position) values($1,$2,$3)",
        [org, name, i],
      );
    const deps: Record<string, string> = {};
    for (const name of ["Design", "Engineering", "Operations"])
      deps[name] = (
        await c.query(
          "insert into morrow.departments(org_id,name) values($1,$2) returning id",
          [org, name],
        )
      ).rows[0].id;
    const jobs: any[] = [];
    for (const [
      title,
      department,
      location,
      workplace,
      openings,
      status,
      skills,
    ] of [
      [
        "Senior Product Designer",
        "Design",
        "New York, NY",
        "Hybrid",
        2,
        "published",
        ["Product design", "Research", "Figma"],
      ],
      [
        "Frontend Engineer",
        "Engineering",
        "Remote · US",
        "Remote",
        2,
        "published",
        ["TypeScript", "React", "Accessibility"],
      ],
      [
        "Design Researcher",
        "Design",
        "Brooklyn, NY",
        "Hybrid",
        1,
        "published",
        ["Research", "Synthesis", "Facilitation"],
      ],
      [
        "People Operations Lead",
        "Operations",
        "New York, NY",
        "On-site",
        1,
        "pending",
        ["People operations", "Process design"],
      ],
      [
        "Backend Engineer",
        "Engineering",
        "Remote · US",
        "Remote",
        1,
        "draft",
        ["PostgreSQL", "Node.js", "API design"],
      ],
    ] as const) {
      jobs.push(
        (
          await c.query(
            `insert into morrow.jobs(org_id,title,department_id,manager_id,location,workplace,employment,openings,salary_min,salary_max,currency,description,requirements,skills,questions,status,created_by,approved_by,published_at,created_at) values($1,$2,$3,$4,$5,$6,'Full-time',$7,110000,160000,'USD',$8,$9,$10,$11,$12,$13,$14,case when $12='published' then now()-interval '14 days' else null end,now()-interval '18 days') returning *`,
            [
              org,
              title,
              deps[department],
              identities.manager.id,
              location,
              workplace,
              openings,
              `Help shape the next chapter of Northstar Studio as our ${title}. You will work with a close team to turn complex problems into thoughtful products, own meaningful work from discovery through delivery, and help strengthen the way we collaborate. We offer focused work, transparent decisions, and space to grow.`,
              `Bring relevant experience in ${skills.join(", ")}. We value clear thinking, well-supported decisions, and a willingness to learn. Show us work you are proud of and tell us how you approach a challenge.`,
              skills,
              JSON.stringify(["Tell us about a project you are proud of."]),
              status,
              identities.recruiter.id,
              status === "published" ? identities.manager.id : null,
            ],
          )
        ).rows[0],
      );
    }
    const names = [
      "Maya Chen",
      "Oliver Hayes",
      "Sofia Patel",
      "Ethan Brooks",
      "Amara Okafor",
      "Lucas Bennett",
      "Isabel Torres",
      "Noah Kim",
      "Avery Wilson",
      "Priya Shah",
      "Leo Martin",
      "Nina Park",
    ];
    const stages = [
      "Final Review",
      "Interview",
      "Screening",
      "Applied",
      "Assessment",
      "Interview",
      "Offer",
      "Applied",
      "Screening",
      "Assessment",
      "Applied",
      "Final Review",
    ];
    const appIds: string[] = [];
    for (const [i, name] of names.entries()) {
      const email = "candidate" + (i + 1) + "@northstar.example";
      const uid = await user(name, email);
      if (i === 0) identities.candidate = { email, password, id: uid };
      const j = jobs[i % 3];
      const candidate = (
        await c.query(
          "insert into morrow.candidates(org_id,user_id,name,email,skills,experience,talent_consent,tags) values($1,$2,$3,$4,$5,$6,true,$7) returning id",
          [
            org,
            uid,
            name,
            email,
            j.skills,
            `Fictional demo profile: ${name} has shared a portfolio of thoughtful work in ${j.skills[0]}. Their application describes a collaborative project from research through delivery.`,
            ["Future opportunities"],
          ],
        )
      ).rows[0].id;
      const age = 3 + (i % 8);
      const app = (
        await c.query(
          `insert into morrow.applications(org_id,job_id,candidate_id,stage,owner_id,answers,created_at,stage_entered_at,updated_at) values($1,$2,$3,$4,$5,$6,now()-interval '15 days',now()-($7*interval '1 day'),now()-($7*interval '1 day')) returning id`,
          [
            org,
            j.id,
            candidate,
            stages[i],
            identities.recruiter.id,
            JSON.stringify({
              "Tell us about a project you are proud of.":
                "Fictional demo answer: I worked with a cross-functional team to simplify a complex workflow. We tested the approach with users and documented the changes.",
            }),
            age,
          ],
        )
      ).rows[0].id;
      appIds.push(app);
      const stageIdx = defaultStages.indexOf(stages[i]);
      for (let s = 0; s <= stageIdx; s++)
        await c.query(
          "insert into morrow.application_stage_history(org_id,application_id,from_stage,to_stage,actor_id,created_at) values($1,$2,$3,$4,$5,now()-($6*interval '1 day'))",
          [
            org,
            app,
            s ? defaultStages[s - 1] : null,
            defaultStages[s],
            s ? identities.recruiter.id : uid,
            15 - s,
          ],
        );
      await c.query(
        "insert into morrow.audit_events(org_id,actor_id,entity_type,entity_id,action,public,created_at) values($1,$2,'application',$3,'Application received',true,now()-interval '15 days')",
        [org, uid, app],
      );
    }
    const base = new Date();
    base.setHours(14, 0, 0, 0);
    if (base < new Date()) base.setDate(base.getDate() + 1);
    for (let n = 0; n < 5; n++) {
      const starts = new Date(
        base.getTime() + (n < 3 ? n * 90 * 60000 : (n - 2) * 86400000),
      );
      if (n === 4) starts.setDate(starts.getDate() - 7);
      const interview = (
        await c.query(
          "insert into morrow.interviews(org_id,application_id,interviewer_id,title,type,starts_at,duration,timezone,location,instructions) values($1,$2,$3,$4,'Video',$5,45,'Asia/Kolkata','Video meeting link to be shared in the portal','Bring a project you are proud of. We will discuss your approach and make time for your questions.') returning id",
          [
            org,
            appIds[n],
            n % 2 ? identities.manager.id : identities.interviewer.id,
            n % 2 ? "Team conversation" : "Portfolio conversation",
            starts.toISOString(),
          ],
        )
      ).rows[0].id;
      if (n === 0) {
        await c.query(
          "insert into morrow.scorecards(org_id,interview_id,author_id,ratings,body,recommendation,submitted) values($1,$2,$3,$4,$5,'Yes',true)",
          [
            org,
            interview,
            identities.interviewer.id,
            JSON.stringify({
              "Role expertise": 4,
              "Problem solving": 4,
              Communication: 4,
              Collaboration: 3,
            }),
            "Fictional demo feedback: Clear explanation of the research choices. The candidate used specific evidence to explain a tradeoff and described collaboration with the delivery team.",
          ],
        );
      }
    }
    for (const [i, title] of [
      "Review the research portfolio",
      "Follow up on the interview scorecard",
      "Prepare the hiring manager debrief",
    ].entries())
      await c.query(
        "insert into morrow.tasks(org_id,application_id,assignee_id,title,due_at) values($1,$2,$3,$4,now()+($5*interval '1 day'))",
        [org, appIds[i], identities.recruiter.id, title, i - 1],
      );
    await c.query(
      "insert into morrow.notes(org_id,application_id,author_id,body) values($1,$2,$3,'Fictional demo note: Review the interview evidence before the debrief. No decision has been made.')",
      [org, appIds[0], identities.recruiter.id],
    );
    await c.query(
      "insert into morrow.messages(org_id,application_id,author_id,body,state) values($1,$2,$3,'Thank you for taking the time to meet us. Your next conversation is visible in your portal. Please let us know if you have any questions.','portal')",
      [org, appIds[0], identities.recruiter.id],
    );
    await c.query("COMMIT");
    writeFileSync(
      "demo-credentials.json",
      JSON.stringify(
        {
          organization: "Northstar Studio",
          slug: "northstar-demo",
          orgId: org,
          identities,
        },
        null,
        2,
      ),
    );
    console.log(
      "Isolated fictional demo created. Development credentials saved to ignored demo-credentials.json.",
    );
  }
} catch (e) {
  await c.query("ROLLBACK");
  console.error(
    "Demo setup failed:",
    e instanceof Error ? e.stack : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  c.release();
  await pool.end();
}
