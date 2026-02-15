import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';

const ReportManagement = () => {
  const db = window.firebaseDb;
  const auth = window.firebaseAuth;
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('pending'); // pending, processing, resolved, dismissed
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const reportsQuery = query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(reportsQuery);
      
      // 사용자 정보 추가
      const reportsWithUsers = await Promise.all(
        snapshot.docs.map(async (reportDoc) => {
          const reportData = reportDoc.data();
          
          // 신고자 정보
          let reporterName = '알 수 없음';
          try {
            const reporterDoc = await getDocs(
              query(collection(db, 'users'), where('__name__', '==', reportData.reporterId))
            );
            reporterName = reporterDoc.docs[0]?.data()?.nickname || '알 수 없음';
          } catch (e) {}

          // 대상 사용자 정보
          let targetUserName = '알 수 없음';
          try {
            const targetUserDoc = await getDocs(
              query(collection(db, 'users'), where('__name__', '==', reportData.targetUserId))
            );
            targetUserName = targetUserDoc.docs[0]?.data()?.nickname || '알 수 없음';
          } catch (e) {}

          return {
            id: reportDoc.id,
            ...reportData,
            reporterName,
            targetUserName,
          };
        })
      );
      
      setReports(reportsWithUsers);
    } catch (error) {
      console.error('신고 로드 실패:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (reportId, status, action) => {
    if (!confirm(`이 신고를 ${action}하시겠습니까?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status,
        resolvedAt: Timestamp.now(),
        resolvedBy: auth.currentUser?.uid || 'unknown'
      });
      
      alert(`신고가 ${action}되었습니다.`);
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      console.error('신고 처리 실패:', error);
      alert('오류가 발생했습니다.');
    }
  };

  const handleDeleteContent = async (report) => {
    if (!confirm('신고된 콘텐츠를 삭제하시겠습니까?')) {
      return;
    }

    try {
      // 콘텐츠 삭제
      if (report.type === 'run') {
        await deleteDoc(doc(db, 'runs', report.targetId));
      } else if (report.type === 'comment') {
        await deleteDoc(doc(db, 'comments', report.targetId));
      } else if (report.type === 'post') {
        await deleteDoc(doc(db, 'crewPosts', report.targetId));
      }

      // 신고 상태 업데이트
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'resolved',
        resolvedAt: Timestamp.now(),
        resolvedBy: auth.currentUser?.uid || 'unknown',
        adminNote: '콘텐츠 삭제됨'
      });

      alert('콘텐츠가 삭제되었습니다.');
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      console.error('콘텐츠 삭제 실패:', error);
      alert('콘텐츠 삭제에 실패했습니다.');
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      spam: '스팸',
      inappropriate: '부적절한 내용',
      harassment: '괴롭힘',
      other: '기타'
    };
    return labels[category] || category;
  };

  const getTypeLabel = (type) => {
    const labels = {
      run: '러닝 기록',
      comment: '댓글',
      post: '게시글',
      user: '사용자'
    };
    return labels[type] || type;
  };

  const filteredReports = reports.filter(report => {
    if (filterStatus === 'all') return true;
    return report.status === filterStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">신고 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy-900">신고 관리</h2>
        <p className="text-navy-600 mt-1">전체 {reports.length}건</p>
      </div>

      {/* 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            전체 ({reports.length})
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'pending'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            미처리 ({reports.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterStatus('processing')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'processing'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            처리중 ({reports.filter(r => r.status === 'processing').length})
          </button>
          <button
            onClick={() => setFilterStatus('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'resolved'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            완료 ({reports.filter(r => r.status === 'resolved').length})
          </button>
          <button
            onClick={() => setFilterStatus('dismissed')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'dismissed'
                ? 'bg-navy-700 text-white'
                : 'bg-navy-100 text-navy-700 hover:bg-navy-200'
            }`}
          >
            무시됨 ({reports.filter(r => r.status === 'dismissed').length})
          </button>
        </div>
      </div>

      {/* 신고 목록 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-navy-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">유형</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">카테고리</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">대상</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">신고자</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">일시</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {filteredReports.map((report) => (
              <tr key={report.id} className="hover:bg-navy-50">
                <td className="px-6 py-4 text-sm text-navy-900">
                  {getTypeLabel(report.type)}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                    {getCategoryLabel(report.category)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-navy-600">
                  {report.targetUserName}
                </td>
                <td className="px-6 py-4 text-sm text-navy-600">
                  {report.reporterName}
                </td>
                <td className="px-6 py-4 text-sm text-navy-500">
                  {report.createdAt?.toDate ? 
                    report.createdAt.toDate().toLocaleDateString('ko-KR') : 
                    '-'
                  }
                </td>
                <td className="px-6 py-4">
                  {report.status === 'pending' && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                      미처리
                    </span>
                  )}
                  {report.status === 'processing' && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                      처리중
                    </span>
                  )}
                  {report.status === 'resolved' && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                      완료
                    </span>
                  )}
                  {report.status === 'dismissed' && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                      무시됨
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <button
                    onClick={() => setSelectedReport(report)}
                    className="px-3 py-1 bg-navy-100 text-navy-700 rounded hover:bg-navy-200 transition-colors font-medium"
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredReports.length === 0 && (
          <div className="text-center text-navy-500 py-12">
            <p className="text-lg font-medium mb-2">신고가 없습니다</p>
            <p className="text-sm">
              {reports.length === 0 
                ? '아직 신고가 없습니다' 
                : '필터를 변경해보세요'
              }
            </p>
          </div>
        )}
      </div>

      {/* 신고 상세 모달 */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-navy-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-navy-900">신고 상세</h3>
                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-navy-400 hover:text-navy-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* 신고 정보 */}
              <div>
                <h4 className="font-semibold text-navy-900 mb-2">📋 신고 정보</h4>
                <div className="bg-navy-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-navy-600 w-24">유형:</span>
                    <span className="text-sm font-medium text-navy-900">
                      {getTypeLabel(selectedReport.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-navy-600 w-24">카테고리:</span>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                      {getCategoryLabel(selectedReport.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-navy-600 w-24">신고자:</span>
                    <span className="text-sm font-medium text-navy-900">
                      {selectedReport.reporterName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-navy-600 w-24">대상 사용자:</span>
                    <span className="text-sm font-medium text-navy-900">
                      {selectedReport.targetUserName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-navy-600 w-24">일시:</span>
                    <span className="text-sm text-navy-900">
                      {selectedReport.createdAt?.toDate ? 
                        selectedReport.createdAt.toDate().toLocaleString('ko-KR') : 
                        '-'
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* 신고 사유 */}
              <div>
                <h4 className="font-semibold text-navy-900 mb-2">💬 신고 사유</h4>
                <div className="bg-navy-50 rounded-lg p-4">
                  <p className="text-sm text-navy-700">
                    {selectedReport.reason || '사유가 입력되지 않았습니다.'}
                  </p>
                </div>
              </div>

              {/* 조치 */}
              {selectedReport.status === 'pending' && (
                <div>
                  <h4 className="font-semibold text-navy-900 mb-2">⚙️ 조치</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'processing', '처리중으로 변경')}
                      className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                    >
                      처리중
                    </button>
                    <button
                      onClick={() => handleDeleteContent(selectedReport)}
                      className="flex-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
                    >
                      콘텐츠 삭제
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedReport.id, 'dismissed', '무시')}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      무시
                    </button>
                  </div>
                </div>
              )}

              {selectedReport.status !== 'pending' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-medium">
                    ✓ 이 신고는 처리되었습니다
                  </p>
                  {selectedReport.adminNote && (
                    <p className="text-xs text-green-700 mt-1">
                      메모: {selectedReport.adminNote}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportManagement;
