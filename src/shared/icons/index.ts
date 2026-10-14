/**
 * Single icon surface for app code. Every icon import goes through here
 * (enforced by eslint no-restricted-imports), so the app names its icons in one
 * file: each export is the Lucide glyph under the app's name for it (a
 * one-file icon-library swap, should one ever be wanted). Vendored shadcn
 * primitives (components/ui) import lucide directly.
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
  Factory as LuFactory,
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
  ShoppingCart as LuShoppingCart,
  SlidersHorizontal as LuSlidersHorizontal,
  Sparkles as LuSparkles,
  SquareCheck as LuSquareCheck,
  Star as LuStar,
  Stethoscope as LuStethoscope,
  Sun as LuSun,
  Tag as LuTag,
  Trash2 as LuTrash,
  TriangleAlert as LuTriangleAlert,
  Truck as LuTruck,
  User as LuUser,
  UserCog as LuUserCog,
  UserPlus as LuUserPlus,
  Users as LuUsers,
  Wallet as LuWallet,
  X as LuX,
  XCircle as LuXCircle,
  Zap as LuZap,
} from 'lucide-react';

// lucide-react 1.0 removed brand icons — the GitHub, Instagram and WhatsApp
// marks are vendored locally (`*-mark.tsx`).
import { GithubMark as LuGithub } from './github-mark.tsx';
import type { AppIcon } from './icon-types.ts';
import { InstagramMark as LuInstagramMark } from './instagram-mark.tsx';
import { WhatsAppMark as LuWhatsAppMark } from './whatsapp-mark.tsx';

export type { AppIcon, IconProps } from './icon-types.ts';
/** Alias for {@link AppIcon} — the type used by `icon` props across the app. */
export type LucideIcon = AppIcon;

export const AlertCircle: AppIcon = LuAlertCircle;
export const AlertTriangle: AppIcon = LuAlertTriangle;
export const ArrowDown: AppIcon = LuArrowDown;
/** Lucide `arrow-down-left`: money received. */
export const ArrowDownLeft: AppIcon = LuArrowDownLeft;
export const ArrowUp: AppIcon = LuArrowUp;
/** Lucide `arrow-up-down`: a sortable column that is not sorted. */
export const ArrowUpDown: AppIcon = LuArrowUpDown;
/** Lucide `arrow-up-right`: money paid out. */
export const ArrowUpRight: AppIcon = LuArrowUpRight;
export const Bell: AppIcon = LuBell;
export const BellOff: AppIcon = LuBellOff;
export const Boxes: AppIcon = LuBoxes;
export const Building: AppIcon = LuBuilding;
/** Lucide `calendar`: appointments and dates. */
export const Calendar: AppIcon = LuCalendar;
/** Lucide `camera`: photos and photo uploads. */
export const Camera: AppIcon = LuCamera;
export const Check: AppIcon = LuCheck;
export const CheckCircle: AppIcon = LuCheckCircle;
/** Lucide `chevron-down`: a picker that opens (rotate it 180° while open). */
export const ChevronDown: AppIcon = LuChevronDown;
export const ChevronLeft: AppIcon = LuChevronLeft;
export const ChevronRight: AppIcon = LuChevronRight;
export const ChevronsLeft: AppIcon = LuChevronsLeft;
export const ChevronsRight: AppIcon = LuChevronsRight;
export const ChevronsUpDown: AppIcon = LuChevronsUpDown;
/** Lucide `clipboard-list`: reports and stock checks. */
export const ClipboardList: AppIcon = LuClipboardList;
/** Lucide `clock`: planned and time-bound items. */
export const Clock: AppIcon = LuClock;
/** Lucide `compass`: all sections, the tab bar's More. */
export const Compass: AppIcon = LuCompass;
export const Copy: AppIcon = LuCopy;
export const CreditCard: AppIcon = LuCreditCard;
export const Download: AppIcon = LuDownload;
export const Eye: AppIcon = LuEye;
export const EyeOff: AppIcon = LuEyeOff;
/** Lucide `factory`: manufacturers. */
export const Factory: AppIcon = LuFactory;
/** Lucide `file`: files and uploads; named so it never shadows the DOM `File`. */
export const FileIcon: AppIcon = LuFile;
export const Fingerprint: AppIcon = LuFingerprint;
/** Lucide `folder-open`: a patient file's sections. */
export const FolderOpen: AppIcon = LuFolderOpen;
export const Github: AppIcon = LuGithub;
/** Lucide `house`: Today, walk-ins and who is in the clinic. */
export const House: AppIcon = LuHouse;
/** Lucide `image`: photos; named so it never shadows the DOM `Image`. */
export const ImageIcon: AppIcon = LuImage;
/** Lucide `info`: hints and notes. */
export const Info: AppIcon = LuInfo;
/** Instagram brand mark, drawn locally (lucide-react ships no brand icons). */
export const InstagramMark: AppIcon = LuInstagramMark;
export const Keyboard: AppIcon = LuKeyboard;
export const Laptop: AppIcon = LuLaptop;
/** Lucide `layout-grid`: overviews and browse panels. */
export const LayoutGrid: AppIcon = LuLayoutGrid;
/** Lucide `link`: links; named so it never shadows the router's `Link`. */
export const LinkIcon: AppIcon = LuLink;
/** Lucide `list-filter`: the Filters button. */
export const ListFilter: AppIcon = LuListFilter;
export const Loader: AppIcon = LuLoader;
/** Lucide `lock`: private and locked items. */
export const Lock: AppIcon = LuLock;
export const LogOut: AppIcon = LuLogOut;
export const Mail: AppIcon = LuMail;
/** Lucide `map-pin`: branches, locations and pins. */
export const MapPin: AppIcon = LuMapPin;
/** Lucide `maximize-2`: show every table column. */
export const Maximize: AppIcon = LuMaximize;
/** Lucide `message-square`: notes, SMS and chat. */
export const MessageSquare: AppIcon = LuMessageSquare;
/** Lucide `minimize`: fit the table to its width. */
export const Minimize: AppIcon = LuMinimize;
export const Minus: AppIcon = LuMinus;
export const Monitor: AppIcon = LuMonitor;
export const MonitorSmartphone: AppIcon = LuMonitorSmartphone;
export const Moon: AppIcon = LuMoon;
export const MoreHorizontal: AppIcon = LuMoreHorizontal;
/** Lucide `package`: clinic stock, packages and purchases. */
export const Package: AppIcon = LuPackage;
export const Palette: AppIcon = LuPalette;
/** Lucide `panel-right-close`: close a side panel (mirror it under RTL). */
export const PanelRightClose: AppIcon = LuPanelRightClose;
/** Lucide `panel-right-open`: open a side panel (mirror it under RTL). */
export const PanelRightOpen: AppIcon = LuPanelRightOpen;
/** Lucide `pause`: pause something running. */
export const Pause: AppIcon = LuPause;
/** Lucide `pen-line`: edit. */
export const PenLine: AppIcon = LuPenLine;
/** Lucide `phone`: calls. */
export const Phone: AppIcon = LuPhone;
/** Lucide `pill`: medicines and prescriptions. */
export const Pill: AppIcon = LuPill;
/** Lucide `play`: start or resume. */
export const Play: AppIcon = LuPlay;
export const Plus: AppIcon = LuPlus;
export const Plug: AppIcon = LuPlug;
/** Lucide `printer`: print. */
export const Printer: AppIcon = LuPrinter;
/**
 * Lucide `receipt-text`: invoices and sales — the design's `receipt` draws text
 * lines on the slip (H:3012), where Lucide `receipt` draws a `$`.
 */
