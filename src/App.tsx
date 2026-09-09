import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Login from "./pages/Login"
import NotFound from "./pages/NotFound"
import Dashboard from "./pages/Dashboard"
import SubmitNew from "./pages/SubmitNew"
import Submissions from "./pages/Submissions"
import ReportDetail from "./pages/ReportDetail"
import Rules from "./pages/Rules"
import FilingList from "./pages/FilingList"
import FilingNew from "./pages/FilingNew"
import FilingDetail from "./pages/FilingDetail"
import Copyright from "./pages/Copyright"
import ApiKeys from "./pages/ApiKeys"
import Analytics from "./pages/Analytics"
import Platforms from "./pages/Platforms"
import Deliveries from "./pages/Deliveries"
import Marking from "./pages/Marking"
import CustomRules from "./pages/CustomRules"
import Billing from "./pages/Billing"
import Notifications from "./pages/Notifications"
import LeadsAdmin from "./pages/admin/LeadsAdmin"
import AdminOverview from "./pages/admin/AdminOverview"
import AdminUsers from "./pages/admin/AdminUsers"
import AdminRules from "./pages/admin/AdminRules"
import AdminPlatforms from "./pages/admin/AdminPlatforms"
import PublicLayout from "./pages/public/PublicLayout"
import Pricing from "./pages/public/Pricing"
import Features from "./pages/public/Features"
import DocsPage from "./pages/public/DocsPage"
import FaqPage from "./pages/public/FaqPage"
import AdminOrders from "./pages/admin/AdminOrders"
import Terms from "./pages/public/Terms"
import Privacy from "./pages/public/Privacy"
import TitleCheck from "./pages/public/TitleCheck"
import FilingWizard from "./pages/public/FilingWizard"
import AdminCases from "./pages/admin/AdminCases";
import Cases from "./pages/public/Cases";
import OpenSource from "./pages/public/OpenSource"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/submit" element={<SubmitNew />} />
      <Route path="/submissions" element={<Submissions />} />
      <Route path="/submissions/:id" element={<ReportDetail />} />
      <Route path="/rules" element={<Rules />} />
      <Route path="/filing" element={<FilingList />} />
      <Route path="/filing/new" element={<FilingNew />} />
      <Route path="/filing/:id" element={<FilingDetail />} />
      <Route path="/copyright" element={<Copyright />} />
      <Route path="/api-keys" element={<ApiKeys />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/platforms" element={<Platforms />} />
      <Route path="/deliveries" element={<Deliveries />} />
      <Route path="/marking" element={<Marking />} />
      <Route path="/custom-rules" element={<CustomRules />} />
      <Route path="/billing" element={<Billing />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/admin" element={<AdminOverview />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/rules" element={<AdminRules />} />
      <Route path="/admin/platforms" element={<AdminPlatforms />} />
      <Route path="/admin/orders" element={<AdminOrders />} />
      <Route path="/admin/leads" element={<LeadsAdmin />} />
      <Route path="/admin/cases" element={<AdminCases />} />
      <Route element={<PublicLayout />}>
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/features" element={<Features />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/tools/title-check" element={<TitleCheck />} />
        <Route path="/tools/filing-wizard" element={<FilingWizard />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/opensource" element={<OpenSource />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
