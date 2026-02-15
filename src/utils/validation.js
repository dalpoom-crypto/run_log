import { db, collection, query, where, getDocs } from '../config/firebase';

// 닉네임 중복 확인 함수
export const checkNicknameExists = async (nickname) => {
  try {
    // 입력값 검증
    if (!nickname || typeof nickname !== 'string') {
      throw new Error('닉네임이 유효하지 않습니다.');
    }
    
    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      throw new Error('닉네임을 입력해주세요.');
    }
    
    // Firestore 쿼리 실행
    const usersQuery = query(
      collection(db, 'users'),
      where('nickname', '==', trimmedNickname)
    );
    
    const snapshot = await getDocs(usersQuery);
    return !snapshot.empty; // 결과가 있으면 중복
  } catch (error) {
    console.error('닉네임 중복 확인 실패:', error);
    
    // Firestore 관련 오류 처리
    if (error.code) {
      // Firestore 에러 코드가 있는 경우 그대로 전달
      throw error;
    }
    
    // 일반 에러인 경우 메시지와 함께 전달
    if (error.message) {
      throw error;
    }
    
    // 알 수 없는 오류
    throw new Error('닉네임 확인 중 알 수 없는 오류가 발생했습니다.');
  }
};

// 비밀번호 유효성 검사
export const validatePassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  return regex.test(password);
};
