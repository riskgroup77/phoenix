/**
 * Bitta manba — barcha rol navigatsiyasi (Header, Sidebar, BottomNav).
 * Hech qanday havola yo'qolmasin: Sidebar.tsx + Header.tsx + BottomNavBar.tsx birlashtirildi.
 */
import {
  LayoutDashboard,
  FileText,
  Upload,
  Users,
  Library,
  BookMarked,
  CheckCircle,
  Sparkles,
  DollarSign,
  Archive,
  Languages,
  FolderArchive,
  MessageSquare,
  Bot,
  FilePlus,
  UserCircle,
  BookOpen,
  CreditCard,
  Bell,
  Settings,
  HelpCircle,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Role } from '../types';

export type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Tashqi havola (mailto va h.k.) */
  external?: boolean;
};

export type RoleNavSections = {
  /** Asosiy ish oqimi */
  primary: NavItem[];
  /** Qo'shimcha vositalar (divider dan oldin) */
  tools?: NavItem[];
  /** Hisob va yordam (divider dan keyin) */
  account?: NavItem[];
};

export const roleNames: Record<Role, string> = {
  [Role.Author]: 'Muallif',
  [Role.Reviewer]: 'Taqrizchi',
  [Role.JournalAdmin]: 'Jurnal administratori',
  [Role.SuperAdmin]: 'Bosh administrator',
  [Role.Accountant]: 'Moliyachi',
  [Role.Operator]: 'Operator',
};

/** Sidebar: to'liq navigatsiya */
export const sidebarNavByRole: Record<Role, RoleNavSections> = {
  [Role.Author]: {
    primary: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
      { to: '/articles', icon: FileText, label: 'Maqolalarim' },
      { to: '/submit', icon: Upload, label: 'Maqola yuborish' },
      { to: '/services', icon: Sparkles, label: 'Xizmatlar' },
    ],
    tools: [
      { to: '/my-collections', icon: Archive, label: "To'plamlarim" },
      { to: '/my-translations', icon: Languages, label: 'Tarjimalarim' },
      { to: '/arxiv', icon: FolderArchive, label: 'Arxiv hujjatlar' },
      { to: '/author-publications', icon: BookOpen, label: 'Muallif nashrlari' },
    ],
    account: [
      { to: '/profile', icon: CreditCard, label: "To'lovlar" },
      { to: '/profile', icon: Bell, label: 'Bildirishnomalar' },
      { to: '/profile', icon: UserCircle, label: 'Profil' },
      { to: '/profile', icon: Settings, label: 'Sozlamalar' },
    ],
  },
  [Role.Reviewer]: {
    primary: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Ishchi stol' },
      { to: '/articles', icon: FileText, label: 'Taqrizga kelganlar' },
      { to: '/articles?tab=translations', icon: Languages, label: 'Tarjima buyurtmalari' },
      { to: '/articles?tab=book-orders', icon: BookOpen, label: 'Kitob nashr buyurtmalari' },
      { to: '/doi-requests', icon: Bot, label: "DOI so'rovlari" },
      { to: '/udk-requests', icon: Library, label: "UDK so'rovlari" },
    ],
    account: [
      { to: '/profile', icon: UserCircle, label: 'Profil' },
      { to: '/profile', icon: Settings, label: 'Sozlamalar' },
    ],
  },
  [Role.JournalAdmin]: {
    primary: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
      { to: '/journal-admin-panel', icon: FileText, label: 'Jurnal maqolalari' },
      { to: '/articles', icon: FileText, label: 'Nashrga tayyorlar' },
      { to: '/published-articles', icon: CheckCircle, label: 'Nashr etilganlar' },
    ],
    tools: [
      { to: '/author-publications', icon: BookOpen, label: 'Muallif nashrlari' },
    ],
    account: [
      { to: '/profile', icon: UserCircle, label: 'Profil' },
    ],
  },
  [Role.SuperAdmin]: {
    primary: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
      { to: '/users', icon: Users, label: 'Foydalanuvchilar' },
      { to: '/articles', icon: FileText, label: 'Barcha maqolalar' },
      { to: '/journal-management', icon: BookMarked, label: 'Jurnallar' },
      { to: '/prices', icon: DollarSign, label: 'Narxlar' },
    ],
    tools: [
      { to: '/financials', icon: TrendingUp, label: 'Moliya' },
      { to: '/author-publications', icon: BookOpen, label: 'Muallif nashrlari' },
      { to: '/article-sample-requests', icon: FileText, label: 'Maqola namuna' },
      { to: '/doi-requests', icon: Bot, label: "DOI so'rovlari" },
      { to: '/udk-requests', icon: Library, label: "UDK so'rovlari" },
    ],
    account: [
      { to: '/profile', icon: UserCircle, label: 'Profil' },
    ],
  },
  [Role.Operator]: {
    primary: [
      { to: '/operator-dashboard', icon: LayoutDashboard, label: 'Operator paneli' },
      { to: '/articles', icon: MessageSquare, label: 'Maqolalar va chat' },
      { to: '/all-requests', icon: FileText, label: "Barcha so'rovlar" },
      { to: '/doi-requests', icon: Bot, label: "DOI so'rovlari" },
      { to: '/udk-requests', icon: Library, label: "UDK so'rovlari" },
      { to: '/article-sample-requests', icon: FilePlus, label: 'Maqola namuna' },
    ],
    account: [
      { to: '/profile', icon: UserCircle, label: 'Profil' },
    ],
  },
  [Role.Accountant]: {
    primary: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Boshqaruv paneli' },
      { to: '/financials', icon: DollarSign, label: 'Moliya' },
    ],
    account: [
      { to: '/profile', icon: UserCircle, label: 'Profil' },
    ],
  },
};

