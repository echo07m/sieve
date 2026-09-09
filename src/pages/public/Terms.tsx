import { SITE } from "@contracts/site";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/**
 * 用户协议（/terms）。责任主体与联系邮箱统一取自 @contracts/site 的 SITE 常量，
 * 取得营业执照主体全称与正式商务邮箱后只需修改 contracts/site.ts。
 */
export default function Terms() {
  useDocumentTitle("用户协议 - 剧合规");

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <header className="mb-10 border-b border-stone-200 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          用户协议
        </h1>
        <p className="mt-3 text-sm text-stone-500">
          生效日期：2026年9月 · 版本：v1.0
        </p>
      </header>

      <div className="space-y-10 text-sm leading-7 text-stone-700">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            一、服务定义与性质
          </h2>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-900">
            本服务为AI短剧/漫剧上线前的合规预检工具，检测结果仅为参考性技术意见，不构成过审保证，不构成法律意见。作品能否上线、是否过审，最终以播出平台及监管机构的审核结论为准。
          </div>
          <p className="mt-3">
            1.1 「{SITE.brand}」（以下简称"本服务"）由{SITE.companyName}
            （以下简称"我们"）运营，面向短剧/漫剧制作方、发行方及相关从业者，提供剧本合规预检、成片抽帧比对、备案材料生成、平台差分适配等上线前辅助检测功能。
          </p>
          <p className="mt-2">
            1.2
            本服务的检测结果基于我们维护的规则库与算法模型输出，附置信度与依据条文，供您在送审前发现并整改高风险内容之用。检测结果不构成任何形式的过审承诺、法律意见或行政合规结论；您应自行或聘请专业法律人士对作品内容承担最终审查义务。
          </p>
          <p className="mt-2">
            1.3 监管口径与平台规则可能随时调整。规则库滚动更新后生成新的规则版本号，历史报告可通过版本号回溯当时的判定口径，但不代表更新后口径下的合规结论。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            二、账号与订阅
          </h2>
          <p>
            2.1 您须使用 Kimi 账号（OAuth）登录本服务。您应保证账号信息真实有效，妥善保管账号凭证；账号项下的一切操作视为您本人行为。
          </p>
          <p className="mt-2">2.2 本服务提供四档方案：</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>免费试检：注册即享 3 次免费检测额度；</li>
            <li>按部付费：按单部剧本/成片检测计费；</li>
            <li>团队订阅：按月订阅，含团队配额与优先更新；</li>
            <li>企业 API 年框：按年签约，提供 API 调用额度。</li>
          </ul>
          <p className="mt-2">
            2.3
            各方案的检测配额以您签约的订单载明为准；配额按自然周期计算，当期未用完的配额除合同另有约定外不顺延。平台内不接入在线支付，方案开通以双方线下签署合同并实际收款为准。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            三、付费与退款
          </h2>
          <p>
            3.1 本服务的收费标准、付款方式、开票事项以双方签署的商务合同及订单为准。本页面及站内的价格信息仅为参考，不构成要约。
          </p>
          <p className="mt-2">
            3.2 因我们系统故障导致检测任务失败且未生成有效报告的，已扣除的检测额度将自动退还至您的账户。
          </p>
          <p className="mt-2">
            3.3 已生成并交付的检测报告，因检测服务已实际履行，原则上不予退款；双方另有书面约定的除外。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            四、用户内容
          </h2>
          <p>
            4.1 您上传的剧本、字幕、成片等内容的著作权及相关权利仍归您或原权利人所有，本服务不因检测而取得您内容的任何权利。
          </p>
          <p className="mt-2">
            4.2 您保证对上传内容享有合法权利或已获得充分授权，上传内容不侵犯任何第三方的著作权、肖像权、名誉权等合法权益，不含法律法规禁止的内容。因您上传内容引发的纠纷与责任由您自行承担；给我们造成损失的，您应予赔偿。
          </p>
          <p className="mt-2">
            4.3 我们仅为向您提供检测与报告生成服务之目的处理您的内容，不将您的内容用于训练模型或其他超出服务目的之用途。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            五、数据安全承诺
          </h2>
          <p>5.1 成片视频的画面抽帧在您的浏览器本地完成计算，原始画面不上传至我们的服务器，原始画面上传为零。</p>
          <p className="mt-2">
            5.2 抽帧比对仅留存画面的 SHA-256
            哈希值用于相似性核验，哈希值不可逆还原为原始画面。
          </p>
          <p className="mt-2">
            5.3 剧本原文仅用于当次检测与报告生成；报告以 SHA-256 内容哈希、时间戳与规则版本号存证。详见《隐私政策》。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            六、禁止行为
          </h2>
          <p>您不得利用本服务从事下列行为：</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>制作、上传、传播违反法律法规或监管规定的内容；</li>
            <li>恶意攻击、探测、压测本服务的配额、接口或基础设施，或绕过限流与权限控制；</li>
            <li>对本服务进行反向工程、反编译、抓取规则库，或以其他方式试图获取源代码与规则数据；</li>
            <li>将账号、API Key 转让、出租、出借给第三方使用；</li>
            <li>其他损害我们或第三方合法权益的行为。</li>
          </ul>
          <p className="mt-2">
            违反上述约定的，我们有权暂停或终止向您提供服务，并保留追究法律责任的权利。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            七、知识产权
          </h2>
          <p>
            7.1 本服务的规则库、检测算法、报告模板、界面设计及商标标识等知识产权归我们或相应权利人所有。未经书面许可，您不得复制、改编、传播或用于本服务以外的用途。
          </p>
          <p className="mt-2">
            7.2 您的剧本、字幕等上传内容及基于其生成的检测报告之著作权归您所有；我们为履行服务所需的存储、复制、传输行为不构成权利让渡。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            八、免责与责任上限
          </h2>
          <p>
            8.1 在法律允许的范围内，我们不对因使用或无法使用本服务造成的间接损失（包括但不限于预期利益损失、作品被下架或退审的损失、商誉损失）承担责任。
          </p>
          <p className="mt-2">
            8.2 因监管政策调整、平台审核口径变化、不可抗力或第三方原因导致检测结果与最终审核结论不一致的，我们不承担责任。
          </p>
          <p className="mt-2">
            8.3 我们就本服务承担的累计赔偿责任，以您就对应服务已实际支付的服务费总额为上限。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            九、协议变更与终止
          </h2>
          <p>
            9.1 我们可能根据法律法规与服务调整修订本协议，修订后在站内公示。涉及重大变更的，我们将通过站内通知等方式提示。您在变更生效后继续使用本服务的，视为接受修订后的协议。
          </p>
          <p className="mt-2">
            9.2 您可随时停止使用本服务并申请注销账号。您严重违反本协议的，我们有权终止向您提供服务。
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-stone-900">
            十、争议解决
          </h2>
          <p>
            10.1 本协议的订立、效力、解释与履行适用中华人民共和国法律（不含冲突规范）。
          </p>
          <p className="mt-2">
            10.2 因本协议产生的争议，双方应友好协商解决；协商不成的，任何一方均可向运营主体所在地人民法院提起诉讼。
          </p>
        </section>

        <section className="border-t border-stone-200 pt-6 text-stone-600">
          <p>
            如您对本协议有任何疑问，可通过{" "}
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="text-amber-900 underline underline-offset-2"
            >
              {SITE.contactEmail}
            </a>{" "}
            与我们联系。
          </p>
          <p className="mt-2">
            {SITE.companyName} · 生效日期：2026年9月 · 版本：v1.0
          </p>
        </section>
      </div>
    </div>
  );
}
