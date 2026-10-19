// 承認ルートの表示（承認済みは緑、今の順番は青）
import { Fragment } from "react";
import { stepState, type ReportStatus } from "@/lib/report";

export type RouteStep = { step_no: number; name: string };

export default function RouteView({ steps, status, currentStep }: {
  steps: RouteStep[];
  status: ReportStatus;
  currentStep: number | null;
}) {
  if (!steps.length) return <span className="hint">提出時に承認ルートが確定します</span>;
  return (
    <div className="route">
      {steps.map((s, i) => (
        <Fragment key={s.step_no}>
          {i > 0 && <span className="arrow">→</span>}
          <span className={`step ${stepState(status, currentStep, s.step_no)}`}>{s.name}</span>
        </Fragment>
      ))}
    </div>
  );
}
