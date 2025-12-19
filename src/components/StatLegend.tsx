import { useState } from 'react';

interface StatDefinition {
  term: string;
  short: string;
  description: string;
  goodBad: string;
}

const STAT_DEFINITIONS: StatDefinition[] = [
  {
    term: 'Pitch RV (Run Value)',
    short: 'Pitch RV',
    description:
      'Measures how many runs a pitch type saves or costs compared to average. Based on the outcome of every pitch thrown.',
    goodBad: 'Negative = bad for pitcher (hittable). Positive = good for pitcher.',
  },
  {
    term: 'Batter RV',
    short: 'Batter RV',
    description:
      'Measures how many runs above average a batter produces against a specific pitch type.',
    goodBad: 'Positive = batter crushes this pitch. Negative = struggles against it.',
  },
  {
    term: 'Attack Pitch',
    short: 'Attack Pitch',
    description:
      "The pitcher's most exploitable pitch. Identified by looking at their top 2 most-used pitches and selecting the one with the worst (most negative) Pitch RV.",
    goodBad: 'This is the pitch batters should be hunting.',
  },
  {
    term: 'Usage Rate',
    short: 'Usage',
    description:
      'How often a pitcher throws a specific pitch type, expressed as a percentage of total pitches.',
    goodBad: 'Higher usage on a weak pitch = more opportunities to exploit.',
  },
  {
    term: 'HR Rate',
    short: 'HR Rate',
    description:
      'Home runs allowed (pitcher) or hit (batter) per pitch or plate appearance against a pitch type.',
    goodBad: 'Higher = more HR prone/powerful.',
  },
  {
    term: 'Sample Size',
    short: 'Sample',
    description:
      'Number of pitches or plate appearances a batter has seen against a pitch type. Larger samples = more reliable data.',
    goodBad: 'Minimum 20+ recommended for reliable predictions.',
  },
  {
    term: 'Score (0-100)',
    short: 'Score',
    description:
      'Composite matchup score combining pitch usage, pitcher weakness, and batter strength. Higher scores indicate better HR opportunities.',
    goodBad: '70+ = Elite matchup. 40-69 = Solid. Under 40 = Weak.',
  },
  {
    term: 'HR Probability',
    short: 'HR Prob',
    description:
      'Estimated likelihood of a home run in this specific matchup, capped at 35% maximum.',
    goodBad: 'League average HR rate is around 3-4%.',
  },
];

export function StatLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="stat-legend">
      <button
        className="legend-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="legend-icon">📊</span>
        <span>Stat Guide</span>
        <span className={`chevron ${isExpanded ? 'expanded' : ''}`}>▼</span>
      </button>

      {isExpanded && (
        <div className="legend-content">
          <div className="legend-grid">
            {STAT_DEFINITIONS.map((stat) => (
              <div key={stat.term} className="legend-item">
                <div className="legend-term">{stat.term}</div>
                <div className="legend-description">{stat.description}</div>
                <div className="legend-good-bad">{stat.goodBad}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface TooltipProps {
  term: string;
  children: React.ReactNode;
}

export function StatTooltip({ term, children }: TooltipProps) {
  const stat = STAT_DEFINITIONS.find(
    (s) => s.short.toLowerCase() === term.toLowerCase() || s.term.toLowerCase().includes(term.toLowerCase())
  );

  if (!stat) {
    return <>{children}</>;
  }

  return (
    <span className="stat-tooltip-wrapper">
      {children}
      <span className="stat-tooltip-icon">ⓘ</span>
      <span className="stat-tooltip-content">
        <strong>{stat.term}</strong>
        <br />
        {stat.description}
        <br />
        <em>{stat.goodBad}</em>
      </span>
    </span>
  );
}
