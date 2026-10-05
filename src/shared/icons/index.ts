/**
 * Single icon surface for app code. Every icon import goes through here
 * (enforced by eslint no-restricted-imports), so the icon library is swappable
 * at runtime: each export is a thin wrapper that renders the active library's
 * version (Lucide default, Tabler/Phosphor lazy-loaded) and falls back to Lucide
 * until the chosen set's chunk arrives. Vendored shadcn primitives
 * (components/ui) import lucide directly and always stay Lucide.
 */
import {
  AlertCircle as LuAlertCircle,
  AlertTriangle as LuAlertTriangle,
  ArrowDown as LuArrowDown,
  ArrowDownLeft as LuArrowDownLeft,
  ArrowUp as LuArrowUp,
  ArrowUpDown as LuArrowUpDown,
  ArrowUpRight as LuArrowUpRight,
  Bell as LuBell,
  BellOff as LuBellOff,
  Boxes as LuBoxes,
  Building2 as LuBuilding,
  Calendar as LuCalendar,
  Camera as LuCamera,
  Check as LuCheck,
  CheckCircle2 as LuCheckCircle,
  ChevronDown as LuChevronDown,
  ChevronLeft as LuChevronLeft,
  ChevronRight as LuChevronRight,
  ChevronsLeft as LuChevronsLeft,
  ChevronsRight as LuChevronsRight,
  ChevronsUpDown as LuChevronsUpDown,
  ClipboardList as LuClipboardList,
  Clock as LuClock,
  Compass as LuCompass,
  Copy as LuCopy,
  CreditCard as LuCreditCard,
  Download as LuDownload,
  Eye as LuEye,
  EyeOff as LuEyeOff,
  File as LuFile,
  Fingerprint as LuFingerprint,
  FolderOpen as LuFolderOpen,
  House as LuHouse,
  Image as LuImage,
  Info as LuInfo,
  Keyboard as LuKeyboard,
  Laptop as LuLaptop,
  LayoutGrid as LuLayoutGrid,
  Link as LuLink,
  ListFilter as LuListFilter,
  Loader2 as LuLoader,
  Lock as LuLock,
  LogOut as LuLogOut,
  Mail as LuMail,
  MapPin as LuMapPin,
  Maximize2 as LuMaximize,
  Menu as LuMenu,
  MessageSquare as LuMessageSquare,
  Minimize as LuMinimize,
  Minus as LuMinus,
  Monitor as LuMonitor,
  MonitorSmartphone as LuMonitorSmartphone,
  Moon as LuMoon,
  MoreHorizontal as LuMoreHorizontal,
  Package as LuPackage,
  Palette as LuPalette,
  PanelRightClose as LuPanelRightClose,
  PanelRightOpen as LuPanelRightOpen,
  Pause as LuPause,
  PenLine as LuPenLine,
  Phone as LuPhone,
  Pill as LuPill,
  Play as LuPlay,
  Plug as LuPlug,
  Plus as LuPlus,
  Printer as LuPrinter,
  ReceiptText as LuReceiptText,
  RefreshCw as LuRefreshCw,
  Rocket as LuRocket,
  RotateCw as LuRotateCw,
  Search as LuSearch,
  Send as LuSend,
  Settings as LuSettings,
  Shield as LuShield,
  ShieldAlert as LuShieldAlert,
  ShieldCheck as LuShieldCheck,
  SlidersHorizontal as LuSlidersHorizontal,
  Sparkles as LuSparkles,
  SquareCheck as LuSquareCheck,
  Star as LuStar,
  Stethoscope as LuStethoscope,
  Sun as LuSun,
  Tag as LuTag,
  Trash2 as LuTrash,
  TriangleAlert as LuTriangleAlert,
  User as LuUser,
  UserCog as LuUserCog,
  UserPlus as LuUserPlus,
  Users as LuUsers,
  Wallet as LuWallet,
  X as LuX,
  XCircle as LuXCircle,
  Zap as LuZap,
} from 'lucide-react';
import { createElement } from 'react';

import { useThemeStore } from '@/shared/store/useThemeStore/index.ts';

// lucide-react 1.0 removed brand icons — the GitHub, Instagram and WhatsApp
// marks are vendored locally (`*-mark.tsx`).
import { GithubMark as LuGithub } from './github-mark.tsx';
import type { IconName } from './icon-names.ts';
import { useIconSet } from './icon-registry.ts';
import type { AppIcon, IconProps } from './icon-types.ts';
import { InstagramMark as LuInstagramMark } from './instagram-mark.tsx';
import { WhatsAppMark as LuWhatsAppMark } from './whatsapp-mark.tsx';

/**
 * A swappable icon: renders the active library's version, Lucide as fallback.
 *
 * The Lucide component is passed in, not looked up by name in a map: a lookup
 * keeps every icon in the map live the moment any one icon renders, so icons
 * nothing imports still shipped. Marked side-effect free so a bundler drops the
 * export (and its Lucide icon) when nothing imports it.
 */
