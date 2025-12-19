import type { PredictionRow } from '../domain/types';
import { formatPercent, formatDecimal } from '../domain/utils';

interface BatterDetailPanelProps {
  prediction: PredictionRow | null;
  onClose: () => void;
}

export function BatterDetailPanel({ prediction, onClose }: BatterDetailPanelProps) {
  if (!prediction) {
    return null;
  }

  const { detail } = prediction;

  return (
    <div className="detail-panel">
      <div className="detail-header">
        <h3>{prediction.batterName}</h3>
        <button className="close-button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="detail-score-section">
        <div className="detail-score">
          <span className="score-value">{prediction.score}</span>
          <span className="score-label">Score</span>
        </div>
        <div className="detail-prob">
          <span className="prob-value">{formatPercent(prediction.probability)}</span>
          <span className="prob-label">HR Probability</span>
        </div>
      </div>

      <div className="detail-section">
        <h4>Full Explanation</h4>
        <ul className="explanation-list">
          {detail.explanations.map((exp, idx) => (
            <li key={idx} className={`explanation-item explanation-${exp.type}`}>
              {exp.text}
            </li>
          ))}
        </ul>
      </div>

      <div className="detail-section">
        <h4>Pitcher Metrics ({detail.attackPitch})</h4>
        <dl className="metrics-list">
          <div className="metric-row">
            <dt>Usage</dt>
            <dd>{formatPercent(detail.pitcherUsage)}</dd>
          </div>
          <div className="metric-row">
            <dt>Pitch RV</dt>
            <dd className={detail.pitcherPitchRV < 0 ? 'negative' : 'positive'}>
              {formatDecimal(detail.pitcherPitchRV)}
            </dd>
          </div>
          <div className="metric-row">
            <dt>Pitch HR Rate</dt>
            <dd>
              {detail.pitcherHRRate !== null ? formatPercent(detail.pitcherHRRate, 2) : 'N/A'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="detail-section">
        <h4>Batter Metrics (vs {detail.attackPitch})</h4>
        <dl className="metrics-list">
          <div className="metric-row">
            <dt>Batter RV</dt>
            <dd className={detail.batterRV > 0 ? 'positive' : 'negative'}>
              {formatDecimal(detail.batterRV)}
            </dd>
          </div>
          <div className="metric-row">
            <dt>Batter HR Rate</dt>
            <dd>
              {detail.batterHRRate !== null ? formatPercent(detail.batterHRRate, 2) : 'N/A'}
            </dd>
          </div>
          <div className="metric-row">
            <dt>Sample Size</dt>
            <dd>{detail.batterSampleSize}</dd>
          </div>
        </dl>
      </div>

      <div className="detail-section">
        <h4>Scoring Breakdown</h4>
        <dl className="metrics-list">
          <div className="metric-row">
            <dt>Normalized Usage</dt>
            <dd>{formatDecimal(detail.normalizedUsage)}</dd>
          </div>
          <div className="metric-row">
            <dt>Normalized Pitch Weakness</dt>
            <dd>{formatDecimal(detail.normalizedPitchWeakness)}</dd>
          </div>
          <div className="metric-row">
            <dt>Normalized Batter Strength</dt>
            <dd>{formatDecimal(detail.normalizedBatterStrength)}</dd>
          </div>
          <div className="metric-row">
            <dt>HR Pitch Factor</dt>
            <dd>{formatDecimal(detail.hrPitchFactor)}</dd>
          </div>
          <div className="metric-row">
            <dt>HR Batter Factor</dt>
            <dd>{formatDecimal(detail.hrBatterFactor)}</dd>
          </div>
          <div className="metric-row">
            <dt>Raw Score</dt>
            <dd>{formatDecimal(detail.rawScore, 4)}</dd>
          </div>
        </dl>
      </div>

      {detail.fallbacks.length > 0 && (
        <div className="detail-section fallbacks-section">
          <h4>Fallbacks Used</h4>
          <ul className="fallback-list">
            {detail.fallbacks.map((fb, idx) => (
              <li key={idx}>{fb}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
