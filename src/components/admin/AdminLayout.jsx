import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

const AdminLayout = () => {
  const navigate = useNavigate();
  const auth = window.firebaseAuth;
  const { signOut } = window.firebaseModules;

  const handleSignOut = async () => {
    if (!window.confirm('로그아웃하시겠습니까?')) {
      return;
    }
    
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  return (
    <div className="min-h-screen bg-navy-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">
              🏃 RunLog Admin
            </h1>
            <p className="text-sm text-navy-600 mt-1">관리자 대시보드</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-navy-700 hover:bg-navy-100 rounded-lg transition-colors"
            >
              메인으로
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 사이드바 */}
        <AdminSidebar />

        {/* 메인 콘텐츠 */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
