import { useEffect, useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  confirmPasswordReset,
  GoogleAuthProvider,
  signInWithPopup,
} from '../config/firebase';
import { auth, db, doc, getDoc, setDoc, Timestamp } from '../config/firebase';
import { showToast } from '../utils/toast';
import { checkNicknameExists, validatePassword } from '../utils/validation';
import { 
  generateVerificationCode, 
  saveVerificationCode, 
  sendVerificationEmail, 
  verifyCode,
  sendResetPasswordEmail,
} from '../utils/emailVerification';

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
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [isResetFromLink, setIsResetFromLink] = useState(false);
  const [oobCode, setOobCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const code = params.get('oobCode');

    if (mode === 'resetPassword' && code) {
      setIsResetFromLink(true);
      setOobCode(code);
      setError('');
    }
  }, []);

  const handleNicknameCheck = async () => {
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }

    setNicknameCheckStatus('checking');
    setError('');

    try {
      const exists = await checkNicknameExists(trimmedNickname);
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
      setNicknameChecked(false);
      let errorMessage = '닉네임 확인 중 오류가 발생했습니다.';
      
      // Firestore 인덱스 에러인 경우
      if (err.code === 'failed-precondition' || err.message?.includes('index')) {
        errorMessage = 'Firestore 인덱스가 필요합니다. Firebase 콘솔에서 인덱스를 생성해주세요.';
      } else if (err.code === 'permission-denied') {
        errorMessage = '권한이 없습니다. 로그인 상태를 확인해주세요.';
      } else if (err.code === 'unavailable' || err.code === 'deadline-exceeded') {
        errorMessage = '네트워크 연결을 확인해주세요. 잠시 후 다시 시도해주세요.';
      } else if (err.code === 'unauthenticated') {
        errorMessage = '인증이 필요합니다. 페이지를 새로고침해주세요.';
      } else if (err.message) {
        errorMessage = err.message;
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

  const handleSendVerificationCode = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }

    setSendingCode(true);
    setError('');

    try {
      const code = generateVerificationCode();
      await saveVerificationCode(email, code);
      const result = await sendVerificationEmail(email, code);
      
      if (!result.success) {
        // 프로덕션 환경에서 이메일 전송 실패 시 회원가입 진행 중단
        console.error('인증 코드 전송 실패:', result.error);
        setError(result.error || '인증 코드 전송에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      if (result.isDev) {
        showToast(`개발 모드: 인증 코드는 ${code} 입니다. (콘솔 확인)`, 'info');
      } else {
        showToast('인증 코드가 이메일로 전송되었습니다.', 'success');
      }
      setCodeSent(true);
      setCodeVerified(false);
      setVerificationCode('');
    } catch (err) {
      console.error('인증 코드 전송 실패:', err);
      setError('인증 코드 전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      return;
    }

    setVerifyingCode(true);
    setError('');

    try {
      const result = await verifyCode(email, verificationCode);
      if (result.valid) {
        setCodeVerified(true);
        showToast('인증이 완료되었습니다.', 'success');
      } else {
        setError(result.message || '인증 코드가 일치하지 않습니다.');
      }
    } catch (err) {
      console.error('인증 코드 확인 실패:', err);
      setError('인증 코드 확인 중 오류가 발생했습니다.');
    } finally {
      setVerifyingCode(false);
    }
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

        if (!codeVerified) {
          setError('이메일 인증을 완료해주세요.');
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

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const { user } = userCredential;

      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        const baseNickname =
          (user.displayName || user.email?.split('@')[0] || 'User')
            .trim()
            .slice(0, 20) || 'User';

        let nickname = baseNickname;
        const exists = await checkNicknameExists(nickname);
        if (exists) {
          nickname = `${baseNickname}_${user.uid.slice(0, 6)}`;
        }

        await setDoc(userDocRef, {
          nickname,
          email: user.email ?? '',
          photoURL: user.photoURL ?? null,
          createdAt: Timestamp.now(),
        });

        await updateProfile(user, { displayName: nickname });
      }

      onAuthSuccess();
    } catch (err) {
      if (
        err.code === 'auth/popup-closed-by-user' ||
        err.code === 'auth/cancelled-popup-request'
      ) {
        setError('');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError(
          '이미 같은 이메일로 가입된 계정이 있습니다. 이메일/비밀번호로 로그인해 주세요.',
        );
      } else {
        setError(err.message || '구글 로그인에 실패했습니다. 다시 시도해 주세요.');
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
      await sendResetPasswordEmail(resetEmail);
      showToast('비밀번호 재설정 이메일이 전송되었습니다.');
      setShowPasswordReset(false);
      setResetEmail('');
    } catch (err) {
      setError('이메일 전송에 실패했습니다. 이메일을 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetConfirm = async (e) => {
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
        setError('비밀번호가 일치하지 않습니다.');
        setLoading(false);
        return;
      }

      await confirmPasswordReset(auth, oobCode, newPassword);
      showToast('비밀번호가 성공적으로 변경되었습니다. 다시 로그인해주세요.', 'success');
      setIsResetFromLink(false);
      setOobCode('');
      setNewPassword('');
      setNewPasswordConfirm('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      if (err.code === 'auth/expired-action-code') {
        setError('재설정 링크가 만료되었습니다. 비밀번호 찾기를 다시 시도해주세요.');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('유효하지 않은 재설정 링크입니다. 비밀번호 찾기를 다시 시도해주세요.');
      } else if (err.code === 'auth/weak-password') {
        setError('더 안전한 비밀번호를 입력해주세요.');
      } else {
        setError('비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isResetFromLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-800 via-navy-700 to-navy-600 p-3 sm:p-4">
        <div className="auth-card bg-white rounded-2xl shadow-2xl p-5 sm:p-8 w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-navy-900">RunLog</h1>
            <p className="text-navy-600 text-sm sm:text-base">새 비밀번호를 설정해주세요</p>
          </div>

          <form onSubmit={handlePasswordResetConfirm} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-2">새 비밀번호</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none transition-colors text-sm sm:text-base"
                placeholder="새 비밀번호를 입력하세요"
                required
              />
              <p className="text-xs text-navy-500 mt-1">대소문자, 특수문자 포함 8자 이상</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-700 mb-2">새 비밀번호 확인</label>
              <input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                autoComplete="new-password"
                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none transition-colors text-sm sm:text-base"
                placeholder="새 비밀번호를 다시 입력하세요"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-navy-700 text-white font-semibold py-3 sm:py-3.5 rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              {loading ? '변경중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    const cursorPosition = e.target.selectionStart;
                    setEmail(e.target.value);
                    setCodeSent(false);
                    setCodeVerified(false);
                    setVerificationCode('');
                    // 커서 위치 복원
                    setTimeout(() => {
                      e.target.setSelectionRange(cursorPosition, cursorPosition);
                    }, 0);
                  }}
                  disabled={codeVerified}
                  className={`flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 transition-colors text-sm sm:text-base ${
                    codeVerified 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-navy-200 focus:border-navy-600'
                  } focus:outline-none disabled:opacity-70`}
                  placeholder="이메일을 입력하세요"
                  required
                />
                {!isLogin && !codeVerified && (
                  <button
                    type="button"
                    onClick={handleSendVerificationCode}
                    disabled={sendingCode || !email.trim()}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-navy-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    {sendingCode ? '전송중' : '코드 전송'}
                  </button>
                )}
              </div>
              {codeVerified && (
                <p className="text-xs text-green-600 mt-1">✓ 이메일 인증이 완료되었습니다.</p>
              )}
            </div>

            {!isLogin && codeSent && !codeVerified && (
              <div>
                <label className="block text-sm font-semibold text-navy-700 mb-2">인증 코드</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setVerificationCode(value);
                      setError('');
                    }}
                    placeholder="6자리 숫자 입력"
                    maxLength={6}
                    className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border-2 border-navy-200 focus:border-navy-600 focus:outline-none transition-colors text-sm sm:text-base text-center tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={verifyingCode || verificationCode.length !== 6}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-navy-600 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  >
                    {verifyingCode ? '확인중' : '확인'}
                  </button>
                </div>
                <p className="text-xs text-navy-500 mt-1">이메일로 전송된 6자리 코드를 입력해주세요.</p>
              </div>
            )}

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
                  placeholder="비밀번호를 입력하세요"
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
                    placeholder="비밀번호를 입력하세요"
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

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-navy-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-navy-500">또는</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white border-2 border-navy-200 text-navy-800 font-semibold py-3 sm:py-3.5 rounded-lg hover:bg-navy-50 hover:border-navy-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base touch-manipulation"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              구글로 로그인
            </button>
          </form>

          <div className="mt-4 sm:mt-6 text-center space-y-2">
            <div className="text-xs sm:text-sm text-navy-600">
              {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setCodeSent(false);
                  setCodeVerified(false);
                  setVerificationCode('');
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
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(e) => {
                    const cursorPosition = e.target.selectionStart;
                    setResetEmail(e.target.value);
                    // 커서 위치 복원
                    setTimeout(() => {
                      e.target.setSelectionRange(cursorPosition, cursorPosition);
                    }, 0);
                  }}
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
