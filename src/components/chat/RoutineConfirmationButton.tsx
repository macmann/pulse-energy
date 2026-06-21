import { useState } from "react";
import { Check } from "lucide-react";
import { useGoals } from "../../store/goals";
import type { ActionId } from "../../lib/engine";

type Props = { data: any };

function mapRoutineId(id: string): ActionId {
  if (id === "ev-on-solar" || id === "ev_solar_charge") return "ev_solar_charge";
  if (id === "preheat-cheap" || id === "preheat_cheap_window") return "preheat_cheap_window";
  return "appliances_midday"; // default fallback action
}

export function RoutineConfirmationButton({ data }: Props) {
  const d = data ?? {};
  const { isDone, setDone } = useGoals();
  const goalId = mapRoutineId(d.routine_id ?? "");
  const alreadySet = isDone(goalId);
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirm() {
    setDone(goalId, true);
    setConfirmed(true);
  }

  const isSet = alreadySet || confirmed;

  return (
    <div className="card tool-result routine-confirm">
      <div className="action-name">{d.action_name ?? "Routine"}</div>
      {d.trigger_time && (
        <div className="trigger-time">⏰ {d.trigger_time}</div>
      )}

      <div style={{ marginTop: 12 }}>
        {isSet ? (
          <button className="btn btn-set is-set" disabled>
            <Check size={15} /> Goal Activated
          </button>
        ) : (
          <button className="btn btn-accent" onClick={handleConfirm}>
            Activate Goal
          </button>
        )}
      </div>
    </div>
  );
}
