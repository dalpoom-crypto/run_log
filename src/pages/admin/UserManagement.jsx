import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const UserManagement = () => {
  const navigate = useNavigate();
  const db = window.firebaseDb;
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, suspended

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(usersQuery);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    } catch (error) {
      console.error('사용자 로드 실패:', error);
      alert('사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendUser = async (userId, suspend) => {
    const action = suspend ? '정지' : '정지 해제';
    if (!confirm(`이 사용자를 ${action}하시겠습니까?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        suspended: suspend,
        suspendedAt: suspend ? Timestamp.now() : null
      });
      
      alert(`사용자가 ${action}되었습니다.`);
      loadUsers();
    } catch (error) {
      console.error('사용자 정지 실패:', error);
      alert('오류가 발생했습니다.');
    }
  };

  const filteredUsers = users.filter(user => {
    // 검색 필터
    const matchesSearch = 
      user.nickname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    // 상태 필터
    if (filterStatus === 'active') return !user.suspended;
    if (filterStatus === 'suspended') return user.suspended;
    return true; // all
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-navy-700 border-t-transparent mb-4"></div>
          <p className="text-navy-600">사용자 목록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">사용자 관리</h2>
          <p className="text-navy-600 mt-1">전체 {users.length.toLocaleString()}명</p>
        </div>
      </div>

      {/* 검색 & 필터 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="닉네임, 이메일 또는 ID로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border-2 border-navy-200 rounded-lg focus:border-navy-600 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border-2 border-navy-200 rounded-lg focus:border-navy-600 focus:outline-none bg-white"
          >
            <option value="all">전체</option>
            <option value="active">정상</option>
            <option value="suspended">정지됨</option>
          </select>
        </div>
      </div>

      {/* 사용자 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-navy-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                  닉네임
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-navy-700 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-navy-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-500">
                    #{user.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {user.photoURL ? (
                        <img 
                          src={user.photoURL} 
                          alt={user.nickname}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-navy-200 flex items-center justify-center text-navy-600 text-xs font-bold">
                          {user.nickname?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <span className="text-sm font-medium text-navy-900">
                        {user.nickname || '알 수 없음'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-navy-500">
                    {user.createdAt?.toDate ? 
                      user.createdAt.toDate().toLocaleDateString('ko-KR') :
                      '-'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.suspended ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-600">
                        정지됨
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-600">
                        정상
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <button
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      className="px-3 py-1 bg-navy-100 text-navy-700 rounded hover:bg-navy-200 transition-colors font-medium"
                    >
                      상세
                    </button>
                    <button
                      onClick={() => handleSuspendUser(user.id, !user.suspended)}
                      className={`px-3 py-1 rounded transition-colors font-medium ${
                        user.suspended
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {user.suspended ? '해제' : '정지'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center text-navy-500 py-12">
              <p className="text-lg font-medium mb-2">검색 결과가 없습니다</p>
              <p className="text-sm">다른 검색어를 입력해보세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
