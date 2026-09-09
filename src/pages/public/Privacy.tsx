import { SITE } from "@contracts/site";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * 隐私政策（/privacy）。责任主体与联系邮箱统一取自 @contracts/site 的 SITE 常量，
 * 取得营业执照主体全称与正式商务邮箱后只需修改 contracts/site.ts。
 */
export default function Privacy() {
  useDocumentTitle("隐私政策 - 剧合规");

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <header className="mb-10 border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          隐私政策
        </h1>
        <p className="mt-3 text-sm text-stone-500">
          生效日期：2026年9月 · 版本：v1.0
        </p>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          本政策说明{SITE.companyName}
          （以下简称"我们"）在提供「{SITE.brand}」服务过程中如何收集、使用、存储与保护您的信息，以及您享有的相关权利。
        </p>
      </header>

      <div className="space-y-10 text-sm leading-7 text-stone-700">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            一、信息收集范围
          </h2>
          <p>我们在提供服务过程中收集以下信息：</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>
              <strong className="font-medium text-stone-900">账号基础信息：</strong>
              您通过 Kimi 账号（OAuth）登录时，我们获取您的昵称、头像与 unionId，用于账号识别与登录态维护；
            </li>
            <li>
              <strong className="font-medium text-stone-900">剧本与字幕文本：</strong>
              您主动上传用于合规检测的剧本、字幕等文本内容；
            </li>
            <li>
              <strong className="font-medium text-stone-900">检测产物：</strong>
              检测生成的报告、违规命中记录、置信度及对应的内容哈希与规则版本号；
            </li>
            <li>
              <strong className="font-medium text-stone-900">留资信息：</strong>
              您在定价页等场景主动提交的称呼、公司名称与联系方式，用于商务对接开通方案。
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            二、数据最小化专项说明
          </h2>
          <p>
            2.1 <strong className="font-medium text-stone-900">成片视频不上传原图：</strong>
            成片画面抽帧在您的浏览器本地完成，比对仅留存画面的 SHA-256 哈希值，原始画面上传为零，哈希值不可逆还原为原始画面。
          </p>
          <p className="mt-2">
            2.2 <strong className="font-medium text-stone-900">剧本原文用途限定：</strong>
            剧本与字幕原文仅用于当次检测与报告生成，不用于模型训练或其他与本服务无关的用途。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            三、信息使用目的与限制
          </h2>
          <p>我们收集的信息仅用于以下目的：</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>账号登录、配额管理与方案开通；</li>
            <li>执行合规检测、生成报告与存证记录；</li>
            <li>商务对接、客户服务与必要的通知；</li>
            <li>保障服务安全（异常调用与滥用防控）。</li>
          </ul>
          <p className="mt-2">
            我们不会超出上述目的使用您的信息，亦不会将您的个人信息出售给任何第三方。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            四、第三方服务说明
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong className="font-medium text-stone-900">Kimi 登录（OAuth）：</strong>
              登录认证由 Kimi 提供，授权过程中发生的个人信息处理同时受 Kimi 隐私政策约束；
            </li>
            <li>
              <strong className="font-medium text-stone-900">服务器托管：</strong>
              本服务部署于合规的云服务提供商，服务商仅按我们的指示存储与处理数据，不获取数据的使用权。
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            五、数据存储与安全措施
          </h2>
          <p>
            5.1 您的数据存储于中国境内的服务器。我们对 API Key 等敏感凭证仅保存加密哈希，不保存明文。
          </p>
          <p className="mt-2">
            5.2 我们采取访问控制、最小权限、传输加密等技术与组织措施保护您的信息。尽管我们已尽合理努力，仍请您理解互联网环境不存在绝对安全；如发生信息安全事件，我们将按法律法规要求及时告知。
          </p>
          <p className="mt-2">
            5.3 我们仅在实现本政策所述目的所需的最短期限内保留您的信息，法律法规另有规定的除外。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            六、您的权利
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong className="font-medium text-stone-900">查询与更正：</strong>
              您可在工作台查询您的账号信息、检测记录与报告，或联系客服更正相关信息；
            </li>
            <li>
              <strong className="font-medium text-stone-900">删除：</strong>
              您可联系客服申请删除您的账号及相关数据；删除后我们将停止为您提供服务，法律法规要求留存的记录除外。
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            七、Cookie 与会话
          </h2>
          <p>
            我们使用必要的 Cookie 维持您的登录会话与访问安全，不将其用于广告追踪。您可通过浏览器设置清除 Cookie，但可能因此无法正常使用需登录的功能。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            八、政策更新与联系方式
          </h2>
          <p>
            8.1 我们可能适时修订本政策，修订后在站内公示；涉及重大变更的，我们将通过站内通知等方式提示。
          </p>
          <p className="mt-2">
            8.2 如您对本政策或个人信息处理有任何疑问、意见或投诉，可通过{" "}
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="text-amber-900 underline underline-offset-2"
            >
              {SITE.contactEmail}
            </a>{" "}
            与我们联系，我们将在合理期限内答复。
          </p>
        </section>

        <section className="border-t border-stone-200 pt-6 text-stone-600">
          <p>
            {SITE.companyName} · 生效日期：2026年9月 · 版本：v1.0
          </p>
        </section>
      </div>
    </div>
  );
}
