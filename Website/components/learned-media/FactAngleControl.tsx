"use client";

import { FACT_ANGLE_OPTIONS, factAngleDefinition, type FactAngle } from "@/lib/fact-angle";

export function FactAngleControl({ value, onChange, disabled = false, id = "fact-angle" }: {
  value: FactAngle;
  onChange?: (value: FactAngle) => void;
  disabled?: boolean;
  id?: string;
}) {
  const selected = factAngleDefinition(value);
  return <div className="fact-angle-control">
    <label className="control-label" htmlFor={id}>Fact angle</label>
    <select id={id} aria-label="Fact angle" aria-describedby={`${id}-description ${id}-note`} value={value} disabled={disabled || !onChange} onChange={(event) => onChange?.(event.target.value as FactAngle)}>
      {FACT_ANGLE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <span id={`${id}-description`} className="fact-angle-description">{selected.description}</span>
    <span id={`${id}-note`} className="fact-angle-note">Applies to your next batch, including retries.</span>
  </div>;
}
