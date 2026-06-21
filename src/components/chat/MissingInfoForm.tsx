import { useState } from "react";

type Props = {
  data: any;
  onSubmit: (response: string) => void;
};

export function MissingInfoForm({ data, onSubmit }: Props) {
  const d = data ?? {};
  const fields: string[] = d.missing_fields ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  function handleChange(field: string, val: string) {
    setValues((prev) => ({ ...prev, [field]: val }));
  }

  function handleSubmit() {
    const parts = fields.map(
      (f) => `${f}: ${values[f]?.trim() || "(not provided)"}`
    );
    onSubmit(`Here's my info — ${parts.join(", ")}`);
    setSubmitted(true);
  }

  function handleSkip() {
    onSubmit("I'd rather not provide this information right now.");
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="card tool-result missing-info-form">
        <p style={{ fontSize: 13, color: "var(--good)", fontWeight: 600 }}>
          ✓ Response sent
        </p>
      </div>
    );
  }

  return (
    <div className="card tool-result missing-info-form">
      {d.reason && <p className="reason">{d.reason}</p>}

      {fields.map((field) => (
        <div key={field} className="field-group">
          <label htmlFor={`mif-${field}`}>
            {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </label>
          <input
            id={`mif-${field}`}
            type="text"
            placeholder={`Enter ${field.replace(/_/g, " ")}…`}
            value={values[field] ?? ""}
            onChange={(e) => handleChange(field, e.target.value)}
          />
        </div>
      ))}

      <div className="form-actions">
        <button className="btn btn-accent" onClick={handleSubmit}>
          Submit
        </button>
        <button className="btn btn-ghost" onClick={handleSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
