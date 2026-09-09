import AuthLayout from "@/components/AuthLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/providers/trpc";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquarePlus,
  PlayCircle,
  Plus,
  ScrollText,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  owner: "负责人",
  reviewer: "审核员",
  editor: "编剧",
};

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待复核", variant: "secondary" },
  in_review: { label: "复核中", variant: "outline" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已驳回", variant: "destructive" },
};

const SEVERITY_LABELS: Record<string, string> = {
  block: "阻断",
  high: "高危",
  notice: "提示",
};

const ACTION_LABELS: Record<string, string> = {
  "org.create": "创建组织",
  "member.add": "邀请成员",
  "member.remove": "移除成员",
  "assignment.create": "发起复核",
  "assignment.in_review": "开始复核",
  "assignment.approved": "复核通过",
  "assignment.rejected": "复核驳回",
  "annotation.add": "添加批注",
};

/** 团队协作审核流：组织管理 + 工单指派 + 复核批注 + 审计日志 */
export default function Team() {
  const utils = trpc.useUtils();
  const myOrgs = trpc.team.myOrgs.useQuery();
  const [orgId, setOrgId] = useState<number | null>(null);
  const activeOrgId = orgId ?? myOrgs.data?.[0]?.id ?? null;

  const members = trpc.team.listMembers.useQuery(
    { orgId: activeOrgId! },
    { enabled: activeOrgId != null },
  );
  const assignments = trpc.team.listAssignments.useQuery(
    { orgId: activeOrgId!, scope: "org" },
    { enabled: activeOrgId != null, retry: false },
  );
  const myAssignments = trpc.team.listAssignments.useQuery(
    { orgId: activeOrgId!, scope: "mine" },
    { enabled: activeOrgId != null },
  );
  const auditLogs = trpc.team.listAuditLogs.useQuery(
    { orgId: activeOrgId! },
    { enabled: activeOrgId != null, retry: false },
  );
  const mySubmissions = trpc.team.myAssignableSubmissions.useQuery();

  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"reviewer" | "editor">("reviewer");
  const [inviteLicense, setInviteLicense] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSubmissionId, setAssignSubmissionId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [assignNote, setAssignNote] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const [annotationHitId, setAnnotationHitId] = useState<number | null>(null);

  const detail = trpc.team.assignmentDetail.useQuery(
    { assignmentId: detailId! },
    { enabled: detailId != null },
  );

  const invalidate = () => {
    utils.team.myOrgs.invalidate();
    utils.team.listMembers.invalidate();
    utils.team.listAssignments.invalidate();
    utils.team.listAuditLogs.invalidate();
    utils.team.assignmentDetail.invalidate();
  };

  const createOrg = trpc.team.createOrg.useMutation({
    onSuccess: () => { toast.success("组织已创建"); setCreateOrgOpen(false); setOrgName(""); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addMember = trpc.team.addMember.useMutation({
    onSuccess: () => { toast.success("成员已邀请"); setInviteOpen(false); setInviteEmail(""); setInviteLicense(""); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const removeMember = trpc.team.removeMember.useMutation({
    onSuccess: () => { toast.success("成员已移除"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const createAssignment = trpc.team.createAssignment.useMutation({
    onSuccess: () => { toast.success("复核工单已指派"); setAssignOpen(false); setAssignSubmissionId(""); setAssigneeId(""); setAssignNote(""); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.team.updateAssignmentStatus.useMutation({
    onSuccess: () => { toast.success("状态已更新"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const addAnnotation = trpc.team.addAnnotation.useMutation({
    onSuccess: () => { toast.success("批注已添加"); setAnnotationText(""); setAnnotationHitId(null); utils.team.assignmentDetail.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const list = assignments.error ? myAssignments.data : (assignments.data ?? myAssignments.data);
  const myRole = myOrgs.data?.find((o) => o.id === activeOrgId)?.myRole;
  const canManage = myRole === "owner" || myRole === "reviewer";

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" /> 团队复核
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              编剧提交 → 审核员复核 → 批注整改 → 通过/驳回，全程留痕，满足「先审后播」自审要求。
            </p>
          </div>
          <div className="flex gap-2">
            {myOrgs.data && myOrgs.data.length > 1 && (
              <Select value={String(activeOrgId ?? "")} onValueChange={(v) => setOrgId(Number(v))}>
                <SelectTrigger className="w-48"><SelectValue placeholder="选择组织" /></SelectTrigger>
                <SelectContent>
                  {myOrgs.data.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => setCreateOrgOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> 创建组织
            </Button>
          </div>
        </div>

        {!activeOrgId && !myOrgs.isLoading && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              您还未加入任何组织。点击「创建组织」组建自审团队，或请负责人按邮箱邀请您加入。
            </CardContent>
          </Card>
        )}

        {activeOrgId && (
          <>
            {/* 成员 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> 成员（{members.data?.length ?? 0}）
                </CardTitle>
                {canManage && (
                  <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> 邀请成员
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {members.data?.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div>
                      <span className="font-medium">{m.name ?? `用户#${m.userId}`}</span>
                      <span className="text-sm text-muted-foreground ml-2">{m.email}</span>
                      {m.licenseNo && (
                        <span className="text-xs text-muted-foreground ml-2">证号 {m.licenseNo}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                        {ROLE_LABELS[m.role]}
                      </Badge>
                      {canManage && m.role !== "owner" && (
                        <Button
                          size="icon" variant="ghost"
                          onClick={() => removeMember.mutate({ orgId: activeOrgId, memberId: m.id })}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 工单 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> 复核工单
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 发起复核
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {list?.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">暂无工单</p>
                )}
                {list?.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetailId(a.id)}
                  >
                    <div>
                      <span className="font-medium">{a.workTitle}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        复核人：{a.assigneeName ?? `#${a.assigneeId}`}
                      </span>
                      {a.note && <span className="text-xs text-muted-foreground ml-2">｜{a.note}</span>}
                    </div>
                    <Badge variant={STATUS_META[a.status].variant}>{STATUS_META[a.status].label}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 审计日志 */}
            {!auditLogs.error && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ScrollText className="h-4 w-4" /> 审计日志
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {auditLogs.data?.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">暂无记录</p>
                  )}
                  {auditLogs.data?.map((l) => (
                    <div key={l.id} className="text-sm flex gap-3 border-b last:border-0 py-1.5">
                      <span className="text-muted-foreground shrink-0">
                        {new Date(l.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <span className="font-medium shrink-0">{l.userName ?? `#${l.userId}`}</span>
                      <span>{ACTION_LABELS[l.action] ?? l.action}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* 创建组织 */}
      <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建组织</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>组织名称</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="如：某某短剧工作室" />
            </div>
            <Button
              className="w-full"
              disabled={orgName.trim().length < 2 || createOrg.isPending}
              onClick={() => createOrg.mutate({ name: orgName.trim() })}
            >
              {createOrg.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} 创建
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 邀请成员 */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>邀请成员</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>注册邮箱</Label>
              <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="对方在平台的注册邮箱" />
            </div>
            <div>
              <Label>角色</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "reviewer" | "editor")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reviewer">审核员</SelectItem>
                  <SelectItem value="editor">编剧</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {inviteRole === "reviewer" && (
              <div>
                <Label>持证编号（可选）</Label>
                <Input value={inviteLicense} onChange={(e) => setInviteLicense(e.target.value)} placeholder="审核员持证编号，便于留痕备查" />
              </div>
            )}
            <Button
              className="w-full"
              disabled={!inviteEmail.includes("@") || addMember.isPending}
              onClick={() =>
                addMember.mutate({ orgId: activeOrgId!, email: inviteEmail.trim(), role: inviteRole, licenseNo: inviteLicense.trim() })
              }
            >
              {addMember.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} 邀请
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 发起复核 */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>发起复核</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>选择送检（本人已出结论的检测）</Label>
              <Select value={assignSubmissionId} onValueChange={setAssignSubmissionId}>
                <SelectTrigger><SelectValue placeholder="选择送检记录" /></SelectTrigger>
                <SelectContent>
                  {mySubmissions.data?.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.workTitle}（{s.verdict === "high_risk" ? "高风险" : s.verdict === "attention" ? "需关注" : "低风险"}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>指派给</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="选择组织成员" /></SelectTrigger>
                <SelectContent>
                  {members.data?.map((m) => (
                    <SelectItem key={m.userId} value={String(m.userId)}>
                      {m.name ?? `用户#${m.userId}`}（{ROLE_LABELS[m.role]}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>备注（可选）</Label>
              <Textarea value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="复核重点、截止时间等" rows={2} />
            </div>
            <Button
              className="w-full"
              disabled={!assignSubmissionId || !assigneeId || createAssignment.isPending}
              onClick={() =>
                createAssignment.mutate({
                  orgId: activeOrgId!,
                  submissionId: Number(assignSubmissionId),
                  assigneeId: Number(assigneeId),
                  note: assignNote.trim(),
                })
              }
            >
              {createAssignment.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} 指派
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 工单详情 */}
      <Dialog open={detailId != null} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              复核工单 #{detailId} — {detail.data?.submission?.workTitle}
            </DialogTitle>
          </DialogHeader>
          {detail.isLoading && <Loader2 className="h-5 w-5 animate-spin mx-auto my-6" />}
          {detail.data && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={STATUS_META[detail.data.assignment.status].variant}>
                  {STATUS_META[detail.data.assignment.status].label}
                </Badge>
                {detail.data.assignment.status === "pending" && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ assignmentId: detailId!, status: "in_review" })}>
                    <PlayCircle className="h-4 w-4 mr-1" /> 开始复核
                  </Button>
                )}
                {(detail.data.assignment.status === "pending" || detail.data.assignment.status === "in_review") && (
                  <>
                    <Button size="sm" onClick={() => updateStatus.mutate({ assignmentId: detailId!, status: "approved" })}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> 通过
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus.mutate({ assignmentId: detailId!, status: "rejected" })}>
                      <XCircle className="h-4 w-4 mr-1" /> 驳回
                    </Button>
                  </>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">命中条目（{detail.data.hits.length}）</h3>
                <div className="space-y-2">
                  {detail.data.hits.map((h) => (
                    <div key={h.id} className="border rounded-md p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={h.severity === "block" ? "destructive" : h.severity === "high" ? "default" : "secondary"}>
                          {SEVERITY_LABELS[h.severity]}
                        </Badge>
                        <span className="font-medium">{h.ruleName}</span>
                        <span className="text-xs text-muted-foreground">{h.location}</span>
                        <Button
                          size="sm" variant="ghost" className="ml-auto h-7"
                          onClick={() => { setAnnotationHitId(h.id); }}
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> 批注
                        </Button>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2">{h.spanText}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">批注（{detail.data.annotations.length}）</h3>
                <div className="space-y-2">
                  {detail.data.annotations.map((an) => (
                    <div key={an.id} className="border-l-2 pl-3 py-1 text-sm">
                      <span className="font-medium">{an.authorName ?? `#${an.authorId}`}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {new Date(an.createdAt).toLocaleString("zh-CN")}
                        {an.hitId ? ` ｜针对命中#${an.hitId}` : ""}
                      </span>
                      <p className="mt-0.5">{an.content}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {annotationHitId && (
                    <p className="text-xs text-muted-foreground">
                      正在批注命中条目 #{annotationHitId}
                      <Button variant="link" size="sm" className="h-4 px-1" onClick={() => setAnnotationHitId(null)}>改为整单批注</Button>
                    </p>
                  )}
                  <Textarea
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                    placeholder="写下复核意见、整改要求……"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    disabled={!annotationText.trim() || addAnnotation.isPending}
                    onClick={() =>
                      addAnnotation.mutate({
                        assignmentId: detailId!,
                        hitId: annotationHitId ?? undefined,
                        content: annotationText.trim(),
                      })
                    }
                  >
                    {addAnnotation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} 提交批注
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AuthLayout>
  );
}
