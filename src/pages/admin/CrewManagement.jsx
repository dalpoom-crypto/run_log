import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const CrewManagement = () => {
  const navigate = useNavigate();
  const db = window.firebaseDb;
  
  const [crews, setCrews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending, active

  useEffect(() => {
    loadCrews();
  }, []);

  const loadCrews = async () => {
    try {
      const crewsQuery = query(
        collection(db, 'crews'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(crewsQuery);
      
      // 멤버 수 계산
      const crewsWithMembers = await Promise.all(
        snapshot.docs.map(async (crewDoc) => {
          const crewData = crewDoc.data();
          
          // 멤버 수 계산
          let memberCount = 0;
          try {
            const membersQuery = query(
              collection(db, 'crewMembers'),
              where('crewId', '==', crewDoc.id)
            );
            const membersSnapshot = await getDocs(membersQuery);
            memberCount = membersSnapshot.size;
          } catch (e) {
            console.log('멤버 조회 실패');
          }

          // 관리자 정보
          let ownerName = '알 수 없음';
          try {
            const ownerDoc = await getDocs(
              query(collection(db, 'users'), where('__name__', '==', crewData.ownerId))
            );
            ownerName = ownerDoc.docs[0]?.data()?.nickname || '알 수 없음';
          } catch (e) {
            console.log('관리자 조회 실패');
          }

          return {
            id: crewDoc.id,
            ...crewData,
            memberCount,
            ownerName,
          };
        })
      );
      
      setCrews(crewsWithMembers);
    } catch (error) {
      console.error('크루 로드 실패:', error);
      // 크루 컬렉션이 없을 수 있음
      setCrews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCrew = async (crewId, approve) => {
    const action = approve ? '승인' : '거부';
    if (!confirm(`이 크루를 ${action}하시겠습니까?`)) {
      return;
    }

    try {
      if (approve) {
        await updateDoc(doc(db, 'crews', crewId), {
          status: 'approved',
          approvedAt: new Date()
        });
        alert('크루가 승인되었습니다.');
      } else {
        await deleteDoc(doc(db, 'crews', crewId));
        alert('크루가 거부되었습니다.');
      }
      loadCrews();
    } catch (error) {
      console.error('크루 승인 실패:', error);
      alert('오류가 발생했습니다.');
    }
  };

  const handleDeleteCrew = async (crewId) => {
    if (!confirm('이 크루를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'crews', crewId));
      
      // 크루 멤버도 삭제
      const membersQuery = query(
        collection(db, 'crewMembers'),
        where('crewId', '==', crewId)
      );
      const membersSnapshot = await getDocs(membersQuery);
      await Promise.all(
        membersSnapshot.docs.map(doc => deleteDoc(doc.ref))
      );
      
      alert('크루가 삭제되었습니다.');
      loadCrews();
    } catch (error) {
      console.error('크루 삭제 실패:', error);
      alert('크루 삭제에 실패했습니다.');
    }
  };

  const filteredCrews = crews.filter(crew => {
    if (filterStatus === 'pending') return crew.status === 'pending';
    if (filterStatus === 'active') return crew.status !== 'pending';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">크루 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">크루 관리</h2>
        <p className="text-navy-600 mt-1">전체 {crews.length}개</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            전체 ({crews.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            승인 대기 ({crews.filter(c => c.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'active'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            활성 ({crews.filter(c => c.status !== 'pending').length})
          </button>
        </div>
      </div>

      {/* 크루 목록 */}
      <div className="space-y-4">
        {filteredCrews.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-lg font-medium text-navy-900 mb-2">크루가 없습니다</p>
            <p className="text-sm text-navy-600">
              {crews.length === 0 
                ? '아직 생성된 크루가 없습니다' 
                : '필터를 변경해보세요'
              }
            </p>
          </div>
        ) : (
          filteredCrews.map((crew) => (
            <div key={crew.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-navy-900">
                      {crew.name}
                    </h3>
                    {crew.status === 'pending' && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                        승인 대기
                      </span>
                    )}
                    {crew.isPublic && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                        공개
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-navy-600 mb-3">
                    {crew.description || '설명 없음'}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-navy-500">
                    <span>👥 {crew.memberCount}명</span>
                    <span>•</span>
                    <span>👤 관리자: {crew.ownerName}</span>
                    <span>•</span>
                    <span>
                      생성일: {crew.createdAt?.toDate ? 
                        crew.createdAt.toDate().toLocaleDateString('ko-KR') : 
                        '-'
                      }
                    </span>
                  </div>

                  {crew.location && (
                    <p className="text-xs text-navy-400 mt-2">
                      📍 {crew.location}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  {crew.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleApproveCrew(crew.id, true)}
                        className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium text-sm"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleApproveCrew(crew.id, false)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
                      >
                        거부
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDeleteCrew(crew.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium text-sm"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CrewManagement;
