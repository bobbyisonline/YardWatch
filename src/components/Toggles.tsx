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
      <div className="control-group toggle-group">
        <label htmlFor="hr-factors-toggle" className="toggle-label">
          <input
            type="checkbox"
            id="hr-factors-toggle"
            checked={useHrFactors}
            onChange={(e) => onToggleHrFactors(e.target.checked)}
          />
          <span>Use HR Factors</span>
        </label>
        <span className="toggle-hint">
          {useHrFactors ? 'Including pitcher/batter HR rates' : 'Base interaction only'}
        </span>
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
