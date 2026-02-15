import { useState } from 'react';

const OtherProfile = ({ user, userData, runs, currentUser }) => {
  const [isFriend, setIsFriend] = useState(false); // TODO: 실제 친구 여부 체크
  
  const raceCount = runs.filter(run => run.runType === 'race').length;
  const casualCount = runs.filter(run => run.runType === 'casual').length;
  const overseasCount = runs.filter(run => run.isOverseas).length;
  const hasFullMarathon = runs.some(run => run.raceType === 'FULL');

  const handleFriendRequest = async () => {
    // TODO: 친구 요청 로직 (Phase 3)
    alert('친구 요청 기능은 Phase 3에서 구현됩니다.');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-start gap-4 sm:gap-8">
        {/* 프로필 사진 */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-navy-100 border-2 border-navy-200">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-navy-100">
                <span className="text-3xl sm:text-4xl text-navy-400 font-bold">?</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3 truncate">
            {userData?.nickname || user.displayName}
          </h2>
          
          {/* 크루명 (있으면) */}
          {userData?.crewName && (
            <p className="text-xs sm:text-sm text-navy-600 mb-2">
              🏃 {userData.crewName}
            </p>
          )}
          
          {/* 통계 */}
          <p className="text-xs sm:text-sm text-navy-500">
            대회 {raceCount} · 일상 {casualCount}
            {overseasCount > 0 && ` (해외러닝 ${overseasCount})`}
          </p>
          
          {/* 뱃지 */}
          {hasFullMarathon && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-xs font-bold">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="hidden sm:inline">42.195km Finisher</span>
              <span className="sm:hidden">풀코스 완주</span>
            </div>
          )}
        </div>

        {/* 친구 추가 버튼 */}
        <div className="flex-shrink-0">
          {!isFriend ? (
            <button
              onClick={handleFriendRequest}
              className="px-4 py-2 bg-navy-700 text-white text-sm font-semibold rounded-lg hover:bg-navy-800 transition-colors"
            >
              친구 추가
            </button>
          ) : (
            <button
              className="px-4 py-2 bg-navy-100 text-navy-700 text-sm font-semibold rounded-lg"
              disabled
            >
              친구
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OtherProfile;
