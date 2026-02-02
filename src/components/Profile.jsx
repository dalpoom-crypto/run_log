import { useState } from 'react';
import { updateProfile } from '../config/firebase';
import { auth, storage, ref, uploadBytes, getDownloadURL } from '../config/firebase';
import { compressImage } from '../utils/image';
import { showToast } from '../utils/toast';

const Profile = ({ user, userData, runs }) => {
  const [uploading, setUploading] = useState(false);

  const raceCount = runs.filter(run => run.runType === 'race').length;
  const casualCount = runs.filter(run => run.runType === 'casual').length;
  const overseasCount = runs.filter(run => run.isOverseas).length;
  const hasFullMarathon = runs.some(run => run.raceType === 'FULL');

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, compressed);
      const photoURL = await getDownloadURL(storageRef);
      
      await updateProfile(auth.currentUser, { photoURL });
      showToast('프로필 사진이 변경되었습니다.');
      window.location.reload();
    } catch (error) {
      console.error('사진 업로드 실패:', error);
      showToast('사진 업로드에 실패했습니다.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-start gap-4 sm:gap-8">
        <div className="relative flex-shrink-0">
          <div 
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-navy-100 border-2 border-navy-200 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => document.getElementById('profile-photo-upload').click()}
          >
            {uploading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-navy-700 border-t-transparent"></div>
              </div>
            ) : user.photoURL ? (
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
          <div className="absolute bottom-0 right-0 bg-navy-700 text-white rounded-full p-1 sm:p-1.5 border-2 border-white cursor-pointer hover:bg-navy-800 transition-colors"
            onClick={() => document.getElementById('profile-photo-upload').click()}
          >
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <input
            id="profile-photo-upload"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-navy-900 mb-2 sm:mb-3 truncate">{userData?.nickname || user.displayName}</h2>
          <p className="text-xs sm:text-sm text-navy-500">
            대회 {raceCount} · 일상 {casualCount}
            {overseasCount > 0 && ` (해외러닝 ${overseasCount})`}
          </p>
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
      </div>
    </div>
  );
};

export default Profile;
