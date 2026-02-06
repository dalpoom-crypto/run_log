import { db, collection, query, where, getDocs } from '../config/firebase';

// 닉네임 중복 확인 함수
export const checkNicknameExists = async (nickname) => {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('nickname', '==', nickname)
    );
    const snapshot = await getDocs(usersQuery);
    return !snapshot.empty; // 결과가 있으면 중복
  } catch (error) {
    console.error('닉네임 중복 확인 실패:', error);
    throw error;
  }
};

// 비밀번호 유효성 검사
export const validatePassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  return regex.test(password);
};
