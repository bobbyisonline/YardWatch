import type { PredictionRow } from '../domain/types';
import { formatPercent } from '../domain/utils';

interface ResultsTableProps {
  predictions: PredictionRow[];
  selectedBatterId: string | null;
  onSelectBatter: (batterId: string) => void;
}

export function ResultsTable({
  predictions,
  selectedBatterId,
  onSelectBatter,
}: ResultsTableProps) {
  if (predictions.length === 0) {
    return null;
  }

  return (
    <div className="results-table-container">
      <table className="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Batter</th>
            <th className="hide-on-mobile">Team</th>
            <th>Attack Pitch</th>
            <th>Score</th>
            <th>HR Prob</th>
            <th className="hide-on-mobile">Top Reasons</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((pred, idx) => (
            <tr
              key={pred.batterId}
              className={`results-row ${selectedBatterId === pred.batterId ? 'selected' : ''} ${getScoreTier(pred.score)}`}
              onClick={() => onSelectBatter(pred.batterId)}
            >
              <td className="rank-cell">{idx + 1}</td>
              <td className="batter-name-cell">{pred.batterName}</td>
              <td className="team-cell hide-on-mobile">{pred.batterTeam}</td>
              <td className="pitch-cell">{pred.attackPitch}</td>
              <td className="score-cell">
                <span className="score-badge">{pred.score}</span>
              </td>
              <td className="prob-cell">{formatPercent(pred.probability)}</td>
              <td className="reasons-cell hide-on-mobile">
                <ul className="reasons-list">
                  {pred.topReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getScoreTier(score: number): string {
  if (score >= 70) return 'tier-high';
  if (score >= 40) return 'tier-medium';
  return 'tier-low';
}