/* @__NO_SIDE_EFFECTS__ */
function makeIcon(name: IconName, lucide: AppIcon): AppIcon {
  function Icon(props: IconProps) {
    const lib = useThemeStore((s) => s.iconLibrary);
    const set = useIconSet(lib);
    const Component = set?.[name] ?? lucide;
    return createElement(Component, props);
  }
  Icon.displayName = name;
  return Icon;
}

export type { AppIcon, IconProps } from './icon-types.ts';
/** Alias for {@link AppIcon} — the type used by `icon` props across the app. */
export type LucideIcon = AppIcon;

export const AlertCircle = makeIcon('AlertCircle', LuAlertCircle);
export const AlertTriangle = makeIcon('AlertTriangle', LuAlertTriangle);
export const ArrowDown = makeIcon('ArrowDown', LuArrowDown);
/** Lucide `arrow-down-left`: money received. */
export const ArrowDownLeft = makeIcon('ArrowDownLeft', LuArrowDownLeft);
export const ArrowUp = makeIcon('ArrowUp', LuArrowUp);
/** Lucide `arrow-up-down`: a sortable column that is not sorted. */
export const ArrowUpDown = makeIcon('ArrowUpDown', LuArrowUpDown);
/** Lucide `arrow-up-right`: money paid out. */
export const ArrowUpRight = makeIcon('ArrowUpRight', LuArrowUpRight);
export const Bell = makeIcon('Bell', LuBell);
export const BellOff = makeIcon('BellOff', LuBellOff);
export const Boxes = makeIcon('Boxes', LuBoxes);
export const Building = makeIcon('Building', LuBuilding);
/** Lucide `calendar`: appointments and dates. */
export const Calendar = makeIcon('Calendar', LuCalendar);
/** Lucide `camera`: photos and photo uploads. */
export const Camera = makeIcon('Camera', LuCamera);
export const Check = makeIcon('Check', LuCheck);
export const CheckCircle = makeIcon('CheckCircle', LuCheckCircle);
/** Lucide `chevron-down`: a picker that opens (rotate it 180° while open). */
export const ChevronDown = makeIcon('ChevronDown', LuChevronDown);
export const ChevronLeft = makeIcon('ChevronLeft', LuChevronLeft);
export const ChevronRight = makeIcon('ChevronRight', LuChevronRight);
export const ChevronsLeft = makeIcon('ChevronsLeft', LuChevronsLeft);
export const ChevronsRight = makeIcon('ChevronsRight', LuChevronsRight);
export const ChevronsUpDown = makeIcon('ChevronsUpDown', LuChevronsUpDown);
/** Lucide `clipboard-list`: reports and stock checks. */
export const ClipboardList = makeIcon('ClipboardList', LuClipboardList);
/** Lucide `clock`: planned and time-bound items. */
export const Clock = makeIcon('Clock', LuClock);
/** Lucide `compass`: all sections, the tab bar's More. */
export const Compass = makeIcon('Compass', LuCompass);
export const Copy = makeIcon('Copy', LuCopy);
export const CreditCard = makeIcon('CreditCard', LuCreditCard);
export const Download = makeIcon('Download', LuDownload);
export const Eye = makeIcon('Eye', LuEye);
export const EyeOff = makeIcon('EyeOff', LuEyeOff);
/** Lucide `file`: files and uploads; named so it never shadows the DOM `File`. */
export const FileIcon = makeIcon('FileIcon', LuFile);
export const Fingerprint = makeIcon('Fingerprint', LuFingerprint);
/** Lucide `folder-open`: a patient file's sections. */
export const FolderOpen = makeIcon('FolderOpen', LuFolderOpen);
export const Github = makeIcon('Github', LuGithub);
/** Lucide `house`: Today, walk-ins and who is in the clinic. */
export const House = makeIcon('House', LuHouse);
/** Lucide `image`: photos; named so it never shadows the DOM `Image`. */
export const ImageIcon = makeIcon('ImageIcon', LuImage);
/** Lucide `info`: hints and notes. */
export const Info = makeIcon('Info', LuInfo);
/** Instagram brand mark, drawn locally (lucide-react ships no brand icons). */
export const InstagramMark = makeIcon('InstagramMark', LuInstagramMark);
export const Keyboard = makeIcon('Keyboard', LuKeyboard);
export const Laptop = makeIcon('Laptop', LuLaptop);
/** Lucide `layout-grid`: overviews and browse panels. */
export const LayoutGrid = makeIcon('LayoutGrid', LuLayoutGrid);
/** Lucide `link`: links; named so it never shadows the router's `Link`. */
export const LinkIcon = makeIcon('LinkIcon', LuLink);
/** Lucide `list-filter`: the Filters button. */
export const ListFilter = makeIcon('ListFilter', LuListFilter);
export const Loader = makeIcon('Loader', LuLoader);
/** Lucide `lock`: private and locked items. */
export const Lock = makeIcon('Lock', LuLock);
export const LogOut = makeIcon('LogOut', LuLogOut);
export const Mail = makeIcon('Mail', LuMail);
/** Lucide `map-pin`: branches, locations and pins. */
export const MapPin = makeIcon('MapPin', LuMapPin);
/** Lucide `maximize-2`: show every table column. */
export const Maximize = makeIcon('Maximize', LuMaximize);
export const Menu = makeIcon('Menu', LuMenu);
/** Lucide `message-square`: notes, SMS and chat. */
export const MessageSquare = makeIcon('MessageSquare', LuMessageSquare);
/** Lucide `minimize`: fit the table to its width. */
export const Minimize = makeIcon('Minimize', LuMinimize);
export const Minus = makeIcon('Minus', LuMinus);
export const Monitor = makeIcon('Monitor', LuMonitor);
export const MonitorSmartphone = makeIcon('MonitorSmartphone', LuMonitorSmartphone);
export const Moon = makeIcon('Moon', LuMoon);
export const MoreHorizontal = makeIcon('MoreHorizontal', LuMoreHorizontal);
/** Lucide `package`: clinic stock, packages and purchases. */
export const Package = makeIcon('Package', LuPackage);
export const Palette = makeIcon('Palette', LuPalette);
/** Lucide `panel-right-close`: close a side panel (mirror it under RTL). */
export const PanelRightClose = makeIcon('PanelRightClose', LuPanelRightClose);
/** Lucide `panel-right-open`: open a side panel (mirror it under RTL). */
export const PanelRightOpen = makeIcon('PanelRightOpen', LuPanelRightOpen);
/** Lucide `pause`: pause something running. */
export const Pause = makeIcon('Pause', LuPause);
/** Lucide `pen-line`: edit. */
export const PenLine = makeIcon('PenLine', LuPenLine);
/** Lucide `phone`: calls. */
export const Phone = makeIcon('Phone', LuPhone);
/** Lucide `pill`: medicines and prescriptions. */
export const Pill = makeIcon('Pill', LuPill);
/** Lucide `play`: start or resume. */
export const Play = makeIcon('Play', LuPlay);
export const Plus = makeIcon('Plus', LuPlus);
export const Plug = makeIcon('Plug', LuPlug);
/** Lucide `printer`: print. */
export const Printer = makeIcon('Printer', LuPrinter);
/**
 * Lucide `receipt-text`: invoices and sales — the design's `receipt` draws text
 * lines on the slip (H:3012), where Lucide `receipt` draws a `$`.
 */
