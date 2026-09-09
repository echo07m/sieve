import LeadForm from "@/components/LeadForm";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { PLANS, PLAN_ORDER } from "@contracts/constants";
import { Check } from "lucide-react";

export type UpgradePaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 已用额度（用于文案展示） */
  quotaUsed?: number;
  /** 额度总量（-1 表示不限量） */
  quotaTotal?: number;
};

const UPGRADE_CODES = PLAN_ORDER.filter((c) => c !== "free");

/**
 * 配额用尽转化弹窗：免费额度耗尽时由送检页触发，
 * 引导用户升级方案或留资，由商务跟进开通。
 */
export default function UpgradePaywallDialog({
  open,
  onOpenChange,
  quotaUsed,
  quotaTotal,
}: UpgradePaywallDialogProps) {
  const usedText =
    typeof quotaUsed === "number" && typeof quotaTotal === "number" && quotaTotal > 0
      ? `你已用完 ${quotaTotal} 次免费检测额度（已用 ${quotaUsed} 次）`
      : "你的免费检测额度已用完";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>免费试检额度已用尽</DialogTitle>
          <DialogDescription>
            {usedText}。升级方案继续预检，避免上线被下架/拒投的损失。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {UPGRADE_CODES.map((code) => {
            const plan = PLANS[code];
            return (
              <div
                key={code}
                className={
                  plan.highlight
                    ? "rounded-lg border-2 border-amber-700/40 bg-amber-50/50 p-4 space-y-2"
                    : "rounded-lg border bg-card p-4 space-y-2"
                }
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{plan.name}</span>
                  {plan.highlight && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-900">
                      推荐
                    </Badge>
                  )}
                </div>
                <div className="text-lg font-semibold">{plan.priceText}</div>
                <div className="text-xs text-muted-foreground">{plan.periodText}</div>
                <ul className="space-y-1 pt-1">
                  {plan.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-700" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <h3 className="font-medium">留资开通</h3>
            <p className="text-sm text-muted-foreground">
              留下联系方式，商务确认后为你开通付费方案
            </p>
          </div>
          <LeadForm source="paywall" compact />
        </div>
      </DialogContent>
    </Dialog>
  );
}
