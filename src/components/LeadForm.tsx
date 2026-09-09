import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type LeadSource = "pricing" | "paywall" | "docs" | "api";

export type LeadFormProps = {
  /** 线索来源（定价页/配额弹窗/文档页/API 页） */
  source: LeadSource;
  /** 意向方案 code（free/per_use/team/enterprise），可选 */
  planInterest?: string;
  /** 提交成功后的回调（如关闭弹窗） */
  onSuccess?: () => void;
  /** 紧凑模式：缩小间距，用于弹窗内嵌 */
  compact?: boolean;
};

/**
 * 可复用留资表单：定价页、配额用尽弹窗、文档页共用。
 * 平台内不接支付，转化路径为「留资线索 → 管理员后台激活」。
 */
export default function LeadForm({
  source,
  planInterest,
  onSuccess,
  compact = false,
}: LeadFormProps) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const create = trpc.leads.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      onSuccess?.();
    },
    onError: (err) => {
      toast.error(err.message || "提交失败，请稍后重试");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return toast.error("请填写称呼");
    }
    if (contact.trim().length < 5) {
      return toast.error("请填写有效联系方式（手机/微信/邮箱）");
    }
    create.mutate({
      name: name.trim(),
      company: company.trim() || undefined,
      contact: contact.trim(),
      message: message.trim() || undefined,
      source,
      planInterest,
    });
  };

  if (submitted) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center text-center rounded-lg border border-emerald-900/15 bg-emerald-50/60",
          compact ? "gap-2 p-4" : "gap-3 p-8",
        )}
      >
        <CheckCircle2 className="h-8 w-8 text-emerald-700" />
        <p className="font-medium text-emerald-900">已收到，商务将在 1 个工作日内联系你</p>
        {!compact && (
          <p className="text-sm text-muted-foreground">
            如需加急，可在留言中注明项目上线时间，我们会优先处理
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn(compact ? "space-y-3" : "space-y-4")}>
      <div className={cn("grid gap-4", compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor={`lead-name-${source}`}>称呼 *</Label>
          <Input
            id={`lead-name-${source}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="怎么称呼你"
            maxLength={64}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`lead-company-${source}`}>公司</Label>
          <Input
            id={`lead-company-${source}`}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="公司/团队名称（选填）"
            maxLength={128}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`lead-contact-${source}`}>联系方式 *</Label>
        <Input
          id={`lead-contact-${source}`}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="手机 / 微信 / 邮箱"
          maxLength={128}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`lead-message-${source}`}>留言</Label>
        <Textarea
          id={`lead-message-${source}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="简单说明需求，如剧目数量、期望上线平台（选填）"
          rows={compact ? 2 : 3}
          maxLength={1000}
        />
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
        提交留资
      </Button>
    </form>
  );
}
