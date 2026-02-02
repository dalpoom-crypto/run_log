import { useState } from 'react';
import { updateProfile, updatePassword, signInWithEmailAndPassword, deleteUser } from '../config/firebase';
import { auth, db, doc, updateDoc, deleteDoc, collection, query, where, getDocs } from '../config/firebase';
import { showToast } from '../utils/toast';
import { checkNicknameExists, validatePassword } from '../utils/validation';

const SettingsModal = ({ user, userData, onClose, onSignOut }) => {
  const [activeView, setActiveView] = useState('menu');
  const [nickname, setNickname] = useState(userData?.nickname || user.displayName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  const handleNicknameUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (nickname !== (userData?.nickname || user.displayName)) {
        const nicknameExists = await checkNicknameExists(nickname);
        if (nicknameExists) {
          setError('이미 사용 중인 닉네임입니다.');
          setLoading(false);
          return;
        }
      }

      await updateProfile(auth.currentUser, { displayName: nickname });
      await updateDoc(doc(db, 'users', user.uid), { nickname });
      
      showToast('닉네임이 변경되었습니다.');
      setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setError('닉네임 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!validatePassword(newPassword)) {
        setError('비밀번호는 대소문자, 특수문자를 포함하여 8자 이상이어야 합니다.');
        setLoading(false);
        return;
      }

      if (newPassword !== newPasswordConfirm) {
        setError('새 비밀번호가 일치하지 않습니다.');
        setLoading(false);
        return;
      }

      await signInWithEmailAndPassword(auth, user.email, currentPassword);
      await updatePassword(auth.currentUser, newPassword);
      
      showToast('비밀번호가 변경되었습니다.');
      setActiveView('menu');
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('현재 비밀번호가 일치하지 않습니다.');
      } else {
        setError('비밀번호 변경에 실패했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      showToast('비밀번호를 입력해주세요.', 'error');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, user.email, deletePassword);

      const userDocRef = doc(db, 'users', user.uid);
      await deleteDoc(userDocRef);

      const runsQuery = query(collection(db, 'runs'), where('userId', '==', user.uid));
      const runsSnapshot = await getDocs(runsQuery);
      const deletePromises = runsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      await deleteUser(auth.currentUser);
      
      showToast('회원 탈퇴가 완료되었습니다.');
    } catch (error) {
      console.error('회원 탈퇴 실패:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        showToast('비밀번호가 일치하지 않습니다.', 'error');
      } else if (error.code === 'auth/requires-recent-login') {
        showToast('보안을 위해 다시 로그인 후 탈퇴해주세요.', 'error');
        onSignOut();
      } else {
        showToast('회원 탈퇴에 실패했습니다.', 'error');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto slide-up">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-navy-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg sm:text-xl font-bold text-navy-900">
            {activeView === 'menu' && '설정'}
            {activeView === 'nickname' && '닉네임 변경'}
            {activeView === 'password' && '비밀번호 변경'}
          </h2>
          <button
            onClick={onClose}
            className="text-navy-400 hover:text-navy-600 transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {activeView === 'menu' && (
            <div className="space-y-3">
              <button
                onClick={() => setActiveView('nickname')}
                className="w-full bg-navy-200 text-navy-900 font-medium text-sm px-4 py-3 rounded-lg transition-colors text-center hover:bg-navy-300"
              >
                닉네임 변경
              </button>
              <button
                onClick={() => setActiveView('password')}
                className="w-full bg-navy-200 text-navy-900 font-medium text-sm px-4 py-3 rounded-lg transition-colors text-center hover:bg-navy-300"
              >
                비밀번호 변경
              </button>

              <button
                onClick={() => alert('RunLog v1.0.0\n\n러닝 기록을 관리하는 앱입니다.')}
                className="w-full bg-navy-200 text-navy-900 text-sm px-4 py-3 rounded-lg transition-colors text-center hover:bg-navy-300"
              >
                앱 정보
              </button>

              <button
                onClick={onSignOut}
                className="w-full bg-navy-900 hover:bg-navy-800 text-white font-medium text-sm px-4 py-3 rounded-lg transition-colors text-center"
              >
                로그아웃
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-medium text-sm px-4 py-3 rounded-lg transition-colors text-center"
              >
                회원 탈퇴
              </button>
            </div>
          )}

          {activeView === 'nickname' && (
            <form onSubmit={handleNicknameUpdate} className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">새 닉네임</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                  required
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="flex-1 bg-navy-100 text-navy-700 py-2 rounded-lg hover:bg-navy-200 transition-colors text-sm font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-navy-700 text-white py-2 rounded-lg hover:bg-navy-800 transition-colors text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          )}

          {activeView === 'password' && (
            <form onSubmit={handlePasswordUpdate} className="space-y-3">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                placeholder="현재 비밀번호"
                required
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                placeholder="새 비밀번호"
                required
              />
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                placeholder="새 비밀번호 확인"
                required
              />
              <p className="text-xs text-navy-500">대소문자, 특수문자 포함 8자 이상</p>
              
              {error && (
                <div className="bg-red-50 text-red-600 px-3 py-2 rounded-lg text-xs">
                  {error}
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveView('menu')}
                  className="flex-1 bg-navy-100 text-navy-700 py-2 rounded-lg hover:bg-navy-200 transition-colors text-sm font-semibold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-navy-700 text-white py-2 rounded-lg hover:bg-navy-800 transition-colors text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? '변경 중...' : '변경'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full modal-content">
            <h3 className="text-lg font-bold text-navy-900 mb-2">회원 탈퇴</h3>
            <p className="text-navy-600 mb-2 text-sm">정말로 탈퇴하시겠습니까?</p>
            <p className="text-red-600 mb-4 text-sm font-semibold">⚠️ 모든 데이터가 삭제되며 복구할 수 없습니다.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-navy-700 mb-2">비밀번호 확인</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none text-sm"
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
              >
                탈퇴
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                }}
                className="flex-1 bg-navy-100 text-navy-700 py-2 rounded-lg hover:bg-navy-200 transition-colors text-sm font-semibold"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;
