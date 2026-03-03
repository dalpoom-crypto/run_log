import React, { useState, useEffect } from 'react';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA4KFdLVKVy6WdAfTGuLWDJsV_tcuNp7kw",
  authDomain: "run-log-31420.firebaseapp.com",
  projectId: "run-log-31420",
  storageBucket: "run-log-31420.firebasestorage.app",
  messagingSenderId: "325067679087",
  appId: "1:325067679087:web:727201211a34ac6c1fb49a",
  measurementId: "G-ZR1WW86K4Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 거리 타입 정의
const RACE_TYPES = {
  '5K': 5,
  '10K': 10,
  'HALF': 21.0975,
  'FULL': 42.195,
  'CUSTOM': null
};

// 유틸리티 함수들
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
};

const calculatePace = (distanceKm, timeSeconds) => {
  const paceSeconds = timeSeconds / distanceKm;
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.floor(paceSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const determineRaceType = (distance) => {
  const tolerance = 0.1; // 100m 오차 허용
  
  for (const [type, standardDistance] of Object.entries(RACE_TYPES)) {
    if (standardDistance && Math.abs(distance - standardDistance) <= tolerance) {
      return type;
    }
  }
  return 'CUSTOM';
};

// 로그인/회원가입 컴포넌트
const AuthForm = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
      }
      onAuthSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600 p-4">
      <div className="auth-card bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md transform hover:scale-105 transition-transform duration-300">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">
            RunArchive
          </h1>
          <p className="text-gray-600 text-lg">당신의 러닝 여정을 기록하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">이름</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors"
                required
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none transition-colors"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold py-3 rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? '처리중...' : (isLogin ? '로그인' : '회원가입')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gray-600 hover:text-orange-600 font-medium transition-colors"
          >
            {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 프로필 컴포넌트
const Profile = ({ user, onUpdateProfile }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(user.photoURL || '');

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    try {
      let photoURL = user.photoURL;
      
      if (photoFile) {
        const storageRef = ref(storage, `profiles/${user.uid}`);
        await uploadBytes(storageRef, photoFile);
        photoURL = await getDownloadURL(storageRef);
      }

      await updateProfile(auth.currentUser, { displayName, photoURL });
      onUpdateProfile();
      setIsEditing(false);
    } catch (error) {
      console.error('프로필 업데이트 실패:', error);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
      <div className="flex items-center gap-6">
        <div className="relative">
          <img
            src={photoPreview || 'https://via.placeholder.com/120'}
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover border-4 border-orange-200"
          />
          {isEditing && (
            <label className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full p-2 cursor-pointer hover:bg-orange-600 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </label>
          )}
        </div>

        <div className="flex-1">
          {isEditing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                placeholder="이름"
              />
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                placeholder="자기소개"
                rows="2"
              />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-800">{user.displayName}</h2>
              <p className="text-gray-600">{user.email}</p>
              {bio && <p className="text-gray-700 mt-2">{bio}</p>}
            </>
          )}
        </div>

        <div>
          {isEditing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                저장
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              프로필 수정
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// 개인 최고 기록 컴포넌트
const PersonalRecords = ({ runs }) => {
  const calculatePRs = () => {
    const prs = {};
    
    runs.forEach(run => {
      const type = run.raceType;
      if (type !== 'CUSTOM' && type) {
        if (!prs[type] || run.time < prs[type].time) {
          prs[type] = run;
        }
      }
    });
    
    return prs;
  };

  const prs = calculatePRs();

  return (
    <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-2xl shadow-lg p-6 mb-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className="text-3xl">🏆</span>
        개인 최고 기록
      </h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(RACE_TYPES).filter(([type]) => type !== 'CUSTOM').map(([type, distance]) => {
          const pr = prs[type];
          return (
            <div key={type} className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-sm font-semibold text-gray-500 mb-1">{type}</div>
              <div className="text-sm text-gray-400 mb-2">{distance}km</div>
              {pr ? (
                <>
                  <div className="text-2xl font-bold text-orange-600">{formatTime(pr.time)}</div>
                  <div className="text-xs text-gray-500 mt-1">{calculatePace(pr.distance, pr.time)}/km</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(pr.date).toLocaleDateString('ko-KR')}
                  </div>
                </>
              ) : (
                <div className="text-gray-400 text-sm">기록 없음</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 달리기 기록 추가 폼
const AddRunForm = ({ user, onRunAdded }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    distance: '',
    hours: '0',
    minutes: '0',
    seconds: '0',
    location: '',
    memo: '',
    isPublic: false
  });
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    setPhotos(files);
    setPhotoPreviews(files.map(file => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const totalSeconds = parseInt(formData.hours) * 3600 + 
                          parseInt(formData.minutes) * 60 + 
                          parseInt(formData.seconds);
      const distance = parseFloat(formData.distance);
      
      // 사진 업로드
      const photoURLs = [];
      for (const photo of photos) {
        const photoRef = ref(storage, `runs/${user.uid}/${Date.now()}_${photo.name}`);
        await uploadBytes(photoRef, photo);
        const url = await getDownloadURL(photoRef);
        photoURLs.push(url);
      }

      const runData = {
        userId: user.uid,
        date: formData.date,
        distance,
        time: totalSeconds,
        pace: calculatePace(distance, totalSeconds),
        location: formData.location,
        memo: formData.memo,
        photos: photoURLs,
        isPublic: formData.isPublic,
        raceType: determineRaceType(distance),
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'runs'), runData);
      
      // 폼 초기화
      setFormData({
        date: new Date().toISOString().split('T')[0],
        distance: '',
        hours: '0',
        minutes: '0',
        seconds: '0',
        location: '',
        memo: '',
        isPublic: false
      });
      setPhotos([]);
      setPhotoPreviews([]);
      setIsOpen(false);
      onRunAdded();
    } catch (error) {
      console.error('기록 추가 실패:', error);
      alert('기록 추가에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300 flex items-center justify-center z-50"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-gray-800">새 기록 추가</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">날짜</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">거리 (km)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.distance}
                    onChange={(e) => setFormData({...formData, distance: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                    placeholder="5.0"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">기록 시간</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={formData.hours}
                      onChange={(e) => setFormData({...formData, hours: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-center"
                      placeholder="0"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">시간</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formData.minutes}
                      onChange={(e) => setFormData({...formData, minutes: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-center"
                      placeholder="0"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">분</div>
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={formData.seconds}
                      onChange={(e) => setFormData({...formData, seconds: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-center"
                      placeholder="0"
                    />
                    <div className="text-xs text-gray-500 text-center mt-1">초</div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">장소</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  placeholder="서울어린이대공원"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">메모 / 감정</label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({...formData, memo: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  rows="3"
                  placeholder="오늘의 달리기는 어땠나요?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">사진</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                />
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {photoPreviews.map((preview, idx) => (
                      <img key={idx} src={preview} alt={`Preview ${idx}`} className="w-full h-24 object-cover rounded-lg" />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({...formData, isPublic: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="isPublic" className="text-sm font-medium text-gray-700">
                  이 기록을 공개합니다
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold py-4 rounded-xl hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? '저장 중...' : '기록 저장'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// 기록 카드 컴포넌트 (인스타그램 스타일)
const RunCard = ({ run, onDelete }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'runs', run.id));
      onDelete();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('기록 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 mb-6">
      {run.photos && run.photos.length > 0 && (
        <div className="relative">
          <img
            src={run.photos[0]}
            alt="Run"
            className="w-full h-80 object-cover"
          />
          {run.photos.length > 1 && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
              +{run.photos.length - 1}
            </div>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-1">{run.location}</h3>
            <p className="text-gray-500 text-sm">{new Date(run.date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex gap-2">
            {run.raceType !== 'CUSTOM' && (
              <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-semibold">
                {run.raceType}
              </span>
            )}
            {!run.isPublic && (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm font-semibold">
                🔒 비공개
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl">
          <div>
            <div className="text-sm text-gray-600 mb-1">거리</div>
            <div className="text-2xl font-bold text-orange-600">{run.distance}km</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">시간</div>
            <div className="text-2xl font-bold text-pink-600">{formatTime(run.time)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">페이스</div>
            <div className="text-2xl font-bold text-purple-600">{run.pace}/km</div>
          </div>
        </div>

        {run.memo && (
          <p className="text-gray-700 mb-4 p-4 bg-gray-50 rounded-xl italic">
            "{run.memo}"
          </p>
        )}

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
        >
          삭제
        </button>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-sm">
              <h3 className="text-xl font-bold text-gray-800 mb-2">기록 삭제</h3>
              <p className="text-gray-600 mb-4">이 기록을 정말 삭제하시겠습니까?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors"
                >
                  삭제
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 피드 컴포넌트
const Feed = ({ user }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'runs'),
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const runsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRuns(runsData);
    } catch (error) {
      console.error('기록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [user]);

  return (
    <div>
      <PersonalRecords runs={runs} />
      
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">기록을 불러오는 중...</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl shadow-lg">
          <div className="text-6xl mb-4">🏃</div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">아직 기록이 없습니다</h3>
          <p className="text-gray-600">첫 번째 달리기 기록을 추가해보세요!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {runs.map(run => (
            <RunCard key={run.id} run={run} onDelete={loadRuns} />
          ))}
        </div>
      )}

      <AddRunForm user={user} onRunAdded={loadRuns} />
    </div>
  );
};

// 메인 앱 컴포넌트
const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600">
        <div className="text-white text-2xl font-bold">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-pink-600 bg-clip-text text-transparent">
            RunArchive
          </h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Profile user={user} onUpdateProfile={() => window.location.reload()} />
        <Feed user={user} />
      </main>
    </div>
  );
};

export default App;