/** Mobil pastki navigatsiya — eng muhim 5-6 ta */
export const bottomNavByRole: Partial<Record<Role, NavItem[]>> = {
  [Role.Author]: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Asosiy' },
    { to: '/articles', icon: FileText, label: 'Maqolalar' },
    { to: '/submit', icon: Upload, label: 'Yuborish' },
    { to: '/services', icon: Sparkles, label: 'Xizmatlar' },
    { to: '/profile', icon: UserCircle, label: 'Profil' },
  ],
  [Role.Reviewer]: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Stol' },
    { to: '/articles', icon: FileText, label: 'Taqriz' },
    { to: '/articles?tab=translations', icon: Languages, label: 'Tarjima' },
    { to: '/articles?tab=book-orders', icon: BookOpen, label: 'Kitob' },
    { to: '/profile', icon: UserCircle, label: 'Profil' },
  ],
  [Role.JournalAdmin]: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Asosiy' },
    { to: '/articles', icon: FileText, label: 'Maqolalar' },
    { to: '/published-articles', icon: CheckCircle, label: 'Nashr' },
    { to: '/journal-admin-panel', icon: FileText, label: 'Jurnal' },
  ],
  [Role.SuperAdmin]: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Asosiy' },
    { to: '/articles', icon: FileText, label: 'Maqolalar' },
    { to: '/users', icon: Users, label: 'Userlar' },
    { to: '/journal-management', icon: BookMarked, label: 'Jurnallar' },
    { to: '/financials', icon: DollarSign, label: 'Moliya' },
  ],
  [Role.Operator]: [
    { to: '/operator-dashboard', icon: LayoutDashboard, label: 'Panel' },
    { to: '/all-requests', icon: FileText, label: "So'rovlar" },
    { to: '/articles', icon: MessageSquare, label: 'Chat' },
    { to: '/profile', icon: UserCircle, label: 'Profil' },
  ],
  [Role.Accountant]: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Asosiy' },
    { to: '/financials', icon: DollarSign, label: 'Moliya' },
    { to: '/profile', icon: UserCircle, label: 'Profil' },
  ],
};

export function flattenSidebarNav(role: Role): NavItem[] {
  const s = sidebarNavByRole[role];
  if (!s) return [];
  return [...s.primary, ...(s.tools ?? []), ...(s.account ?? [])];
}
