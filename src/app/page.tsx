import Link from "next/link";

export default function Home() {
  return (
    <>
      <p className="eyebrow">Historical races · Evidence first</p>
      <h1>Understand the race behind the result.</h1>
      <p className="lead">A learning project exploring driver pace, tyre stints and pit events through transparent race analytics.</p>
      <section aria-labelledby="status"><h2 id="status">Project foundation</h2><p>The application is running. Race selection, charts and the AI Race Explainer are planned for later stages. No race data or computed comparisons are available yet.</p></section>
      <section aria-labelledby="questions"><h2 id="questions">Questions we will explore</h2><ul>
        <li>How does driver pace compare on matched laps?</li>
        <li>How does pace vary across tyre stints?</li>
        <li>When did pit events occur?</li>
        <li>Where did lap times change significantly?</li>
        <li>How do excluded laps affect a comparison?</li>
      </ul></section>
      <Link className="button" href="/methodology">Read the methodology</Link>
    </>
  );
}
