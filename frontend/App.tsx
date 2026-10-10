import React, { Suspense } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { LanguageProvider } from './i18n/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Role } from './types';
import Layout from './components/Layout';
import RoleRoute from './components/RoleRoute';
import { PageSkeleton } from './components/ui/Skeleton';
import { showPaymentTestTools } from './config/env';
import { lazyPage } from './utils/lazyPage';
import { homePathFor } from './utils/authorUi';
// Bosh sahifa va kirish — darhol (birinchi ekran); qolgan sahifalar alohida chunk bo'lib kerak bo'lganda yuklanadi.
import Landing from './pages/Landing';
import Login from './pages/LoginSimple';
const Dashboard = lazyPage(() => import('./pages/Dashboard'));
const Articles = lazyPage(() => import('./pages/Articles'));
const SubmitArticle = lazyPage(() => import('./pages/SubmitArticle'));
const UserManagement = lazyPage(() => import('./pages/UserManagement'));
const UdkRequests = lazyPage(() => import('./pages/UdkRequests'));
const PriceManagement = lazyPage(() => import('./pages/PriceManagement'));
const UdkOlish = lazyPage(() => import('./pages/UdkOlish'));
const PlagiarismCheck = lazyPage(() => import('./pages/PlagiarismCheck'));
const AntiplagiatResultPage = lazyPage(() => import('./pages/AntiplagiatResultPage'));
const Services = lazyPage(() => import('./pages/Services'));
const Profile = lazyPage(() => import('./pages/Profile'));
const ArticleDetail = lazyPage(() => import('./pages/ArticleDetail'));
const Register = lazyPage(() => import('./pages/RegisterSimple'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const ClickPayment = lazyPage(() => import('./pages/ClickPayment'));
const JournalManagement = lazyPage(() => import('./pages/JournalManagement'));
const PublishedArticles = lazyPage(() => import('./pages/PublishedArticles'));
const Financials = lazyPage(() => import('./pages/Financials'));
const SubmitBook = lazyPage(() => import('./pages/SubmitBook'));
const MyCollections = lazyPage(() => import('./pages/MyCollections'));
const TranslationService = lazyPage(() => import('./pages/TranslationService'));
const MyTranslations = lazyPage(() => import('./pages/MyTranslations'));
const TranslationDetail = lazyPage(() => import('./pages/TranslationDetail'));
const PaymentTest = lazyPage(() => import('./pages/PaymentTest'));
const JournalAdminPanel = lazyPage(() => import('./pages/JournalAdminPanel'));
const JournalPrices = lazyPage(() => import('./pages/JournalPrices'));
const Prices = lazyPage(() => import('./pages/Prices'));
const PublicArticleShare = lazyPage(() => import('./pages/PublicArticleShare'));
const PublicCollectionShare = lazyPage(() => import('./pages/PublicCollectionShare'));
const UdkVerify = lazyPage(() => import('./pages/UdkVerify'));
const VerifyDocument = lazyPage(() => import('./pages/VerifyDocument'));
const AuthorPublications = lazyPage(() => import('./pages/AuthorPublicationsNew'));
const AuthorPublicationDetail = lazyPage(() => import('./pages/AuthorPublicationDetail'));
const MaqolaNamunaOlish = lazyPage(() => import('./pages/MaqolaNamunaOlish'));
const DoiOlish = lazyPage(() => import('./pages/DoiOlish'));
const DoiRequests = lazyPage(() => import('./pages/DoiRequests'));
const ArticleSampleRequests = lazyPage(() => import('./pages/ArticleSampleRequests'));
const BrowseByCategory = lazyPage(() => import('./pages/BrowseByCategory'));
const ArxivHujjatlar = lazyPage(() => import('./pages/ArxivHujjatlar'));
const AllRequests = lazyPage(() => import('./pages/AllRequests'));
const OperatorDashboard = lazyPage(() => import('./pages/OperatorDashboard'));
const NotFound = lazyPage(() => import('./pages/NotFound'));
const Payments = lazyPage(() => import('./pages/Payments'));
const Analytics = lazyPage(() => import('./pages/Analytics'));
const AiWorkspace = lazyPage(() => import('./pages/AiWorkspace'));
const Oferta = lazyPage(() => import('./pages/Oferta'));
const Privacy = lazyPage(() => import('./pages/Privacy'));

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--editorial-bg)] px-4 py-10">
                <div className="max-w-[1264px] mx-auto">
                    <PageSkeleton />
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

/** "/" — kirgan foydalanuvchi o'z paneliga, mehmon esa ochiq bosh sahifaga (jurnallar, narxlar). */
const HomeRoute: React.FC = () => {
    const { user, loading } = useAuth();
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--editorial-bg)] px-4 py-10">
                <div className="max-w-[1264px] mx-auto">
                    <PageSkeleton />
                </div>
            </div>
        );
    }
    if (user) {
        return <Navigate to={homePathFor(String(user.role))} replace />;
    }
    return <Landing />;
};

