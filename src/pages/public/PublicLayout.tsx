import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LOGIN_PATH } from "@/const";
import { SITE } from "@contracts/site";
import { Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, NavLink, Outlet } from "react-router";

/**
 * 公开营销页共用布局：顶部导航 + 底部 footer。
 * 低饱和暖色系（stone/amber），无登录门槛。
 */
export default function PublicLayout() {
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    { to: "/features", label: t("nav.features") },
    { to: "/pricing", label: t("nav.pricing") },
    { to: "/tools/title-check", label: t("nav.titleCheck") },
    { to: "/tools/filing-wizard", label: t("nav.filingWizard") },
    { to: "/docs", label: t("nav.docs") },
    { to: "/faq", label: t("nav.faq") },
    { to: "/cases", label: t("nav.cases") },
    { to: "/opensource", label: t("nav.opensource") },
  ];

  const goLogin = () => {
    setMobileNavOpen(false);
    window.location.href = LOGIN_PATH;
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white/85 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <ShieldCheck className="h-6 w-6 text-amber-800" />
            <span className="font-semibold text-lg tracking-tight">剧合规</span>
            <span className="text-xs text-stone-500 hidden md:inline">
              {t("footer.tagline")}
            </span>
          </Link>
          {/* 桌面导航：lg 起显示（英文文案较长，md 下会挤压溢出），超出时允许换行 */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-wrap">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-2.5 py-2 text-sm rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-amber-900 font-medium bg-amber-50"
                      : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <Button
              className="bg-amber-800 hover:bg-amber-900 text-white hidden lg:inline-flex whitespace-nowrap"
              onClick={() => (window.location.href = LOGIN_PATH)}
            >
              {t("nav.login")}
            </Button>
            {/* 移动端汉堡菜单 */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label={t("nav.menuLabel")}
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-800" />
                    剧合规
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 mt-6">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        `px-3 py-2.5 text-sm rounded-md transition-colors ${
                          isActive
                            ? "text-amber-900 font-medium bg-amber-50"
                            : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  <Button
                    className="mt-4 bg-amber-800 hover:bg-amber-900 text-white"
                    onClick={goLogin}
                  >
                    {t("nav.login")}
                  </Button>
                  <div className="mt-2 flex justify-start">
                    <LanguageSwitcher />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-10 grid gap-8 sm:grid-cols-[1fr_1.4fr_1fr] text-sm">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="h-5 w-5 text-amber-800" />
              <span className="font-semibold">剧合规</span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              {t("footer.disclaimer")}
            </p>
          </div>
          <div>
            <p className="font-medium mb-3">{t("footer.quickLinks")}</p>
            {/* 入口较多：双列网格，避免纵向一长串导致视觉失衡 */}
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-stone-600">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-amber-900 break-words">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/terms" className="hover:text-amber-900 break-words">
                  {t("footer.terms")}
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-amber-900 break-words">
                  {t("footer.privacy")}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-3">{t("footer.contactTitle")}</p>
            <ul className="space-y-2 text-stone-600">
              <li>
                {t("footer.contactBiz")}：{SITE.contactEmail}
              </li>
              <li>{t("footer.contactWechat")}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-100 py-4">
          <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-4 text-xs text-stone-400">
            <p className="flex-1 text-center">
              © {new Date().getFullYear()} {SITE.brand}
              {SITE.icpNo ? ` · ${SITE.icpNo}` : ""}
            </p>
            <LanguageSwitcher compact />
          </div>
        </div>
      </footer>
    </div>
  );
}
