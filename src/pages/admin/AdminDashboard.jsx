import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import StatsCard from '../../components/admin/StatsCard';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const db = window.firebaseDb;
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersThisWeek: 0,
    activeUsers: 0,
    totalRuns: 0,
    totalCrews: 0,
    totalComments: 0,
    pendingReports: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // 전체 사용자
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;

      // 이번 주 신규 사용자
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const newUsersQuery = query(
        collection(db, 'users'),
        where('createdAt', '>=', Timestamp.fromDate(weekAgo))
      );
      const newUsersSnapshot = await getDocs(newUsersQuery);
      const newUsersThisWeek = newUsersSnapshot.size;

      // 활성 사용자 (30일 내 기록 추가)
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const activeRunsQuery = query(
        collection(db, 'runs'),
        where('createdAt', '>=', Timestamp.fromDate(monthAgo))
      );
      const activeRunsSnapshot = await getDocs(activeRunsQuery);
      const activeUserIds = new Set(activeRunsSnapshot.docs.map(doc => doc.data().userId));
      const activeUsers = activeUserIds.size;

      // 총 기록
      const runsSnapshot = await getDocs(collection(db, 'runs'));
      const totalRuns = runsSnapshot.size;

      // 총 크루 (있으면)
      let totalCrews = 0;
      try {
        const crewsSnapshot = await getDocs(collection(db, 'crews'));
        totalCrews = crewsSnapshot.size;
      } catch (e) {
        console.log('크루 컬렉션 없음');
      }

      // 총 댓글 (있으면)
      let totalComments = 0;
      try {
        const commentsSnapshot = await getDocs(collection(db, 'comments'));
        totalComments = commentsSnapshot.size;
      } catch (e) {
        console.log('댓글 컬렉션 없음');
      }

      // 대기 중인 신고 (있으면)
      let pendingReports = 0;
      try {
        const reportsQuery = query(
          collection(db, 'reports'),
          where('status', '==', 'pending')
        );
        const reportsSnapshot = await getDocs(reportsQuery);
        pendingReports = reportsSnapshot.size;
      } catch (e) {
        console.log('신고 컬렉션 없음');
      }

      setStats({
        totalUsers,
        newUsersThisWeek,
        activeUsers,
        totalRuns,
        totalCrews,
        totalComments,
        pendingReports,
      });

      // 최근 활동 (최근 10개 기록)
      const recentRunsQuery = query(
        collection(db, 'runs'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
      const recentRunsSnapshot = await getDocs(recentRunsQuery);
      const activities = [];

      for (const runDoc of recentRunsSnapshot.docs) {
        const runData = runDoc.data();
        try {
          const userDoc = await getDocs(
            query(collection(db, 'users'), where('__name__', '==', runData.userId))
          );
          const userData = userDoc.docs[0]?.data();

          activities.push({
            id: runDoc.id,
            type: 'run',
            userName: userData?.nickname || '알 수 없음',
            userId: runData.userId,
            content: runData.raceName || runData.location || '기록',
            time: runData.createdAt?.toDate(),
          });
        } catch (e) {
          console.error('활동 로드 실패:', e);
        }
      }

      setRecentActivity(activities);
    } catch (error) {
      console.error('대시보드 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">대시보드</h2>
        <p className="text-navy-600 mt-1">RunLog 전체 현황을 확인하세요</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="전체 사용자"
          value={stats.totalUsers.toLocaleString()}
          icon="👥"
          onClick={() => navigate('/admin/users')}
        />
        <StatsCard
          title="신규 사용자"
          value={stats.newUsersThisWeek.toLocaleString()}
          subtitle="이번 주"
          icon="✨"
        />
        <StatsCard
          title="활성 사용자"
          value={stats.activeUsers.toLocaleString()}
          subtitle="최근 30일"
          icon="🔥"
        />
        <StatsCard
          title="총 기록"
          value={stats.totalRuns.toLocaleString()}
          icon="🏃"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="총 크루"
          value={stats.totalCrews.toLocaleString()}
          icon="👥"
          onClick={() => navigate('/admin/crews')}
        />
        <StatsCard
          title="총 댓글"
          value={stats.totalComments.toLocaleString()}
          icon="💬"
        />
        <StatsCard
          title="대기 중인 신고"
          value={stats.pendingReports.toLocaleString()}
          icon="⚠️"
          onClick={() => navigate('/admin/reports')}
        />
      </div>

      {/* 최근 활동 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-navy-900">최근 활동</h3>
          <button
            onClick={() => navigate('/admin/content')}
            className="text-sm text-navy-600 hover:text-navy-900"
          >
            전체 보기 →
          </button>
        </div>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-navy-500 text-center py-8">활동이 없습니다</p>
          ) : (
            recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between py-3 border-b border-navy-100 last:border-0 hover:bg-navy-50 px-2 rounded transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm text-navy-900">
                    <span className="font-semibold">{activity.userName}</span>
                    <span className="text-navy-600"> 님이 </span>
                    <span className="font-medium">{activity.content}</span>
                    <span className="text-navy-600"> 기록을 추가했습니다</span>
                  </p>
                </div>
                <span className="text-xs text-navy-400 ml-4">
                  {formatTime(activity.time)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
