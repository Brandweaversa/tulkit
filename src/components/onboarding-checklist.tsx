"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X, Rocket } from "lucide-react";

export interface OnboardingStep {
  key: string;
  label: string;
  hint?: string;
  done: boolean;
  action?: () => void;
  actionLabel?: string;
}

interface Props {
  steps: OnboardingStep[];
  onDismiss: () => void;
}

// First-run checklist shown at the top of the dashboard until every step is
// done (or the user dismisses it — persisted in localStorage by the parent).
export function OnboardingChecklist({ steps, onDismiss }: Props) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  if (allDone) return null;

  return (
    <Card className="border-[#0E7C9C]/30 bg-[#0E7C9C]/[0.04]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-md bg-[#0E7C9C] text-white flex items-center justify-center shrink-0">
              <Rocket className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-sm">Get set up in 4 steps</div>
              <div className="text-xs text-muted-foreground">
                {doneCount} of {steps.length} done
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onDismiss}
            title="Hide this checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {steps.map((step) => (
            <div
              key={step.key}
              className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                )}
                <div className="min-w-0">
                  <div
                    className={`text-sm truncate ${
                      step.done
                        ? "text-muted-foreground line-through"
                        : "font-medium"
                    }`}
                  >
                    {step.label}
                  </div>
                  {step.hint && !step.done && (
                    <div className="text-xs text-muted-foreground truncate">
                      {step.hint}
                    </div>
                  )}
                </div>
              </div>
              {!step.done && step.action && step.actionLabel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 h-8"
                  onClick={step.action}
                >
                  {step.actionLabel}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
