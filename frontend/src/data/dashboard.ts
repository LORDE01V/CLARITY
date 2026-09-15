import {
  CalendarDays,
  Circle,
  Code2,
  GitPullRequest,
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

export interface RecapItem {
  title: string;
  meta: string;
  initials: string;
  color: string;
  text: string;
}

export interface ActivityItem {
  icon: LucideIcon;
  title: string;
  desc: string;
  time: string;
  tone: string;
}

export interface MeetingItem {
  title: string;
  time: string;
  avatars: string[];
  tone: string;
}

export interface StatCard {
  label: string;
  value: string;
  badge: string;
  badgeTone: string;
  hint: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Tasks", icon: SquareCheckBig },
  { label: "Chat", icon: MessageCircle, count: "4" },
  { label: "Team", icon: Users },
  { label: "Meetings", icon: Video },
  { label: "Code", icon: Code2, count: "3" },
];

export const STAT_CARDS: StatCard[] = [
  {
    label: "Open tasks",
    value: "24",
    badge: "+8.4%",
    badgeTone: "bg-accent text-primary",
    hint: "from last week",
    icon: SquareCheckBig,
  },
  {
    label: "Meetings today",
    value: "6",
    badge: "2 hrs",
    badgeTone: "bg-secondary text-secondary-foreground",
    hint: "next one in 38 min",
    icon: CalendarDays,
  },
  {
    label: "Open PRs",
    value: "8",
    badge: "3 review",
    badgeTone: "bg-[#f7ebdb] text-chart-3",
    hint: "across 4 repositories",
    icon: GitPullRequest,
  },
];

export const RECAPS: RecapItem[] = [
  {
    title: "Q3 planning sync",
    meta: "Today · 10:30 AM",
    initials: "AM",
    color: "bg-[#e0f1f2]",
    text: "text-[#147d85]",
  },
  {
    title: "Design critique — checkout",
    meta: "Yesterday · 4:00 PM",
    initials: "SK",
    color: "bg-[#eee9f7]",
    text: "text-[#7456a3]",
  },
  {
    title: "Engineering weekly",
    meta: "Yesterday · 11:00 AM",
    initials: "JR",
    color: "bg-[#f7ebdb]",
    text: "text-[#a66b31]",
  },
];

export const ACTIVITIES: ActivityItem[] = [
  {
    icon: GitPullRequest,
    title: "Maya opened PR #482",
    desc: "Add keyboard shortcuts to editor",
    time: "18m ago",
    tone: "text-primary bg-accent",
  },
  {
    icon: Circle,
    title: "Issue #128 was closed",
    desc: "Mobile navigation overlaps modal",
    time: "1h ago",
    tone: "text-chart-4 bg-secondary",
  },
  {
    icon: GitPullRequest,
    title: "You were requested to review",
    desc: "PR #479 · Improve search indexing",
    time: "3h ago",
    tone: "text-primary bg-accent",
  },
];

export const MEETINGS: MeetingItem[] = [
  {
    title: "Activation working session",
    time: "11:30 AM — 12:15 PM",
    avatars: ["MC", "JW", "SK"],
    tone: "bg-[#147d85]",
  },
  {
    title: "Product design review",
    time: "2:00 PM — 3:00 PM",
    avatars: ["AM", "JR"],
    tone: "bg-[#7456a3]",
  },
  {
    title: "Team standup",
    time: "4:30 PM — 4:45 PM",
    avatars: ["JD", "MC", "JW", "SK"],
    tone: "bg-[#a66b31]",
  },
];

export const RECAP_ACTION_ITEMS = [
  "Share onboarding audit findings",
  "Draft new welcome flow concepts",
  "Schedule Friday follow-up",
];

export const DEFAULT_RECAP_SUMMARY =
  "The team aligned on Q3 priorities, focusing on improving activation and reducing time-to-value for new customers.\n\nMaya will lead the onboarding refresh, while James will audit the current activation funnel and share findings next week. The group agreed to regroup on Friday to review early concepts.";
