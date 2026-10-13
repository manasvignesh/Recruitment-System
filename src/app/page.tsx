import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, Workflow, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/ui";
import { brand } from "@/lib/brand";
export default function Home() {
  return (
    <>
      <nav className="public-nav">
        <Link href="/" aria-label={brand.name + " home"}>
          <Logo />
        </Link>
        <div className="public-nav-links">
          <a className="hide-mobile" href="#how-it-works">
            How it works
          </a>
          <a className="hide-mobile" href="#trust">
            Built on trust
          </a>
          <Link href="/login">Sign in</Link>
          <Link className="button primary" href="/signup">
            Get started <ArrowRight size={14} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="marketing-hero">
          <span className="eyebrow">
            {brand.descriptor} · A little more human
          </span>
          <h1>
            Make room for
            <br />
            your <em>next great hire.</em>
          </h1>
          <p>
            From the first hello to the accepted offer. One thoughtful workspace
            for the people building your team.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/signup">
              Create your workspace <ArrowRight size={15} />
            </Link>
            <Link className="button secondary" href="/login">
              Open {brand.name}
            </Link>
          </div>
          <small style={{ display: "block", marginTop: 18 }}>
            Clear decisions. Connected teams. A better candidate experience.
          </small>
        </section>
        <figure className="product-preview actual-preview">
          <div className="product-preview-shot">
            <Image
              src="/morrow-workspace.png"
              width={1280}
              height={1915}
              sizes="(max-width: 768px) 100vw, 1040px"
              alt="The actual Morrow recruiter workbench showing priorities, open positions and interviews in the fictional Northstar Studio demo."
            />
          </div>
          <figcaption>
            <span>
              Actual workspace snapshot · Fictional Northstar Studio demo
            </span>
            <Link href="/careers/northstar-demo">
              Explore its careers page <ArrowRight size={13} />
            </Link>
          </figcaption>
        </figure>
        <section id="how-it-works" className="marketing-section">
          <span className="eyebrow">Less administration. More connection.</span>
          <h2>
            Every part of hiring,
            <br />
            working together.
          </h2>
          <div className="marketing-columns">
            <article>
              <Workflow size={23} />
              <h3>A clear path forward</h3>
              <p>
                Publish roles, review applications, and move candidates through
                a pipeline that reflects the way your team hires.
              </p>
            </article>
            <article>
              <Users size={23} />
              <h3>Decisions with context</h3>
              <p>
                Keep interview notes, structured feedback, and offer approvals
                together. Know what happened and what needs to happen next.
              </p>
            </article>
            <article>
              <Check size={23} />
              <h3>Candidates in the loop</h3>
              <p>
                Give applicants a calm place to follow their progress, prepare
                for interviews, and review their offer.
              </p>
            </article>
          </div>
        </section>
        <section id="trust" className="marketing-section">
          <span className="eyebrow">
            <ShieldCheck size={15} /> Thoughtfulness, by design
          </span>
          <h2>Your people. Your decisions.</h2>
          <p style={{ maxWidth: 660, marginTop: 22, lineHeight: 1.9 }}>
            Hiring is personal. {brand.name} keeps organization data separate,
            restricts access by role, and records important changes. Candidate
            feedback stays private. Hiring decisions stay with your team.
          </p>
          <Link
            className="button primary"
            style={{ marginTop: 25 }}
            href="/signup"
          >
            Start thoughtfully <ArrowRight size={15} />
          </Link>
        </section>
      </main>
      <footer className="marketing-footer">
        <Logo />
        <span>
          © {new Date().getFullYear()} {brand.name}. Built for what comes next.
        </span>
        <Link href="/login">
          Your workspace <ArrowRight size={12} />
        </Link>
      </footer>
    </>
  );
}
