import Link from "next/link";

export default function NotFound() {
  return (
    <div className="about-page">
      <p className="eyebrow">404 · Unknown route</p>
      <h1>This path is outside the control plane.</h1>
      <p>The lab keeps a deliberately small surface: briefing, control plane, and rationale.</p>
      <div className="action-row">
        <Link className="primary-link" href="/briefing">
          Return to briefing
        </Link>
      </div>
    </div>
  );
}
