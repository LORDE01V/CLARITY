import {
  Clock3,
  Code2,
  FileText,
  LayoutDashboard,
  MessageCircle,
  SquareCheckBig,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  count?: string;
}

export interface ActivityItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  time: string;
  tone: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Tasks", icon: SquareCheckBig },
  { label: "Timesheets", icon: Clock3 },
  { label: "Docs", icon: FileText },
  { label: "Chat", icon: MessageCircle },
  { label: "Team", icon: Users },
  { label: "Meetings", icon: Video },
  { label: "Code", icon: Code2 },
];
