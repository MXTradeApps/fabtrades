import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import TradeHistory from './pages/TradeHistory.jsx';
import BinderCollection from './pages/BinderCollection.jsx';
import SharedBinder from './pages/SharedBinder.jsx';
import SetList from './pages/SetList.jsx';
import SetDetail from './pages/SetDetail.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsOfUse from './pages/TermsOfUse.jsx';
import Support from './pages/Support.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { EntitlementProvider } from './contexts/EntitlementContext.jsx';
import { CardDetailProvider } from './contexts/CardDetailContext.jsx';
import { CardDetailHost } from './components/cardDetail/CardDetailModal.jsx';

function App() {
    return (
        <AuthProvider>
            {/* Inside AuthProvider: the entitlement is keyed by the signed-in user. */}
            <EntitlementProvider>
                <Router>
                    <CardDetailProvider>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/history" element={<TradeHistory />} />
                            <Route path="/binder" element={<BinderCollection isWanted={false} />} />
                            <Route path="/wants" element={<BinderCollection isWanted={true} />} />
                            <Route path="/b/:token" element={<SharedBinder />} />
                            <Route path="/sets" element={<SetList />} />
                            <Route path="/sets/:groupId" element={<SetDetail />} />
                            <Route path="/privacy" element={<PrivacyPolicy />} />
                            <Route path="/terms" element={<TermsOfUse />} />
                            <Route path="/support" element={<Support />} />
                        </Routes>
                        <CardDetailHost />
                    </CardDetailProvider>
                </Router>
            </EntitlementProvider>
        </AuthProvider>
    );
}

export default App;