export const Receipt = makeIcon('Receipt', LuReceiptText);
/** Lucide `refresh-cw`: redo or change (`RotateCw` is another glyph). */
export const RefreshCw = makeIcon('RefreshCw', LuRefreshCw);
export const Rocket = makeIcon('Rocket', LuRocket);
export const RotateCw = makeIcon('RotateCw', LuRotateCw);
export const Search = makeIcon('Search', LuSearch);
/** Lucide `send`: send a message. */
export const Send = makeIcon('Send', LuSend);
export const Settings = makeIcon('Settings', LuSettings);
export const ShieldAlert = makeIcon('ShieldAlert', LuShieldAlert);
export const Shield = makeIcon('Shield', LuShield);
export const ShieldCheck = makeIcon('ShieldCheck', LuShieldCheck);
export const SlidersHorizontal = makeIcon('SlidersHorizontal', LuSlidersHorizontal);
export const Sparkles = makeIcon('Sparkles', LuSparkles);
/** Lucide `square-check`: tasks and checked items. */
export const SquareCheck = makeIcon('SquareCheck', LuSquareCheck);
/** Lucide `star`: reviews. */
export const Star = makeIcon('Star', LuStar);
/** Lucide `stethoscope`: clinical notes. */
export const Stethoscope = makeIcon('Stethoscope', LuStethoscope);
export const Sun = makeIcon('Sun', LuSun);
/** Lucide `tag`: offerings and discounts. */
export const Tag = makeIcon('Tag', LuTag);
export const Trash = makeIcon('Trash', LuTrash);
export const TriangleAlert = makeIcon('TriangleAlert', LuTriangleAlert);
export const User = makeIcon('User', LuUser);
export const UserCog = makeIcon('UserCog', LuUserCog);
export const UserPlus = makeIcon('UserPlus', LuUserPlus);
export const Users = makeIcon('Users', LuUsers);
/** Lucide `wallet`: payments and collections. */
export const Wallet = makeIcon('Wallet', LuWallet);
/** WhatsApp brand mark, drawn locally (lucide-react ships no brand icons). */
export const WhatsAppMark = makeIcon('WhatsAppMark', LuWhatsAppMark);
export const X = makeIcon('X', LuX);
export const XCircle = makeIcon('XCircle', LuXCircle);
export const Zap = makeIcon('Zap', LuZap);
