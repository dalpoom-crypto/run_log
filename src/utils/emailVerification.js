import { db, collection, addDoc, doc, getDoc, deleteDoc, query, where, getDocs, Timestamp, functions, httpsCallable } from '../config/firebase';

/**
 * 6자리 인증 코드 생성
 */
export const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * 인증 코드를 Firestore에 저장
 */
export const saveVerificationCode = async (email, code) => {
  try {
    // 기존 인증 코드가 있으면 삭제
    const existingQuery = query(
      collection(db, 'emailVerification'),
      where('email', '==', email)
    );
    const existingSnapshot = await getDocs(existingQuery);
    const deletePromises = existingSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // 새 인증 코드 저장 (10분 유효)
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + 10 * 60 * 1000));
    await addDoc(collection(db, 'emailVerification'), {
      email,
      code,
      createdAt: Timestamp.now(),
      expiresAt,
      verified: false
    });

    return true;
  } catch (error) {
    console.error('인증 코드 저장 실패:', error);
    throw error;
  }
};

/**
 * 이메일로 인증 코드 전송 (Firebase Cloud Functions 사용)
 */
export const sendVerificationEmail = async (email, code) => {
  try {
    const sendVerificationCode = httpsCallable(functions, 'sendVerificationCode');
    const result = await sendVerificationCode({ email, code });
    
    if (result.data && result.data.success) {
      return { success: true, isDev: false };
    } else {
      throw new Error('이메일 전송에 실패했습니다.');
    }
  } catch (error) {
    console.error('이메일 전송 실패:', error);

    // 개발 환경에서만 우회 허용
    if (import.meta.env.DEV) {
      console.warn('[개발 환경] 이메일 전송 실패, 인증 코드:', code);
      return { success: true, isDev: true };
    }

    // 프로덕션에서는 실패를 그대로 반환
    return { success: false, error: error.message };
  }
};

/**
 * 인증 코드 검증
 */
export const verifyCode = async (email, code) => {
  try {
    const verificationQuery = query(
      collection(db, 'emailVerification'),
      where('email', '==', email),
      where('code', '==', code)
    );
    const snapshot = await getDocs(verificationQuery);

    if (snapshot.empty) {
      return { valid: false, message: '인증 코드가 일치하지 않습니다.' };
    }

    const verificationDoc = snapshot.docs[0];
    const verificationData = verificationDoc.data();

    // 만료 시간 확인
    const expiresAt = verificationData.expiresAt?.toDate();
    if (expiresAt && expiresAt < new Date()) {
      await deleteDoc(verificationDoc.ref);
      return { valid: false, message: '인증 코드가 만료되었습니다. 다시 요청해주세요.' };
    }

    // 이미 사용된 코드인지 확인
    if (verificationData.verified) {
      return { valid: false, message: '이미 사용된 인증 코드입니다.' };
    }

    // 인증 완료 표시
    await deleteDoc(verificationDoc.ref);

    return { valid: true };
  } catch (error) {
    console.error('인증 코드 검증 실패:', error);
    return { valid: false, message: '인증 코드 확인 중 오류가 발생했습니다.' };
  }
};
