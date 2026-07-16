import React from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50/90 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-slate-500">Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

const AppContent: React.FC = () => {
    const { user } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/payment/click" element={<ClickPayment />} />
            <Route path="/udk-verify" element={<UdkVerify />} />
            <Route path="/public/article/:id" element={<PublicArticleShare />} />
            <Route path="/public/collection/:id" element={<PublicCollectionShare />} />
            
            <Route path="/" element={
                <ProtectedRoute>
                    <Layout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
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
                <Route path="profile" element={<Profile />} />
                <Route path="arxiv" element={<ArxivHujjatlar />} />
                <Route path="financials" element={<RoleRoute allowedRoles={[Role.SuperAdmin, Role.Accountant]}><Financials /></RoleRoute>} />
                <Route path="all-requests" element={<RoleRoute allowedRoles={[Role.Operator]}><AllRequests /></RoleRoute>} />
                <Route path="payment-test" element={<PaymentTest />} />
                <Route path="author-publications" element={<AuthorPublications />} />
                <Route path="author-publications/:id" element={<AuthorPublicationDetail />} />
            </Route>

            <Route path="*" element={
                <Navigate to={user ? "/dashboard" : "/login"} replace />
            } />
        </Routes>
    );
};

const App: React.FC = () => {
    return (
        <HashRouter>
            <ErrorBoundary>
            <AuthProvider>
                <AppContent />
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
                    theme="light"
                />
            </AuthProvider>
            </ErrorBoundary>
        </HashRouter>
    );
};

export default App;