export const Receipt: AppIcon = LuReceiptText;
/** Lucide `refresh-cw`: redo or change (`RotateCw` is another glyph). */
export const RefreshCw: AppIcon = LuRefreshCw;
export const Rocket: AppIcon = LuRocket;
export const RotateCw: AppIcon = LuRotateCw;
export const Search: AppIcon = LuSearch;
/** Lucide `send`: send a message. */
export const Send: AppIcon = LuSend;
export const Settings: AppIcon = LuSettings;
export const ShieldAlert: AppIcon = LuShieldAlert;
export const Shield: AppIcon = LuShield;
export const ShieldCheck: AppIcon = LuShieldCheck;
/** Lucide `shopping-cart`: purchases and purchase orders. */
export const ShoppingCart: AppIcon = LuShoppingCart;
export const SlidersHorizontal: AppIcon = LuSlidersHorizontal;
export const Sparkles: AppIcon = LuSparkles;
/** Lucide `square-check`: tasks and checked items. */
export const SquareCheck: AppIcon = LuSquareCheck;
/** Lucide `star`: reviews. */
export const Star: AppIcon = LuStar;
/** Lucide `stethoscope`: clinical notes. */
export const Stethoscope: AppIcon = LuStethoscope;
export const Sun: AppIcon = LuSun;
/** Lucide `tag`: offerings and discounts. */
export const Tag: AppIcon = LuTag;
export const Trash: AppIcon = LuTrash;
export const TriangleAlert: AppIcon = LuTriangleAlert;
/** Lucide `truck`: suppliers and vendors. */
export const Truck: AppIcon = LuTruck;
export const User: AppIcon = LuUser;
export const UserCog: AppIcon = LuUserCog;
export const UserPlus: AppIcon = LuUserPlus;
export const Users: AppIcon = LuUsers;
/** Lucide `wallet`: payments and collections. */
export const Wallet: AppIcon = LuWallet;
/** WhatsApp brand mark, drawn locally (lucide-react ships no brand icons). */
export const WhatsAppMark: AppIcon = LuWhatsAppMark;
export const X: AppIcon = LuX;
export const XCircle: AppIcon = LuXCircle;
export const Zap: AppIcon = LuZap;
