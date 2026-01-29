import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Package,
  Settings,
  BarChart3,
  Calendar,
  Menu,
  X,
  LogOut,
  Users,
  LayoutDashboard,
  Shield,
  FileText,
  ChevronDown,
  Bot,
  Activity,
  Check,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { ShoppingBag } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { EmailVerificationBanner } from "../EmailVerificationBanner";
import { KellyProactive } from "../KellyProactive";
import "../../styles/navigation.css";

interface AppLayoutProps {
  children: React.ReactNode;
}

interface FamilyMember {
  id: string;
  name: string;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [defaultSeller, setDefaultSeller] = useState<FamilyMember | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showSellerMenu, setShowSellerMenu] = useState(false);

  const [showKellyPanel, setShowKellyPanel] = useState(false);
  const [kellyInsightsCount, setKellyInsightsCount] = useState(0);

  const [headerScrolled, setHeaderScrolled] = useState(false);

  const [closingUserMenu, setClosingUserMenu] = useState(false);
  const [closingAdminMenu, setClosingAdminMenu] = useState(false);
  const [closingSellerMenu, setClosingSellerMenu] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const adminMenuRef = useRef<HTMLDivElement>(null);
  const sellerMenuRef = useRef<HTMLDivElement>(null);

  const MENU_CLOSE_MS = 520;

  useEffect(() => {
    if (user) {
      loadDefaultSeller();
      loadFamilyMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const handleScroll = () => {
      setHeaderScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMenuWithAnimation = (menuType: "user" | "admin" | "seller") => {
    if (menuType === "user") {
      setClosingUserMenu(true);
      window.setTimeout(() => {
        setShowUserMenu(false);
        setClosingUserMenu(false);
      }, MENU_CLOSE_MS);
    } else if (menuType === "admin") {
      setClosingAdminMenu(true);
      window.setTimeout(() => {
        setShowAdminMenu(false);
        setClosingAdminMenu(false);
      }, MENU_CLOSE_MS);
    } else if (menuType === "seller") {
      setClosingSellerMenu(true);
      window.setTimeout(() => {
        setShowSellerMenu(false);
        setClosingSellerMenu(false);
      }, MENU_CLOSE_MS);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        if (showUserMenu && !closingUserMenu) closeMenuWithAnimation("user");
      }
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target as Node)) {
        if (showAdminMenu && !closingAdminMenu) closeMenuWithAnimation("admin");
      }
      if (sellerMenuRef.current && !sellerMenuRef.current.contains(event.target as Node)) {
        if (showSellerMenu && !closingSellerMenu) closeMenuWithAnimation("seller");
      }
    }

    if (showUserMenu || showAdminMenu || showSellerMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUserMenu, showAdminMenu, showSellerMenu, closingUserMenu, closingAdminMenu, closingSellerMenu]);

  async function loadDefaultSeller() {
    if (!user) return;

    try {
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("default_seller_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profileData?.default_seller_id) {
        const { data: sellerData, error: sellerError } = await supabase
          .from("family_members")
          .select("id, name")
          .eq("id", profileData.default_seller_id)
          .maybeSingle();

        if (!sellerError && sellerData) setDefaultSeller(sellerData);
      } else {
        const { data: firstSeller } = await supabase
          .from("family_members")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name")
          .limit(1)
          .maybeSingle();

        if (firstSeller) setDefaultSeller(firstSeller);
      }
    } catch (error) {
      console.error("Error loading default seller:", error);
    }
  }

  async function loadFamilyMembers() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("family_members")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setFamilyMembers(data || []);
    } catch (error) {
      console.error("Error loading family members:", error);
    }
  }

  async function setDefaultSellerHandler(sellerId: string) {
    if (!user) return;

    try {
      await supabase.from("family_members").update({ is_default: false }).eq("user_id", user.id);

      await supabase
        .from("family_members")
        .update({ is_default: true })
        .eq("id", sellerId)
        .eq("user_id", user.id);

      const { error } = await supabase
        .from("user_profiles")
        .update({ default_seller_id: sellerId })
        .eq("id", user.id);

      if (error) throw error;

      const selectedSeller = familyMembers.find((m) => m.id === sellerId);
      if (selectedSeller) setDefaultSeller(selectedSeller);

      closeMenuWithAnimation("seller");
    } catch (error) {
      console.error("Error setting default seller:", error);
    }
  }

  const isActive = (path: string) => location.pathname === path;

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className={`bg-white border-b border-gray-200 sticky top-0 z-50 transition-all duration-300 ${
          headerScrolled ? "shadow-lg shadow-gray-200/50 backdrop-blur-xl bg-white/95" : ""
        }`}
      >
        <EmailVerificationBanner />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              {/* Logo = retour au dashboard */}
              <Link to="/mon_dressing" className="flex items-center gap-2 logo-animation ripple-effect">
                <ShoppingBag className="w-6 h-6 text-emerald-600 transition-transform" />
                <span className="text-xl font-bold text-gray-900">
                  <span className="text-emerald-600">Easy</span>Vinted
                </span>
              </Link>

              {/* Vendeur par défaut - cliquable si plusieurs vendeurs */}
              {familyMembers.length > 0 && (
                <div className="hidden sm:block relative" ref={sellerMenuRef}>
                  {familyMembers.length === 1 ? (
                    <div className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                      <Users className="w-3 h-3 inline mr-1" />
                      {defaultSeller?.name || familyMembers[0].name}
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          if (showSellerMenu) {
                            if (!closingSellerMenu) closeMenuWithAnimation("seller");
                          } else {
                            setShowSellerMenu(true);
                          }
                        }}
                        className="ripple-effect flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200 hover:bg-blue-100 transition-all duration-200 hover:scale-105 hover:shadow-md"
                        title="Changer le vendeur par défaut"
                      >
                        <Users className="w-3 h-3 transition-transform" />
                        {defaultSeller?.name || "Sélectionner un vendeur"}
                        <ChevronDown className={`w-3 h-3 chevron-rotate ${showSellerMenu ? "rotate-180" : ""}`} />
                      </button>

                      {showSellerMenu && (
                        <div className={`dropdown-menu ${closingSellerMenu ? "closing" : ""}`}>
                          <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Vendeur par défaut</p>
                          </div>
                          {familyMembers.map((member, index) => (
                            <button
                              key={member.id}
                              onClick={() => setDefaultSellerHandler(member.id)}
                              className={`menu-item flex items-center justify-between w-full px-4 py-2.5 text-sm transition-all duration-200 hover:bg-blue-50 hover:scale-[1.02] ${
                                defaultSeller?.id === member.id ? "text-blue-700 font-medium bg-blue-50/50" : "text-gray-700"
                              }`}
                              style={{ animationDelay: `${index * 40}ms` }}
                            >
                              <span className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                {member.name}
                              </span>
                              {defaultSeller?.id === member.id && (
                                <Check className="w-4 h-4 text-blue-700 animate-in fade-in zoom-in duration-200" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Menu desktop */}
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  to="/mon_dressing"
                  className={`nav-button flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive("/mon_dressing") ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 transition-transform group-hover:scale-110" />
                  Mon dressing
                </Link>
                
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Bouton Kelly Conseils */}
              <button
                onClick={() => setShowKellyPanel(!showKellyPanel)}
                className="kelly-button hidden md:flex items-center gap-1.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-300 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 relative ripple-effect"
                title="Kelly Conseils"
                style={{ overflow: "visible" }}
              >
                <img
                  src="/kelly-avatar.png"
                  alt="Kelly"
                  className="w-7 h-7 rounded-md object-cover transition-transform hover:scale-110"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                  }}
                />
                <span className="hidden lg:inline pr-1">Kelly</span>
                {kellyInsightsCount > 0 && (
                  <span className="notification-badge absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10">
                    {kellyInsightsCount}
                  </span>
                )}
              </button>

              {/* Menu Gestion */}
              <div className="hidden md:block relative" ref={adminMenuRef}>
                <button
                  onClick={() => {
                    if (showAdminMenu) {
                      if (!closingAdminMenu) closeMenuWithAnimation("admin");
                    } else {
                      setShowAdminMenu(true);
                    }
                  }}
                  className={`nav-button flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ripple-effect ${
                    location.pathname.startsWith("/admin") ||
                    location.pathname === "/settings" ||
                    location.pathname === "/profile" ||
                    location.pathname === "/family" ||
                    location.pathname === "/analytics" ||
                    location.pathname === "/planner"
                      ? "bg-slate-50 text-slate-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                  title="Gestion et paramètres"
                >
                  <Shield className="w-4 h-4 transition-transform" />
                  Gestion
                  <ChevronDown className={`w-3 h-3 chevron-rotate ${showAdminMenu ? "rotate-180" : ""}`} />
                </button>

                {showAdminMenu && (
                  <div className={`dropdown-menu dropdown-menu-large ${closingAdminMenu ? "closing" : ""}`}>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Actions</p>
                    </div>

                    <Link
                      to="/admin/unified"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-all duration-200 border-b border-gray-100 group hover:scale-[1.02]"
                      style={{ animationDelay: "0ms" }}
                    >
                      <Package className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Admin Catalogue
                    </Link>

                    <Link
                      to="/planner"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "40ms" }}
                    >
                      <Calendar className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Planificateur
                    </Link>

                    <Link
                      to="/admin/publisher"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "80ms" }}
                    >
                      <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Publier manuellement
                    </Link>

                    <Link
                      to="/admin/agent-publisher-ia"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "120ms" }}
                    >
                      <Bot className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Agent Publisher IA
                    </Link>

                    <Link
                      to="/admin/publication-monitor"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "160ms" }}
                    >
                      <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Monitoring publications
                    </Link>

                    <Link
                      to="/analytics"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "200ms" }}
                    >
                      <BarChart3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Statistiques
                    </Link>

                    <div className="border-t border-gray-100 my-1"></div>

                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Configuration</p>
                    </div>

                    <Link
                      to="/profile"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "240ms" }}
                    >
                      <div className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-[10px] font-semibold text-white">{user?.email ? getInitials(user.email) : "U"}</span>
                      </div>
                      Mon profil
                    </Link>

                    <Link
                      to="/family"
                      onClick={() => closeMenuWithAnimation("admin")}
                      className="menu-item flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "280ms" }}
                    >
                      <Users className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Vendeurs
                    </Link>
                  </div>
                )}
              </div>

              {/* Menu utilisateur */}
              <div className="hidden sm:block relative" ref={userMenuRef}>
                <button
                  onClick={() => {
                    if (showUserMenu) {
                      if (!closingUserMenu) closeMenuWithAnimation("user");
                    } else {
                      setShowUserMenu(true);
                    }
                  }}
                  className="flex w-10 h-10 rounded-full bg-emerald-600 items-center justify-center hover:bg-emerald-700 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-emerald-500/30 ripple-effect"
                  title="Mon profil"
                >
                  <span className="text-sm font-semibold text-white">{user?.email ? getInitials(user.email) : "U"}</span>
                </button>

                {showUserMenu && (
                  <div className={`dropdown-menu ${closingUserMenu ? "closing" : ""}`}>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900 truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="menu-item flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all duration-200 group hover:scale-[1.02]"
                      style={{ animationDelay: "0ms" }}
                    >
                      <LogOut className="w-4 h-4 group-hover:translate-x-[-2px] transition-transform" />
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>

              {/* Burger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all duration-300 hover:scale-110 ripple-effect"
                aria-label="Menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6 animate-in spin-in-90 duration-300" /> : <Menu className="w-6 h-6 animate-in fade-in duration-300" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu mobile */}
        <div
          className={`md:hidden border-t border-gray-200 mobile-menu-backdrop overflow-y-auto
transition-all duration-700 ease-[cubic-bezier(.16,1,.3,1)] transform-gpu will-change-[opacity,transform,max-height]
${mobileMenuOpen ? "max-h-[80vh] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-2"}
          `}
        >
          <nav className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            <Link
              to="/mon_dressing"
              onClick={() => setMobileMenuOpen(false)}
              className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                isActive("/mon_dressing") ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
              }`}
              style={{ animationDelay: mobileMenuOpen ? "50ms" : "0ms" }}
            >
              <LayoutDashboard className="w-5 h-5 group-hover:scale-110 transition-transform" />
              Mon dressing
            </Link>

            <div className="border-t border-gray-200 my-2 pt-2">
              <div className="px-4 py-2">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Actions
                </p>
              </div>

              <Link
                to="/admin/unified"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/admin/unified") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "130ms" : "0ms" }}
              >
                <Package className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Admin Catalogue
              </Link>

              <Link
                to="/planner"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/planner") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "170ms" : "0ms" }}
              >
                <Calendar className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Planificateur
              </Link>

              <Link
                to="/admin/publisher"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/admin/publisher") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "210ms" : "0ms" }}
              >
                <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Publier manuellement
              </Link>

              <Link
                to="/admin/agent-publisher-ia"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/admin/agent-publisher-ia") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "250ms" : "0ms" }}
              >
                <Bot className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Agent Publisher IA
              </Link>

              <Link
                to="/admin/publication-monitor"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/admin/publication-monitor") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "290ms" : "0ms" }}
              >
                <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Monitoring publications
              </Link>

              <Link
                to="/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/analytics") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "330ms" : "0ms" }}
              >
                <BarChart3 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Statistiques
              </Link>
            </div>

            <div className="border-t border-gray-200 my-2 pt-2">
              <div className="px-4 py-2">
                <p className="text-xs font-bold text-gray-900 uppercase tracking-wider">Configuration</p>
              </div>

              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/profile") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "370ms" : "0ms" }}
              >
                <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-xs font-semibold text-white">{user?.email ? getInitials(user.email) : "U"}</span>
                </div>
                Mon Profil
              </Link>

              <Link
                to="/family"
                onClick={() => setMobileMenuOpen(false)}
                className={`mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group ${
                  isActive("/family") ? "bg-slate-50 text-slate-900 shadow-sm" : "text-gray-700 hover:bg-gray-50 hover:scale-[1.02]"
                }`}
                style={{ animationDelay: mobileMenuOpen ? "410ms" : "0ms" }}
              >
                <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Vendeurs
              </Link>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleSignOut();
                }}
                className="mobile-menu-item flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all duration-300 group text-red-600 hover:bg-red-50 hover:scale-[1.02]"
                style={{ animationDelay: mobileMenuOpen ? "450ms" : "0ms" }}
              >
                <LogOut className="w-5 h-5 group-hover:translate-x-[-2px] transition-transform" />
                Se déconnecter
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>

      <KellyProactive
        onNavigateToArticle={(articleId) => navigate(`/articles/${articleId}/preview`)}
        onCreateBundle={(articleIds) => navigate("/lots/new", { state: { preselectedArticles: articleIds } })}
        isOpenFromHeader={showKellyPanel}
        onToggleFromHeader={() => setShowKellyPanel(!showKellyPanel)}
        onInsightsCountChange={setKellyInsightsCount}
      />
    </div>
  );
}