const AppContent: React.FC = () => {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[var(--editorial-bg)] px-4 py-10">
                    <div className="max-w-[1264px] mx-auto">
                        <PageSkeleton />
                    </div>
                </div>
            }
        >
            <Routes>
                <Route index element={<HomeRoute />} />
                <Route path="/katalog" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
                <Route path="/oferta" element={<Oferta />} />
                <Route path="/maxfiylik" element={<Privacy />} />
                {/* Muallif AI ish maydoni — o'z sarlavhasi va suhbatlar paneli bilan (Layout'siz) */}
                <Route path="/ai" element={<ProtectedRoute><RoleRoute allowedRoles={[Role.Author]}><AiWorkspace /></RoleRoute></ProtectedRoute>} />
                <Route path="/ai/:conversationId" element={<ProtectedRoute><RoleRoute allowedRoles={[Role.Author]}><AiWorkspace /></RoleRoute></ProtectedRoute>} />
                <Route path="/payment/click" element={<ClickPayment />} />
                <Route path="/udk-verify" element={<UdkVerify />} />
                <Route path="/verify/:code" element={<VerifyDocument />} />
                <Route path="/public/article/:id" element={<PublicArticleShare />} />
                <Route path="/public/collection/:id" element={<PublicCollectionShare />} />
            
                <Route element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }>
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="payments" element={<Payments />} />
                    <Route path="analytics" element={<RoleRoute allowedRoles={[Role.SuperAdmin, Role.Accountant, Role.JournalAdmin]}><Analytics /></RoleRoute>} />
                    <Route path="operator-dashboard" element={<RoleRoute allowedRoles={[Role.Operator]}><OperatorDashboard /></RoleRoute>} />
                    <Route path="articles" element={<Articles />} />
                    <Route path="articles/:id" element={<ArticleDetail />} />
                    <Route path="translations/:id" element={<TranslationDetail />} />
                    <Route path="published-articles" element={<RoleRoute allowedRoles={[Role.JournalAdmin, Role.SuperAdmin]}><PublishedArticles /></RoleRoute>} />
                    <Route path="my-collections" element={<MyCollections />} />
                    <Route path="my-translations" element={<MyTranslations />} />
                    <Route path="submit" element={<SubmitArticle />} />
                    <Route path="submit-book" element={<SubmitBook />} />
                    <Route path="users" element={<RoleRoute allowedRoles={[Role.SuperAdmin]}><UserManagement /></RoleRoute>} />
                    <Route path="journal-management" element={<RoleRoute allowedRoles={[Role.SuperAdmin]}><JournalManagement /></RoleRoute>} />
                    <Route path="journal-admin-panel" element={<RoleRoute allowedRoles={[Role.JournalAdmin]}><JournalAdminPanel /></RoleRoute>} />
                    <Route path="journal-prices" element={<RoleRoute allowedRoles={[Role.SuperAdmin]}><JournalPrices /></RoleRoute>} />
                    <Route path="prices" element={<RoleRoute allowedRoles={[Role.SuperAdmin]}><Prices /></RoleRoute>} />
                    <Route path="price-management" element={<RoleRoute allowedRoles={[Role.SuperAdmin]}><PriceManagement /></RoleRoute>} />
                    <Route path="udk-requests" element={<RoleRoute allowedRoles={[Role.SuperAdmin, Role.Reviewer]}><UdkRequests /></RoleRoute>} />
                    <Route path="udk-olish" element={<UdkOlish />} />
                    <Route path="services" element={<Services />} />
                    <Route path="browse" element={<BrowseByCategory />} />
                    <Route path="maqola-namuna-olish" element={<MaqolaNamunaOlish />} />
                    <Route path="doi-olish" element={<DoiOlish />} />
                    <Route path="doi-requests" element={<DoiRequests />} />
                    <Route path="article-sample-requests" element={<ArticleSampleRequests />} />
                    <Route path="translation-service" element={<TranslationService />} />
                    <Route path="plagiarism-check" element={<PlagiarismCheck />} />
                    <Route path="plagiarism-check/result/:articleId" element={<AntiplagiatResultPage />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="arxiv" element={<ArxivHujjatlar />} />
                    <Route path="financials" element={<RoleRoute allowedRoles={[Role.SuperAdmin, Role.Accountant]}><Financials /></RoleRoute>} />
                    <Route path="all-requests" element={<RoleRoute allowedRoles={[Role.Operator]}><AllRequests /></RoleRoute>} />
                    {showPaymentTestTools && (
                      <Route path="payment-test" element={<RoleRoute allowedRoles={[Role.SuperAdmin]}><PaymentTest /></RoleRoute>} />
                    )}
                    <Route path="author-publications" element={<AuthorPublications />} />
                    <Route path="author-publications/:id" element={<AuthorPublicationDetail />} />
                </Route>

                <Route path="*" element={<NotFound />} />
            </Routes>
        </Suspense>
    );
};

const ThemedToasts: React.FC = () => {
    const { theme } = useTheme();
    return (
        <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme={theme === 'dark' ? 'dark' : 'light'}
        />
    );
};

const App: React.FC = () => {
    return (
        <HashRouter>
            <ErrorBoundary>
            <ThemeProvider>
            <LanguageProvider>
            <AuthProvider>
                <AppContent />
                <ThemedToasts />
            </AuthProvider>
            </LanguageProvider>
            </ThemeProvider>
            </ErrorBoundary>
        </HashRouter>
    );
};

export default App;