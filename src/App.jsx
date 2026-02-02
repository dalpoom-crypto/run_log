import { useState, useEffect } from 'react';
import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from './config/firebase';
import AuthForm from './components/AuthForm';
import Feed from './components/Feed';
import RecordsManagement from './components/RecordsManagement';
import AddRunForm from './components/AddRunForm';
import SettingsModal from './components/SettingsModal';
import SearchTab from './components/SearchTab';

function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('home'); // home, search, add, stats, profile
  const [showSettings, setShowSettings] = useState(false);
  const [editingRun, setEditingRun] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setShowSettings(false); // 로그인 시 설정 창이 자동으로 열리지 않도록
      
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data());
          }
        } catch (error) {
          console.error('사용자 데이터 로드 실패:', error);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-800 via-navy-700 to-navy-600">
        <div className="text-white text-xl font-semibold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-navy-900">RunLog</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => document.getElementById('settings-trigger').click()}
              className="text-navy-700 hover:text-navy-900 transition-colors p-1"
            >
              <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-6 pb-20 sm:pb-24">
        {currentTab === 'home' && (
          <Feed 
            user={user} 
            userData={userData}
            showOwnOnly={false}
            onShowSettings={() => setShowSettings(true)}
            onEditRun={setEditingRun}
          />
        )}
        {currentTab === 'search' && <SearchTab user={user} />}
        {currentTab === 'add' && (
          <div className="text-center py-12">
            <p className="text-navy-600 mb-4">기록 추가 폼이 열립니다...</p>
          </div>
        )}
        {currentTab === 'stats' && <RecordsManagement user={user} />}
        {currentTab === 'profile' && (
          <Feed 
            user={user} 
            userData={userData}
            showOwnOnly={true}
            onShowSettings={() => setShowSettings(true)}
            onEditRun={setEditingRun}
          />
        )}
      </main>

      {/* 공통 컴포넌트 */}
      <AddRunForm 
        user={user} 
        onRunAdded={() => window.location.reload()} 
        editingRun={editingRun} 
        onEditComplete={() => {
          setEditingRun(null);
          window.location.reload();
        }} 
      />

      {showSettings && (
        <SettingsModal
          user={user}
          userData={userData}
          onClose={() => setShowSettings(false)}
          onSignOut={handleSignOut}
        />
      )}

      {/* 트리거 버튼 */}
      <button
        id="settings-trigger"
        onClick={() => setShowSettings(true)}
        className="hidden"
      />

      {/* 트리거 버튼 */}
      <button
        id="add-run-trigger"
        onClick={() => {
          setCurrentTab('add');
          window.dispatchEvent(new CustomEvent('openAddRunForm'));
        }}
        className="hidden"
      />

      {/* 하단 탭 네비게이션 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-navy-200 z-50 safe-area-inset-bottom">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex justify-around items-center">
          {/* 홈 (피드) */}
          <button
            onClick={() => setCurrentTab('home')}
            className={`flex items-center justify-center transition-colors ${
              currentTab === 'home' ? 'text-navy-900' : 'text-navy-400'
            }`}
          >
            <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth={currentTab === 'home' ? '2.5' : '1.5'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>

          {/* 검색 */}
          <button
            onClick={() => setCurrentTab('search')}
            className={`flex items-center justify-center transition-colors ${
              currentTab === 'search' ? 'text-navy-900' : 'text-navy-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={currentTab === 'search' ? '2.5' : '1.5'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* 추가 */}
          <button
            onClick={() => {
              setCurrentTab('add');
              document.getElementById('add-run-trigger').click();
            }}
            className={`flex items-center justify-center transition-colors ${
              currentTab === 'add' ? 'text-navy-900' : 'text-navy-400'
            }`}
          >
            <div className="w-12 h-12 sm:w-10 sm:h-10 bg-navy-700 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-navy-800 active:bg-navy-900 transition-colors touch-manipulation">
              <svg className="w-6 h-6 sm:w-6 sm:h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
          </button>

          {/* 기록관리 */}
          <button
            onClick={() => setCurrentTab('stats')}
            className={`flex items-center justify-center transition-colors ${
              currentTab === 'stats' ? 'text-navy-900' : 'text-navy-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={currentTab === 'stats' ? '2.5' : '1.5'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>

          {/* 프로필 */}
          <button
            onClick={() => setCurrentTab('profile')}
            className={`flex items-center justify-center transition-colors ${
              currentTab === 'profile' ? 'text-navy-900' : 'text-navy-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={currentTab === 'profile' ? '2.5' : '1.5'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
