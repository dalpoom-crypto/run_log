import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const db = window.firebaseDb;
  
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalRuns: 0,
    raceRuns: 0,
    casualRuns: 0,
    friends: 0,
    crews: 0,
    likes: 0,
    comments: 0,
  });
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserDetail();
  }, [id]);

  const loadUserDetail = async () => {
    try {
      // 사용자 정보
      const userDoc = await getDoc(doc(db, 'users', id));
      if (!userDoc.exists()) {
        alert('사용자를 찾을 수 없습니다.');
        navigate('/admin/users');
        return;
      }
      setUser({ id: userDoc.id, ...userDoc.data() });

      // 러닝 기록 통계
      const runsQuery = query(collection(db, 'runs'), where('userId', '==', id));
      const runsSnapshot = await getDocs(runsQuery);
      const runs = runsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // 최근 5개 기록
      const sortedRuns = runs
        .sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0))
        .slice(0, 5);
      setRecentRuns(sortedRuns);

      // 친구 수
      let friendsCount = 0;
      try {
        const friendsQuery = query(collection(db, 'friends'), where('userId', '==', id));
        const friendsSnapshot = await getDocs(friendsQuery);
        friendsCount = friendsSnapshot.size;
      } catch (e) {
        console.log('친구 컬렉션 없음');
      }

      // 크루 수
      let crewsCount = 0;
      try {
        const crewMembersQuery = query(collection(db, 'crewMembers'), where('userId', '==', id));
        const crewMembersSnapshot = await getDocs(crewMembersQuery);
        crewsCount = crewMembersSnapshot.size;
      } catch (e) {
        console.log('크루 컬렉션 없음');
      }

      // 좋아요/댓글 수
      let likesCount = 0;
      let commentsCount = 0;
      try {
        const likesQuery = query(collection(db, 'likes'), where('userId', '==', id));
        const likesSnapshot = await getDocs(likesQuery);
        likesCount = likesSnapshot.size;

        const commentsQuery = query(collection(db, 'comments'), where('userId', '==', id));
        const commentsSnapshot = await getDocs(commentsQuery);
        commentsCount = commentsSnapshot.size;
      } catch (e) {
        console.log('좋아요/댓글 컬렉션 없음');
      }

      setStats({
        totalRuns: runs.length,
        raceRuns: runs.filter(r => r.runType === 'race').length,
        casualRuns: runs.filter(r => r.runType === 'casual').length,
        friends: friendsCount,
        crews: crewsCount,
        likes: likesCount,
        comments: commentsCount,
      });
    } catch (error) {
      console.error('사용자 상세 로드 실패:', error);
      alert('사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">사용자 정보 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin/users')}
          className="px-4 py-2 bg-navy-100 text-navy-700 rounded-lg hover:bg-navy-200 transition-colors font-medium"
        >
          ← 뒤로
        </button>
        <div>
          <h2 className="text-2xl font-bold text-navy-900">
            사용자 상세
          </h2>
          <p className="text-navy-600 mt-1">#{user.id.slice(0, 8)}...</p>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">📋 기본 정보</h3>
        <div className="flex items-start gap-6">
          {user.photoURL ? (
            <img 
              src={user.photoURL} 
              alt={user.nickname}
              className="w-24 h-24 rounded-full"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-navy-200 flex items-center justify-center text-navy-600 text-3xl font-bold">
              {user.nickname?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-navy-600">닉네임</p>
              <p className="text-base font-medium text-navy-900">{user.nickname || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-navy-600">이메일</p>
              <p className="text-base font-medium text-navy-900">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-navy-600">가입일</p>
              <p className="text-base font-medium text-navy-900">
                {user.createdAt?.toDate ? 
                  user.createdAt.toDate().toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : '-'
                }
              </p>
            </div>
            <div>
              <p className="text-sm text-navy-600">상태</p>
              <p className="text-base font-medium text-navy-900">
                {user.suspended ? (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600">
                    정지됨
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600">
                    정상
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 활동 통계 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">📊 활동 통계</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.totalRuns}</p>
            <p className="text-sm text-navy-600">총 기록</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.raceRuns}</p>
            <p className="text-sm text-navy-600">대회 기록</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.casualRuns}</p>
            <p className="text-sm text-navy-600">일상 기록</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.friends}</p>
            <p className="text-sm text-navy-600">친구</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.crews}</p>
            <p className="text-sm text-navy-600">크루</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.likes}</p>
            <p className="text-sm text-navy-600">좋아요</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-navy-900">{stats.comments}</p>
            <p className="text-sm text-navy-600">댓글</p>
          </div>
        </div>
      </div>

      {/* 최근 기록 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-navy-900 mb-4">🏃 최근 기록 (5개)</h3>
        {recentRuns.length === 0 ? (
          <p className="text-navy-500 text-center py-8">기록이 없습니다</p>
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run) => (
              <div key={run.id} className="flex items-center justify-between p-3 border border-navy-100 rounded-lg hover:bg-navy-50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-navy-100 text-navy-700">
                      {run.runType === 'race' ? '대회' : '일상'}
                    </span>
                    <p className="text-sm font-medium text-navy-900">
                      {run.raceName || run.location || '기록'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-navy-600">
                    <span>{run.distance}km</span>
                    <span>•</span>
                    <span>{formatTime(run.time)}</span>
                    <span>•</span>
                    <span>
                      {run.createdAt?.toDate ? 
                        run.createdAt.toDate().toLocaleDateString('ko-KR') : 
                        '-'
                      }
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetail;
