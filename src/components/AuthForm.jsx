import { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from '../config/firebase';
import { auth, db, doc, setDoc, Timestamp } from '../config/firebase';
import { showToast } from '../utils/toast';
import { checkNicknameExists, validatePassword } from '../utils/validation';

const AuthForm = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameChecked, setNicknameChecked] = useState(false);
  const [nicknameCheckStatus, setNicknameCheckStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const handleNicknameCheck = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setNicknameCheckStatus('checking');
    setError('');

    try {
      const exists = await checkNicknameExists(nickname);
      if (exists) {
        setNicknameCheckStatus('taken');
        setNicknameChecked(false);
        setError('이미 사용 중인 닉네임입니다.');
      } else {
        setNicknameCheckStatus('available');
        setNicknameChecked(true);
        setError('');
      }
    } catch (err) {
      console.error('닉네임 확인 에러 상세:', err);
      setNicknameCheckStatus('');
      let errorMessage = '닉네임 확인 중 오류가 발생했습니다.';
      
      // Firestore 인덱스 에러인 경우
      if (err.code === 'failed-precondition' || err.message?.includes('index')) {
        errorMessage = 'Firestore 인덱스가 필요합니다. Firebase 콘솔에서 인덱스를 생성해주세요.';
      } else if (err.code === 'permission-denied') {
        errorMessage = '권한이 없습니다. 로그인 상태를 확인해주세요.';
      } else if (err.message) {
        errorMessage = `오류: ${err.message}`;
      }
      
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  };

  const handleNicknameChange = (e) => {
    setNickname(e.target.value);
    setNicknameChecked(false);
    setNicknameCheckStatus('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!nicknameChecked) {
          setError('닉네임 중복 확인을 해주세요.');
          setLoading(false);
          return;
        }

        if (!validatePassword(password)) {
          setError('비밀번호는 대소문자, 특수문자를 포함하여 8자 이상이어야 합니다.');
          setLoading(false);
          return;
        }
        
        if (password !== passwordConfirm) {
          setError('비밀번호가 일치하지 않습니다.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          nickname,
          email,
          createdAt: Timestamp.now()
        });

        await updateProfile(userCredential.user, { displayName: nickname });
        
        setShowSuccessModal(true);
        setTimeout(() => {
          setShowSuccessModal(false);
          onAuthSuccess();
        }, 2000);
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호를 다시 한 번 확인해주세요.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('이미 사용 중인 이메일입니다.');
      } else {
        setError('오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      showToast('비밀번호 재설정 이메일이 전송되었습니다.');
      setShowPasswordReset(false);
      setResetEmail('');
    } catch (err) {
      setError('이메일 전송에 실패했습니다. 이메일을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-800 via-navy-700 to-navy-600 p-3 sm:p-4">
        <div className="auth-card bg-white rounded-2xl shadow-2xl p-5 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-navy-900">RunLog</h1>
            <p className="text-navy-600 text-sm sm:text-base">당신의 러닝 여정을 기록하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">닉네임</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nickname}
                    onChange={handleNicknameChange}
                    className={`flex-1 min-w-0 px-3 sm:px-4 py-3 rounded-lg border-2 transition-colors text-sm sm:text-base ${
                      nicknameCheckStatus === 'available' 
                        ? 'border-green-500 focus:border-green-600' 
                        : nicknameCheckStatus === 'taken'
                        ? 'border-red-500 focus:border-red-600'
                        : 'border-navy-200 focus:border-navy-600'
                    } focus:outline-none`}
                    required
                  />
                  <button
                    type="button"
                    onClick={handleNicknameCheck}
                    disabled={nicknameCheckStatus === 'checking' || !nickname.trim()}
                    className="px-3 sm:px-4 py-3 bg-navy-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    {nicknameCheckStatus === 'checking' ? '확인중' : '중복확인'}
                  </button>
                </div>
                {nicknameCheckStatus === 'available' && (
                  <p className="text-xs text-green-600 mt-1">✓ 사용 가능한 닉네임입니다.</p>
                )}
                {nicknameCheckStatus === 'taken' && (
                  <p className="text-xs text-red-600 mt-1">✗ 이미 사용 중인 닉네임입니다.</p>
                )}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-2">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none transition-colors text-sm sm:text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-2">비밀번호</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  data-form-type="password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none transition-colors password-input text-sm sm:text-base"
                  style={{ 
                    paddingRight: '3rem',
                    WebkitAppearance: 'none',
                    MozAppearance: 'textfield'
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600 active:text-navy-700 z-20 p-1 touch-manipulation"
                  style={{ 
                    pointerEvents: 'auto',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {!isLogin && (
                <p className="text-xs text-navy-500 mt-1">대소문자, 특수문자 포함 8자 이상</p>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? "text" : "password"}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    data-form-type="password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-10 sm:pr-12 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none transition-colors password-input text-sm sm:text-base"
                    style={{ 
                      paddingRight: '3rem',
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield'
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPasswordConfirm(!showPasswordConfirm);
                    }}
                    className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-600 active:text-navy-700 z-20 p-1 touch-manipulation"
                    style={{ 
                      pointerEvents: 'auto',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {showPasswordConfirm ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-700 text-white font-semibold py-3 sm:py-3.5 rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
            >
              {loading && (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? '처리중...' : (isLogin ? '로그인' : '회원가입')}
            </button>
          </form>

          <div className="mt-4 sm:mt-6 text-center space-y-2">
            <div className="text-xs sm:text-sm text-navy-600">
              {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-navy-700 font-semibold hover:text-navy-900 active:text-navy-950 transition-colors touch-manipulation"
              >
                {isLogin ? '회원가입' : '로그인'}
              </button>
            </div>
            
            {isLogin && (
              <button
                onClick={() => setShowPasswordReset(true)}
                className="text-sm text-navy-600 hover:text-navy-800 transition-colors"
              >
                비밀번호 찾기
              </button>
            )}
          </div>
        </div>
      </div>

      {showPasswordReset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md slide-up">
            <h2 className="text-xl sm:text-2xl font-bold text-navy-900 mb-3 sm:mb-4">비밀번호 찾기</h2>
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">이메일</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none"
                  placeholder="가입한 이메일을 입력하세요"
                  required
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-navy-700 text-white font-semibold py-3 rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors text-sm sm:text-base touch-manipulation"
                >
                  전송
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setResetEmail('');
                    setError('');
                  }}
                  className="flex-1 bg-navy-100 text-navy-700 font-semibold py-3 rounded-lg hover:bg-navy-200 active:bg-navy-300 transition-colors text-sm sm:text-base touch-manipulation"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 sm:p-8 text-center slide-up">
            <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🎉</div>
            <h2 className="text-xl sm:text-2xl font-bold text-navy-900 mb-2">환영합니다!</h2>
            <p className="text-sm sm:text-base text-navy-600">회원가입이 완료되었습니다.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default AuthForm;
