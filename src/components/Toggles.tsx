interface TogglesProps {
  useHrFactors: boolean;
  onToggleHrFactors: (value: boolean) => void;
  minSampleSize: number;
  onMinSampleSizeChange: (value: number) => void;
}

export function Toggles({
  useHrFactors,
  onToggleHrFactors,
  minSampleSize,
  onMinSampleSizeChange,
}: TogglesProps) {
  return (
    <div className="toggles-container">
      <div className="toggle-card" onClick={() => onToggleHrFactors(!useHrFactors)}>
        <div className="toggle-card-content">
          <span className="toggle-card-title">Use HR Factors</span>
          <span className="toggle-card-desc">
            {useHrFactors ? 'Including pitcher/batter HR rates' : 'Base interaction only'}
          </span>
        </div>
        <div className={`toggle-switch ${useHrFactors ? 'active' : ''}`}>
          <div className="toggle-switch-knob" />
        </div>
      </div>

      <div className="control-group">
        <label htmlFor="min-sample-size">
          Min Sample Size: <strong>{minSampleSize}</strong>
        </label>
        <input
          type="range"
          id="min-sample-size"
          min={5}
          max={100}
          step={5}
          value={minSampleSize}
          onChange={(e) => onMinSampleSizeChange(Number(e.target.value))}
        />
        <div className="range-labels">
          <span>5</span>
          <span>100</span>
        </div>
      </div>
    </div>
  );
}
