import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const AdminRoute = ({ children }) => {
  const { isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
