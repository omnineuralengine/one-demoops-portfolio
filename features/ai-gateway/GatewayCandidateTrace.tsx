import { StatusPill } from "@/components/ui/StatusPill";
import type { GatewayCandidateEvaluation, ModelId } from "@/lib/domain/types";

const modelLabels: Record<ModelId, string> = {
  opus: "Opus",
  sonnet: "Sonnet",
  haiku: "Haiku",
};

export function GatewayCandidateTrace({
  candidates,
}: {
  candidates: readonly GatewayCandidateEvaluation[];
}) {
  return (
    <section className="gateway-candidate-trace" aria-labelledby="gateway-candidate-trace-heading">
      <div className="gateway-candidate-trace-heading">
        <div>
          <span className="field-label">Candidate evaluation</span>
          <h3 id="gateway-candidate-trace-heading">Why each model passed or failed</h3>
        </div>
        <span>{candidates.length} models checked</span>
      </div>

      <ol className="gateway-candidate-list" aria-label="Model candidate evaluations">
        {candidates.map((candidate, index) => {
          const label = modelLabels[candidate.model];

          return (
            <li className="gateway-candidate" key={candidate.model}>
              <div className="gateway-candidate-summary">
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <strong>{label}</strong>
              </div>
              <StatusPill tone={candidate.eligible ? "success" : "danger"}>
                {candidate.eligible ? "Eligible" : "Rejected"}
              </StatusPill>

              {candidate.rejectionReasons.length > 0 ? (
                <ul
                  className="gateway-candidate-reasons"
                  aria-label={`${label} rejection reasons`}
                >
                  {candidate.rejectionReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="gateway-candidate-pass">All requested route constraints passed.</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
