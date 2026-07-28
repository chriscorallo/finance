import {
  LayoutDashboard,
  ArrowLeftRight,
  Receipt,
  Repeat,
  CalendarDays,
  PiggyBank,
  Wallet,
  LineChart,
  CreditCard,
  Target,
  TrendingUp,
  Sparkles,
  FileBarChart,
  Bell,
  ShieldCheck,
  Lock,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Cash Flow", href: "/cash-flow", icon: ArrowLeftRight },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Recurring", href: "/recurring", icon: Repeat },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Budgets", href: "/budgets", icon: PiggyBank },
  { label: "Accounts", href: "/accounts", icon: Wallet },
  { label: "Net Worth", href: "/net-worth", icon: LineChart },
  { label: "Debts", href: "/debts", icon: CreditCard },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Forecast", href: "/forecast", icon: TrendingUp },
  { label: "AI Advisor", href: "/ai-advisor", icon: Sparkles },
  { label: "Reports", href: "/reports", icon: FileBarChart },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Data Quality", href: "/data-quality", icon: ShieldCheck },
  { label: "Security", href: "/settings/security", icon: Lock },
  { label: "Settings", href: "/settings", icon: Settings },
];
