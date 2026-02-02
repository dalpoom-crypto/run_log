import { db, collection, getDocs } from '../config/firebase';

// 닉네임 중복 확인 함수
export const checkNicknameExists = async (nickname) => {
  const usersRef = collection(db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.some(doc => doc.data().nickname === nickname);
};

// 비밀번호 유효성 검사
export const validatePassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/;
  return regex.test(password);
};
