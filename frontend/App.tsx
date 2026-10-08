import React from 'react';
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
import Dashboard from './pages/Dashboard';
import Articles from './pages/Articles';
import SubmitArticle from './pages/SubmitArticle';
import UserManagement from './pages/UserManagement';
import UdkRequests from './pages/UdkRequests';
import PriceManagement from './pages/PriceManagement';
import UdkOlish from './pages/UdkOlish';
import PlagiarismCheck from './pages/PlagiarismCheck';
import AntiplagiatResultPage from './pages/AntiplagiatResultPage';
import Services from './pages/Services';
import Profile from './pages/Profile';
import ArticleDetail from './pages/ArticleDetail';
import Login from './pages/LoginSimple';
import Register from './pages/RegisterSimple';
import ForgotPassword from './pages/ForgotPassword';
import ClickPayment from './pages/ClickPayment';
import JournalManagement from './pages/JournalManagement';
import PublishedArticles from './pages/PublishedArticles';
import Financials from './pages/Financials';
import SubmitBook from './pages/SubmitBook';
import MyCollections from './pages/MyCollections';
import TranslationService from './pages/TranslationService';
import MyTranslations from './pages/MyTranslations';
import TranslationDetail from './pages/TranslationDetail';
import PaymentTest from './pages/PaymentTest';
import JournalAdminPanel from './pages/JournalAdminPanel';
import JournalPrices from './pages/JournalPrices';
import Prices from './pages/Prices';
import PublicArticleShare from './pages/PublicArticleShare';
import PublicCollectionShare from './pages/PublicCollectionShare';
import UdkVerify from './pages/UdkVerify';
import VerifyDocument from './pages/VerifyDocument';
import AuthorPublications from './pages/AuthorPublicationsNew';
import AuthorPublicationDetail from './pages/AuthorPublicationDetail';
import MaqolaNamunaOlish from './pages/MaqolaNamunaOlish';
import DoiOlish from './pages/DoiOlish';
import DoiRequests from './pages/DoiRequests';
import ArticleSampleRequests from './pages/ArticleSampleRequests';
import BrowseByCategory from './pages/BrowseByCategory';
import ArxivHujjatlar from './pages/ArxivHujjatlar';
import AllRequests from './pages/AllRequests';
import OperatorDashboard from './pages/OperatorDashboard';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import { PageSkeleton } from './components/ui/Skeleton';
import { showPaymentTestTools } from './config/env';

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
        return <Navigate to={user.role === Role.Operator ? '/operator-dashboard' : '/dashboard'} replace />;
    }
    return <Landing />;
};

const AppContent: React.FC = () => {
    return (
        <Routes>
            <Route index element={<HomeRoute />} />
            <Route path="/katalog" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
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