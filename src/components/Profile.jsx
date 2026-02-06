import { useState, useEffect } from 'react';
import { updateProfile } from '../config/firebase';
import {
  auth,
  db,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  doc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  Timestamp,
  orderBy,
  limit,
} from '../config/firebase';
import { compressImage } from '../utils/image';
import { showToast } from '../utils/toast';
import { createNotification } from '../utils/notifications';

// 크루 개설 섹션 (내 활동 > 크루 개설 화면 전용)
const CrewCreateSection = ({ user, setMyCrew, setMyCrewRole, setMyActivityCrewView }) => {
  const [name, setName] = useState('');
  const [region, setRegion] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [emblemFile, setEmblemFile] = useState(null);
  const [emblemPreview, setEmblemPreview] = useState(null);

  const handleCreateCrew = async () => {
    if (!user?.uid) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('크루 이름을 입력해 주세요.');
      return;
    }

    const rawTags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const uniqueTags = Array.from(new Set(rawTags)).slice(0, 5);

    setSaving(true);
    try {
      // crews 컬렉션에 크루 생성
      const crewRef = await addDoc(collection(db, 'crews'), {
        name: trimmedName,
        region: region.trim(),
        description: description.trim(),
        tags: uniqueTags,
        ownerId: user.uid,
        createdAt: Timestamp.now(),
        emblemUrl: null,
      });

      let emblemUrl = null;

      // 앰블럼 이미지가 있으면 업로드
      if (emblemFile) {
        try {
          const compressed = await compressImage(emblemFile);
          const emblemRef = ref(storage, `crewEmblems/${crewRef.id}`);
          await uploadBytes(emblemRef, compressed);
          emblemUrl = await getDownloadURL(emblemRef);

          await updateDoc(crewRef, { emblemUrl });
        } catch (error) {
          console.error('크루 앰블럼 업로드 실패:', error);
          showToast('크루 앰블럼 업로드에 실패했습니다. 나중에 다시 시도해 주세요.', 'error');
        }
      }

      // crewMembers 컬렉션에 크루장 멤버십 추가
      await addDoc(collection(db, 'crewMembers'), {
        crewId: crewRef.id,
        userId: user.uid,
        role: 'owner',
        crewOwnerId: user.uid,
        joinedAt: Timestamp.now(),
      });

      // users 문서에 크루 정보 저장
      await updateDoc(doc(db, 'users', user.uid), {
        crewId: crewRef.id,
        crewName: trimmedName,
      });

      // 프론트 상태 갱신
      setMyCrew({
        id: crewRef.id,
        name: trimmedName,
        region: region.trim(),
        description: description.trim(),
        tags: uniqueTags,
        emblemUrl,
      });
      setMyCrewRole('owner');
      setMyActivityCrewView('main');
      showToast('크루를 개설했습니다.');
    } catch (error) {
      console.error('크루 개설 실패:', error);
      showToast('크루 개설에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 크루 앰블럼 업로드 */}
      <div>
        <label className="block text-xs text-navy-600 mb-1">크루 앰블럼 (선택)</label>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-navy-100 flex items-center justify-center overflow-hidden">
            {emblemPreview ? (
              <img src={emblemPreview} alt="크루 앰블럼 미리보기" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs sm:text-sm text-navy-400 text-center px-1">이미지 없음</span>
            )}
          </div>
          <div>
            <label className="inline-flex items-center px-3 py-1.5 bg-navy-700 text-white rounded-lg text-xs sm:text-sm font-semibold cursor-pointer hover:bg-navy-800 transition-colors">
              이미지 선택
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setEmblemFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setEmblemPreview(reader.result);
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            <p className="mt-1 text-[11px] text-navy-500">정사각형 이미지를 권장합니다. (최대 5MB)</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-xs text-navy-600 mb-1">크루 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            placeholder="크루 이름을 입력하세요"
          />
        </div>
        <div>
          <label className="block text-xs text-navy-600 mb-1">지역</label>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            placeholder="예: 서울, 부산, 해외 등"
          />
        </div>
        <div>
          <label className="block text-xs text-navy-600 mb-1">크루 소개</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
            placeholder="크루를 간단히 소개해 주세요."
          />
        </div>
        <div>
          <label className="block text-xs text-navy-600 mb-1">
            태그 (쉼표로 구분, 최대 5개)
          </label>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => {
              const next = e.target.value;
              const commaCount = (next.match(/,/g) || []).length;
              // 쉼표는 최대 4개까지 (태그 5개)
              if (commaCount > 4) {
                showToast('태그는 최대 5개까지만 등록 가능합니다.', 'info');
                return;
              }
              setTagsText(next);
            }}
            className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
            placeholder="예: 새벽런,주말러닝,풀코스"
          />
          <p className="mt-1 text-[11px] text-navy-500">예시: 새벽런, 주말러닝, 풀코스</p>
        </div>
      </div>

      <button
        onClick={handleCreateCrew}
        disabled={saving}
        className="w-full mt-2 px-4 py-2.5 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? '크루 만드는 중...' : '크루 만들기'}
      </button>
    </div>
  );
};

const Profile = ({ user, userData, runs, relationshipData, currentUser, onViewUserProfile }) => {
  const [uploading, setUploading] = useState(false);
  const [showUnfollowSheet, setShowUnfollowSheet] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(null); // { type: 'records' | 'friends' }
  const [showMyActivityModal, setShowMyActivityModal] = useState(false);
  const [showFollowListModal, setShowFollowListModal] = useState(null); // { type: 'followers' | 'following', users: [] }
  const [friendCount, setFriendCount] = useState(0);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followRelationships, setFollowRelationships] = useState({}); // userId -> { iAmFollowing, followingMe, isFriend }

  // 내 활동 - 크루 관련 상태
  const [myActivityTab, setMyActivityTab] = useState('scrap'); // 'scrap' | 'crew'
  const [myActivityCrewView, setMyActivityCrewView] = useState('main'); // main | search | create | manage
  const [myCrew, setMyCrew] = useState(null); // 내가 속한 크루 정보
  const [myCrewRole, setMyCrewRole] = useState(null); // owner | admin | member
  const [myCrewMemberCount, setMyCrewMemberCount] = useState(0);
  const [crewSearchQuery, setCrewSearchQuery] = useState('');
  const [crewSearchResults, setCrewSearchResults] = useState([]);
  const [crewSearchLoading, setCrewSearchLoading] = useState(false);
  const [recommendedCrews, setRecommendedCrews] = useState([]);
  const [crewMemberCounts, setCrewMemberCounts] = useState({}); // crewId -> memberCount
  const [crewActionModal, setCrewActionModal] = useState(null); // { type: 'join', crew }
  const [showCrewNoticeModal, setShowCrewNoticeModal] = useState(false);
  const [showCrewEditModal, setShowCrewEditModal] = useState(false);
  const [showCrewMembersModal, setShowCrewMembersModal] = useState(false);
  const [showCrewDisbandModal, setShowCrewDisbandModal] = useState(false);
  const [showCrewEmblemModal, setShowCrewEmblemModal] = useState(false);
  const [crewNoticeTitle, setCrewNoticeTitle] = useState('');
  const [crewNoticeContent, setCrewNoticeContent] = useState('');
  const [crewEditForm, setCrewEditForm] = useState(null);
  const [crewMembers, setCrewMembers] = useState([]);
  const [crewMembersLoading, setCrewMembersLoading] = useState(false);
  const [crewDisbandNameInput, setCrewDisbandNameInput] = useState('');
  const [emblemChangeFile, setEmblemChangeFile] = useState(null);
  const [emblemChangePreview, setEmblemChangePreview] = useState(null);
  const [myCrewLatestNotice, setMyCrewLatestNotice] = useState(null);
  const [myCrewNotices, setMyCrewNotices] = useState([]);
  const [activeNotice, setActiveNotice] = useState(null);
  const [showNoticeDetailModal, setShowNoticeDetailModal] = useState(false);
  const [showNoticeListModal, setShowNoticeListModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  const [editNoticeTitle, setEditNoticeTitle] = useState('');
  const [editNoticeContent, setEditNoticeContent] = useState('');
  const [showNoticeEditModal, setShowNoticeEditModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm, onCancel }
  const [pendingCrewMemberships, setPendingCrewMemberships] = useState({}); // crewId -> { membershipId, crewId }
  const [scraps, setScraps] = useState([]); // 스크랩된 게시글 목록
  const [scrapsLoading, setScrapsLoading] = useState(false);

  const isOwnProfile = !relationshipData || (currentUser && currentUser.uid === user.uid);

  const raceCount = runs.filter((run) => run.runType === 'race').length;
  const casualCount = runs.filter((run) => run.runType === 'casual').length;
  const overseasCasualCount = runs.filter(
    (run) => run.runType === 'casual' && run.isOverseas,
  ).length;
  const totalCount = runs.length;
  const hasFullMarathon = runs.some(
    (run) =>
      run.raceType === 'FULL' ||
      (run.runType === 'race' && run.distance && run.distance >= 42.195),
  );

  // 내 활동 모달 상단 타이틀
  const getMyActivityTitle = () => {
    if (myActivityTab === 'scrap') return '내 활동';
    if (myActivityTab === 'crew') {
      if (myActivityCrewView === 'search') return '크루 찾기';
      if (myActivityCrewView === 'create') return '크루 개설';
      if (myActivityCrewView === 'manage') return '크루 관리';
      return '내 활동';
    }
    return '내 활동';
  };

  // 내가 속한 크루 정보 불러오기
  useEffect(() => {
    const loadMyCrew = async () => {
      if (!user?.uid) return;
      try {
        if (userData?.crewId) {
          const crewRef = doc(db, 'crews', userData.crewId);
          const crewSnap = await getDoc(crewRef);
          if (crewSnap.exists()) {
            const crewData = { id: crewSnap.id, ...crewSnap.data() };
            setMyCrew(crewData);

            // 멤버 수 및 내 역할 계산
            const membersQuery = query(
              collection(db, 'crewMembers'),
              where('crewId', '==', userData.crewId),
            );
            const membersSnapshot = await getDocs(membersQuery);
            // 승인된 멤버만 카운트
            const approvedMembers = membersSnapshot.docs.filter(
              (m) => !m.data().status || m.data().status === 'approved',
            );
            setMyCrewMemberCount(approvedMembers.length || 0);

            const myMembership = membersSnapshot.docs.find(
              (m) => m.data().userId === user.uid,
            );
            if (myMembership) {
              const membershipData = myMembership.data();
              // 승인된 멤버만 역할 설정
              if (!membershipData.status || membershipData.status === 'approved') {
                setMyCrewRole(membershipData.role || 'member');
              } else {
                setMyCrewRole(null);
              }
            } else {
              setMyCrewRole(null);
            }
          } else {
            setMyCrew(null);
            setMyCrewRole(null);
            setMyCrewMemberCount(0);
          }
        } else {
          setMyCrew(null);
          setMyCrewRole(null);
          setMyCrewMemberCount(0);
        }
      } catch (error) {
        console.error('크루 정보 로드 실패:', error);
      }
    };

    loadMyCrew();
  }, [user?.uid, userData?.crewId]);

  // 크루 검색 화면 진입 시 크루 목록 로드 및 추천 크루 선정
  useEffect(() => {
    const loadCrews = async () => {
      if (myActivityTab !== 'crew') return;
      try {
        const [crewsSnap, membersSnap] = await Promise.all([
          getDocs(collection(db, 'crews')),
          getDocs(collection(db, 'crewMembers')),
        ]);

        const crews = crewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // 크루별 멤버 수 계산 및 가입 신청 상태 확인
        const memberCounts = {};
        const pendingMemberships = {};
        membersSnap.docs.forEach((m) => {
          const data = m.data();
          const cId = data.crewId;
          if (!cId) return;
          // 승인된 멤버만 카운트
          if (!data.status || data.status === 'approved') {
            memberCounts[cId] = (memberCounts[cId] || 0) + 1;
          }
          // 내 가입 신청 상태 확인
          if (data.userId === user?.uid && data.status === 'pending') {
            pendingMemberships[cId] = { membershipId: m.id, crewId: cId };
          }
        });
        setCrewMemberCounts(memberCounts);
        setPendingCrewMemberships(pendingMemberships);

        if (crews.length > 0) {
          const shuffled = [...crews].sort(() => Math.random() - 0.5);
          setRecommendedCrews(shuffled.slice(0, 5));
        } else {
          setRecommendedCrews([]);
        }
      } catch (error) {
        console.error('크루 목록 로드 실패:', error);
      }
    };

    loadCrews();
  }, [myActivityTab]);

  // 내 크루 공지사항 불러오기 (최신 1개 + 전체 목록)
  useEffect(() => {
    const loadLatestNotice = async () => {
      if (!myCrew?.id) {
        setMyCrewLatestNotice(null);
        setMyCrewNotices([]);
        return;
      }
      try {
        const noticesSnap = await getDocs(
          query(collection(db, 'crewNotices'), where('crewId', '==', myCrew.id)),
        );
        const allNotices = noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // createdAt 기준으로 최신순 정렬 (클라이언트에서 정렬하여 인덱스 필요 없음)
        allNotices.sort((a, b) => {
          const ta =
            a.createdAt && typeof a.createdAt.toMillis === 'function'
              ? a.createdAt.toMillis()
              : 0;
          const tb =
            b.createdAt && typeof b.createdAt.toMillis === 'function'
              ? b.createdAt.toMillis()
              : 0;
          return tb - ta;
        });
        setMyCrewNotices(allNotices);
        setMyCrewLatestNotice(allNotices[0] || null);
      } catch (error) {
        console.error('크루 공지사항 로드 실패:', error);
      }
    };

    loadLatestNotice();
  }, [myCrew?.id]);

  // 스크랩 목록 불러오기
  useEffect(() => {
    const loadScraps = async () => {
      if (!user?.uid) {
        setScraps([]);
        return;
      }
      setScrapsLoading(true);
      try {
        const scrapsSnap = await getDocs(
          query(collection(db, 'scraps'), where('userId', '==', user.uid)),
        );
        const scrapsData = scrapsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // createdAt 기준으로 최신순 정렬
        scrapsData.sort((a, b) => {
          const ta =
            a.createdAt && typeof a.createdAt.toMillis === 'function'
              ? a.createdAt.toMillis()
              : 0;
          const tb =
            b.createdAt && typeof b.createdAt.toMillis === 'function'
              ? b.createdAt.toMillis()
              : 0;
          return tb - ta;
        });

        // 관계 상태 확인
        const scrapsWithRelationships = await Promise.all(
          scrapsData.map(async (scrap) => {
            let relationshipLabel = '';
            if (user?.uid && scrap.authorId && scrap.authorId !== user.uid) {
              try {
                const iAmFollowingQuery = query(
                  collection(db, 'follows'),
                  where('followerId', '==', user.uid),
                  where('followingId', '==', scrap.authorId),
                );
                const followingMeQuery = query(
                  collection(db, 'follows'),
                  where('followerId', '==', scrap.authorId),
                  where('followingId', '==', user.uid),
                );
                const friendsQuery1 = query(
                  collection(db, 'friends'),
                  where('userId1', '==', user.uid),
                  where('userId2', '==', scrap.authorId),
                );
                const friendsQuery2 = query(
                  collection(db, 'friends'),
                  where('userId1', '==', scrap.authorId),
                  where('userId2', '==', user.uid),
                );
                const [iAmFollowingSnap, followingMeSnap, friendsSnap1, friendsSnap2] = await Promise.all([
                  getDocs(iAmFollowingQuery),
                  getDocs(followingMeQuery),
                  getDocs(friendsQuery1),
                  getDocs(friendsQuery2),
                ]);
                const iAmFollowing = !iAmFollowingSnap.empty;
                const followingMe = !followingMeSnap.empty;
                const isFriend = !friendsSnap1.empty || !friendsSnap2.empty;

                if (isFriend || (iAmFollowing && followingMe)) {
                  relationshipLabel = '러닝 버디';
                } else if (iAmFollowing) {
                  relationshipLabel = '팔로잉 중';
                }
              } catch (error) {
                console.error('관계 확인 실패:', error);
              }
            }
            return { ...scrap, relationshipLabel };
          }),
        );

        setScraps(scrapsWithRelationships);
      } catch (error) {
        console.error('스크랩 목록 로드 실패:', error);
      } finally {
        setScrapsLoading(false);
      }
    };

    loadScraps();
  }, [user?.uid, showMyActivityModal]);

  // 크루 가입 확정 처리
  const handleConfirmJoinCrew = async () => {
    if (!user?.uid || !crewActionModal?.crew) return;
    try {
      const docRef = await addDoc(collection(db, 'crewMembers'), {
        crewId: crewActionModal.crew.id,
        userId: user.uid,
        role: 'member',
        crewOwnerId: crewActionModal.crew.ownerId || null,
        status: 'pending', // 가입 신청 상태
        joinedAt: Timestamp.now(),
      });

      setCrewActionModal(null);
      setMyActivityCrewView('main');
      // 가입 신청 상태 업데이트
      setPendingCrewMemberships((prev) => ({
        ...prev,
        [crewActionModal.crew.id]: { membershipId: docRef.id, crewId: crewActionModal.crew.id },
      }));
      showToast('크루 가입 신청을 완료했습니다. 승인 대기 중입니다.');
    } catch (error) {
      console.error('크루 가입 실패:', error);
      showToast('크루 가입에 실패했습니다.', 'error');
    }
  };

  // 러닝메이트 수 계산 (친구 + 맞팔로우)
  useEffect(() => {
    const loadFriendCount = async () => {
      if (!user?.uid) return;
      try {
        // 친구 관계
        const friendsQuery1 = query(collection(db, 'friends'), where('userId1', '==', user.uid));
        const friendsQuery2 = query(collection(db, 'friends'), where('userId2', '==', user.uid));
        const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
          getDocs(friendsQuery1),
          getDocs(friendsQuery2),
        ]);
        const friendIds = new Set();
        friendsSnapshot1.docs.forEach((d) => friendIds.add(d.data().userId2));
        friendsSnapshot2.docs.forEach((d) => friendIds.add(d.data().userId1));

        // 맞팔로우
        const myFollowingQuery = query(
          collection(db, 'follows'),
          where('followerId', '==', user.uid),
        );
        const myFollowingSnapshot = await getDocs(myFollowingQuery);
        const followingIds = myFollowingSnapshot.docs.map((d) => d.data().followingId);

        const myFollowersQuery = query(
          collection(db, 'follows'),
          where('followingId', '==', user.uid),
        );
        const myFollowersSnapshot = await getDocs(myFollowersQuery);
        const followerIds = myFollowersSnapshot.docs.map((d) => d.data().followerId);

        const mutualFollowIds = followingIds.filter((id) => followerIds.includes(id));
        mutualFollowIds.forEach((id) => friendIds.add(id));

        setFriendCount(friendIds.size);
      } catch (error) {
        console.error('러닝메이트 수 계산 실패:', error);
      }
    };

    loadFriendCount();
  }, [user?.uid]);

  // 팔로워/팔로잉 수 및 목록
  useEffect(() => {
    const loadFollowCounts = async () => {
      if (!user?.uid) return;
      try {
        const followersQuery = query(
          collection(db, 'follows'),
          where('followingId', '==', user.uid),
        );
        const followingQuery = query(
          collection(db, 'follows'),
          where('followerId', '==', user.uid),
        );
        const [followersSnapshot, followingSnapshot] = await Promise.all([
          getDocs(followersQuery),
          getDocs(followingQuery),
        ]);

        const followers = followersSnapshot.docs.map((d) => d.data().followerId);
        const following = followingSnapshot.docs.map((d) => d.data().followingId);

        setFollowCounts({ followers: followers.length, following: following.length });

        const followersData = await Promise.all(
          followers.map(async (userId) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                return { id: userId, ...userDoc.data() };
              }
            } catch (error) {
              console.error(`사용자 정보 로드 실패: ${userId}`, error);
            }
            return null;
          }),
        );

        const followingData = await Promise.all(
          following.map(async (userId) => {
            try {
              const userDoc = await getDoc(doc(db, 'users', userId));
              if (userDoc.exists()) {
                return { id: userId, ...userDoc.data() };
              }
            } catch (error) {
              console.error(`사용자 정보 로드 실패: ${userId}`, error);
            }
            return null;
          }),
        );

        setFollowersList(followersData.filter((u) => u !== null));
        setFollowingList(followingData.filter((u) => u !== null));

        const allUserIds = [...new Set([...followers, ...following])];
        const relationships = {};

        await Promise.all(
          allUserIds.map(async (targetUserId) => {
            try {
              const iAmFollowingQuery = query(
                collection(db, 'follows'),
                where('followerId', '==', user.uid),
                where('followingId', '==', targetUserId),
              );
              const iAmFollowingSnapshot = await getDocs(iAmFollowingQuery);
              const iAmFollowing = !iAmFollowingSnapshot.empty;

              const followingMeQuery = query(
                collection(db, 'follows'),
                where('followerId', '==', targetUserId),
                where('followingId', '==', user.uid),
              );
              const followingMeSnapshot = await getDocs(followingMeQuery);
              const followingMe = !followingMeSnapshot.empty;

              const friendsQuery1 = query(
                collection(db, 'friends'),
                where('userId1', '==', user.uid),
                where('userId2', '==', targetUserId),
              );
              const friendsQuery2 = query(
                collection(db, 'friends'),
                where('userId1', '==', targetUserId),
                where('userId2', '==', user.uid),
              );
              const [friendsSnapshot1, friendsSnapshot2] = await Promise.all([
                getDocs(friendsQuery1),
                getDocs(friendsQuery2),
              ]);
              const isFriend = !friendsSnapshot1.empty || !friendsSnapshot2.empty;

              relationships[targetUserId] = { iAmFollowing, followingMe, isFriend };
            } catch (error) {
              console.error(`관계 상태 계산 실패: ${targetUserId}`, error);
            }
          }),
        );

        setFollowRelationships(relationships);
      } catch (error) {
        console.error('팔로우 수 계산 실패:', error);
      }
    };

    loadFollowCounts();
  }, [user?.uid]);

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
      await updateDoc(doc(db, 'users', user.uid), { photoURL });
      
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
      <div className="flex items-start sm:items-center gap-4 sm:gap-8">
        {/* 프로필 사진 */}
        <div className="relative flex-shrink-0">
          <div 
            className={`w-24 h-24 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden bg-navy-100 border-2 border-navy-200 ${
              isOwnProfile ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            onClick={() => {
              if (isOwnProfile) {
                const input = document.getElementById('profile-photo-upload');
                if (input) input.click();
              }
            }}
          >
            {uploading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-navy-700 border-t-transparent" />
              </div>
            ) : user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-navy-100">
                <span className="text-3xl sm:text-4xl text-navy-400 font-bold">?</span>
              </div>
            )}
          </div>
          {isOwnProfile && (
            <>
              <div
                className="absolute bottom-0 right-0 bg-navy-700 text-white rounded-full p-1 sm:p-1.5 border-2 border-white cursor-pointer hover:bg-navy-800 transition-colors"
                onClick={() => {
                  const input = document.getElementById('profile-photo-upload');
                  if (input) input.click();
                }}
              >
                <svg
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <input
                id="profile-photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="hidden"
              />
            </>
          )}
        </div>

        {/* 프로필 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-6">
            <div className="flex-1 min-w-0 ml-2 sm:ml-0">
              <h2 className="text-lg sm:text-xl font-bold text-navy-900 truncate mb-2">
                {userData?.nickname || user.displayName}
              </h2>

              {/* 닉네임 아래: 크루명 / 소속 크루없음 */}
              <div className="mb-2">
                {userData?.crewName ? (
                  <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-navy-600 bg-purple-100 text-purple-700 px-2 sm:px-3 py-1 rounded-full font-semibold">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    {userData.crewName}
                  </span>
                ) : (
                  <span className="text-xs sm:text-sm text-navy-400">소속 크루없음</span>
                )}
              </div>

              {/* 42.195km Finisher 뱃지 */}
              {hasFullMarathon && (
                <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-xs font-bold">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>42.195km Finisher</span>
                </div>
              )}
            </div>

            {/* 기록 / 러닝 버디 + 관계 상태 / 내 활동 버튼 (데스크탑/태블릿 전용) */}
            <div className="hidden sm:flex items-center justify-between w-full sm:w-auto gap-8 flex-shrink-0 mt-3 sm:mt-0 sm:self-center">
              <>
                {/* 데스크탑: 숫자 위, 라벨 아래 세로 배치 */}
                <div className="flex items-center gap-8">
                  <button
                    onClick={() => {
                      if (isOwnProfile) {
                        setShowStatsModal({ type: 'records' });
                      }
                    }}
                    className={`flex flex-col items-center transition-opacity min-w-[80px] ${
                      isOwnProfile ? 'hover:opacity-80 cursor-pointer' : 'opacity-80 cursor-default'
                    }`}
                  >
                    <span className="text-xl font-bold text-navy-900">
                      {totalCount >= 10000
                        ? `${(totalCount / 1000).toFixed(1)}k`
                        : totalCount.toLocaleString()}
                    </span>
                    <span className="text-xs text-navy-600 font-semibold mt-0.5">기록</span>
                  </button>

                  <button
                    onClick={() => {
                      if (isOwnProfile) {
                        setShowFollowListModal({ type: 'followers', users: followersList });
                      }
                    }}
                    className={`flex flex-col items-center transition-opacity min-w-[80px] ${
                      isOwnProfile ? 'hover:opacity-80 cursor-pointer' : 'opacity-80 cursor-default'
                    }`}
                  >
                    <span className="text-xl font-bold text-navy-900">
                      {friendCount >= 10000
                        ? `${(friendCount / 1000).toFixed(1)}k`
                        : friendCount.toLocaleString()}
                    </span>
                    <span className="text-xs text-navy-600 font-semibold mt-0.5">러닝 버디</span>
                  </button>
                </div>

                {isOwnProfile ? (
                  <button
                    onClick={() => setShowMyActivityModal(true)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-navy-700 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors whitespace-nowrap"
                  >
                    내 활동
                  </button>
                ) : (
                  relationshipData &&
                  currentUser &&
                  currentUser.uid !== user.uid && (
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* 나를 일방적으로 팔로우: 맞팔로우 버튼 (UI만) */}
                      {relationshipData.followingMe && !relationshipData.iAmFollowing && (
                        <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-700 text-white text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap">
                          맞팔로우
                        </div>
                      )}
                      {/* 내가 팔로잉 중이면 상태 표시 */}
                      {relationshipData.iAmFollowing && (
                        <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-navy-100 text-navy-700 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap">
                          {relationshipData.followingMe ? '러닝 버디' : '팔로잉 중'}
                        </div>
                      )}
                    </div>
                  )
                )}
              </>
            </div>
          </div>
        </div>
      </div>

      {/* 모바일 전용: 기록 / 러닝 버디 / 내 활동 (프로필 사진 왼쪽 끝선과 동일한 카드 패딩 기준) */}
      {(
        // 내 프로필이거나, 타인 프로필이지만 기본 통계는 보여주기
        isOwnProfile || (!isOwnProfile && !!relationshipData)
      ) && (
        <div className="mt-3 flex items-center justify-between sm:hidden">
          <div className="flex items-baseline gap-4">
            <button
              onClick={() => {
                if (isOwnProfile) {
                  setShowStatsModal({ type: 'records' });
                }
              }}
              className={`flex items-baseline gap-1 transition-opacity ${
                isOwnProfile ? 'hover:opacity-80 cursor-pointer' : 'opacity-80 cursor-default'
              }`}
            >
              <span className="text-[11px] text-navy-600 font-semibold">기록</span>
              <span className="text-sm font-bold text-navy-900">
                {totalCount >= 10000
                  ? `${(totalCount / 1000).toFixed(1)}k`
                  : totalCount.toLocaleString()}
              </span>
            </button>

            <button
              onClick={() => {
                if (isOwnProfile) {
                  setShowFollowListModal({ type: 'followers', users: followersList });
                }
              }}
              className={`flex items-baseline gap-1 transition-opacity ${
                isOwnProfile ? 'hover:opacity-80 cursor-pointer' : 'opacity-80 cursor-default'
              }`}
            >
              <span className="text-[11px] text-navy-600 font-semibold">러닝 버디</span>
              <span className="text-sm font-bold text-navy-900">
                {friendCount >= 10000
                  ? `${(friendCount / 1000).toFixed(1)}k`
                  : friendCount.toLocaleString()}
              </span>
            </button>
          </div>

          {isOwnProfile && (
            <button
              onClick={() => setShowMyActivityModal(true)}
              className="px-3 py-1.5 bg-navy-700 text-white text-xs font-semibold rounded-lg hover:bg-navy-800 active:bg-navy-900 transition-colors whitespace-nowrap"
            >
              내 활동
            </button>
          )}
        </div>
      )}

      {/* 팔로우 해제 모달 */}
      {showUnfollowSheet && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowUnfollowSheet(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 text-center mb-2">
              팔로우 해제
            </h3>
            <p className="text-sm sm:text-base text-navy-600 text-center mb-6">
              {userData?.nickname || user.displayName || '이 사용자'}님의 게시글을 더 이상 볼 수
              없습니다.
            </p>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  try {
                    const followDocId = `${currentUser.uid}_${user.uid}`;
                    await deleteDoc(doc(db, 'follows', followDocId));
                    showToast('팔로우를 해제했습니다.');
                    setShowUnfollowSheet(false);
                    setTimeout(() => window.location.reload(), 500);
                  } catch (error) {
                    console.error('팔로우 해제 실패:', error);
                    showToast('팔로우 해제에 실패했습니다.', 'error');
                  }
                }}
                className="w-full bg-red-500 text-white py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base hover:bg-red-600 active:bg-red-700 transition-colors"
              >
                팔로우 해제
              </button>
              <button
                onClick={() => setShowUnfollowSheet(false)}
                className="w-full bg-navy-100 text-navy-700 py-3 sm:py-4 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 공지사항 상세 모달 */}
      {showNoticeDetailModal && activeNotice && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowNoticeDetailModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg sm:text-xl font-bold text-navy-900">공지사항</h3>
              <button
                onClick={() => setShowNoticeDetailModal(false)}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
    </div>
            <p className="text-xs text-navy-500 mb-1">
              {activeNotice.authorNickname || '작성자'} ·{' '}
              {activeNotice.createdAt?.toDate
                ? activeNotice.createdAt.toDate().toLocaleString('ko-KR')
                : ''}
            </p>
            <h4 className="text-base sm:text-lg font-semibold text-navy-900 mb-2">
              {activeNotice.title}
            </h4>
            <p className="text-sm text-navy-800 whitespace-pre-line mb-4">
              {activeNotice.content}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  // 상세보기 모달에서 목록 화면으로 전환
                  setShowNoticeDetailModal(false);
                  setShowNoticeListModal(true);
                }}
                className="w-full bg-navy-100 text-navy-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-navy-200 transition-colors"
              >
                목록 보기
              </button>
              {user?.uid === activeNotice.authorId && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNotice(activeNotice);
                      setEditNoticeTitle(activeNotice.title);
                      setEditNoticeContent(activeNotice.content);
                      setShowNoticeEditModal(true);
                    }}
                    className="flex-1 bg-navy-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal({
                        message: '이 공지사항을 삭제하시겠습니까?',
                        onConfirm: async () => {
                          try {
                            await deleteDoc(doc(db, 'crewNotices', activeNotice.id));
                            setMyCrewNotices((prev) =>
                              prev.filter((notice) => notice.id !== activeNotice.id),
                            );
                            setMyCrewLatestNotice((prev) =>
                              prev && prev.id === activeNotice.id
                                ? myCrewNotices[1] || null
                                : prev,
                            );
                            setShowNoticeDetailModal(false);
                            showToast('공지사항을 삭제했습니다.');
                            setConfirmModal(null);
                          } catch (error) {
                            console.error('공지사항 삭제 실패:', error);
                            showToast('공지사항 삭제에 실패했습니다.', 'error');
                            setConfirmModal(null);
                          }
                        },
                        onCancel: () => setConfirmModal(null),
                      });
                    }}
                    className="flex-1 bg-red-100 text-red-700 py-2.5 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 크루 공지사항 목록 모달 */}
      {showNoticeListModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowNoticeListModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-navy-200">
              <h3 className="text-lg font-bold text-navy-900">공지사항 목록</h3>
              <button
                onClick={() => setShowNoticeListModal(false)}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {myCrewNotices.length === 0 ? (
                <div className="text-sm text-navy-500 text-center py-6">
                  등록된 공지사항이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {myCrewNotices.map((notice) => (
                    <button
                      key={notice.id}
                      type="button"
                      onClick={() => {
                        // 목록에서 다른 공지 선택 시 그 공지 상세보기로 이동
                        setActiveNotice(notice);
                        setShowNoticeListModal(false);
                        setShowNoticeDetailModal(true);
                      }}
                      className="w-full text-left p-3 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
                    >
                      <p className="text-sm font-semibold text-navy-900 truncate">
                        {notice.title}
                      </p>
                      <p className="text-[11px] text-navy-500 mt-0.5">
                        {notice.authorNickname || '작성자'} ·{' '}
                        {notice.createdAt?.toDate
                          ? notice.createdAt.toDate().toLocaleString('ko-KR')
                          : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 크루 공지사항 수정 모달 */}
      {showNoticeEditModal && editingNotice && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowNoticeEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-3 text-center">
              공지사항 수정
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-navy-600 mb-1">제목</label>
                <input
                  type="text"
                  value={editNoticeTitle}
                  onChange={(e) => setEditNoticeTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">내용</label>
                <textarea
                  rows={4}
                  value={editNoticeContent}
                  onChange={(e) => setEditNoticeContent(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
                />
              </div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!user?.uid || !editingNotice?.id) return;
                    const title = editNoticeTitle.trim();
                    const content = editNoticeContent.trim();
                    if (!title || !content) {
                      showToast('제목과 내용을 모두 입력해 주세요.', 'info');
                      return;
                    }
                    try {
                      await updateDoc(doc(db, 'crewNotices', editingNotice.id), {
                        title,
                        content,
                      });

                      setMyCrewNotices((prev) =>
                        prev.map((n) =>
                          n.id === editingNotice.id ? { ...n, title, content } : n,
                        ),
                      );
                      setMyCrewLatestNotice((prev) =>
                        prev && prev.id === editingNotice.id ? { ...prev, title, content } : prev,
                      );

                      setActiveNotice((prev) =>
                        prev && prev.id === editingNotice.id ? { ...prev, title, content } : prev,
                      );

                      showToast('공지사항을 수정했습니다.');
                      setShowNoticeEditModal(false);
                    } catch (error) {
                      console.error('공지사항 수정 실패:', error);
                      showToast('공지사항 수정에 실패했습니다.', 'error');
                    }
                  }}
                  className="w-full bg-navy-700 text-white py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-800 active:bg-navy-900 transition-colors"
                >
                  저장하기
                </button>
                <button
                  type="button"
                  onClick={() => setShowNoticeEditModal(false)}
                  className="w-full bg-navy-100 text-navy-700 py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 기록/러닝 버디 상세 모달 */}
      {showStatsModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowStatsModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-navy-900">
                {showStatsModal.type === 'records' ? '기록' : '러닝 버디'}
              </h3>
              <button
                onClick={() => setShowStatsModal(null)}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {showStatsModal.type === 'records' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded-lg">
                  <span className="text-sm font-semibold text-navy-700">대회</span>
                  <span className="text-sm text-navy-900">{raceCount}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded-lg">
                  <span className="text-sm font-semibold text-navy-700">
                    일상 {overseasCasualCount > 0 && `(해외 ${overseasCasualCount})`}
                  </span>
                  <span className="text-sm text-navy-900">{casualCount}</span>
                </div>
              </div>
            )}

            {showStatsModal.type === 'friends' && (
              <div className="space-y-3">
                <button
                  onClick={() => setShowFollowListModal({ type: 'followers', users: followersList })}
                  className="w-full flex justify-between items-center p-3 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-navy-700">팔로워</span>
                  <span className="text-sm text-navy-900">{followCounts.followers}</span>
                </button>
                <button
                  onClick={() => setShowFollowListModal({ type: 'following', users: followingList })}
                  className="w-full flex justify-between items-center p-3 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
                >
                  <span className="text-sm font-semibold text-navy-700">팔로잉</span>
                  <span className="text-sm text-navy-900">{followCounts.following}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 내 활동 모달 - 스크랩 / 크루 탭 포함 */}
      {showMyActivityModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40"
          onClick={() => {
            setShowMyActivityModal(false);
            setMyActivityCrewView('main');
            setMyActivityTab('scrap');
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-navy-200">
              <div className="flex items-center gap-2">
                {myActivityCrewView !== 'main' && myActivityTab === 'crew' && (
                  <button
                    onClick={() => setMyActivityCrewView('main')}
                    className="p-1.5 rounded-full bg-navy-50 text-navy-600 hover:bg-navy-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}
                <h3 className="text-base sm:text-lg font-bold text-navy-900">
                  {getMyActivityTitle()}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowMyActivityModal(false);
                  setMyActivityCrewView('main');
                  setMyActivityTab('scrap');
                }}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 탭: 스크랩 / 크루 (메인 화면에서만 표시) - 내 피드 필터 버튼 스타일과 유사하게 */}
            {myActivityCrewView === 'main' && (
              <div className="px-4 sm:px-5 pt-2 pb-1 bg-navy-25">
                <div className="flex gap-2 bg-navy-100 rounded-xl p-1">
                  <button
                    onClick={() => setMyActivityTab('scrap')}
                    className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg ${
                      myActivityTab === 'scrap'
                        ? 'bg-white text-navy-900 shadow-sm'
                        : 'bg-transparent text-navy-500'
                    }`}
                  >
                    스크랩
                  </button>
                  <button
                    onClick={() => setMyActivityTab('crew')}
                    className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg ${
                      myActivityTab === 'crew'
                        ? 'bg-white text-navy-900 shadow-sm'
                        : 'bg-transparent text-navy-500'
                    }`}
                  >
                    크루
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {/* 스크랩 탭 */}
              {myActivityTab === 'scrap' && (
                <div>
                  {scrapsLoading ? (
                    <div className="text-sm text-navy-500 text-center py-8">불러오는 중...</div>
                  ) : scraps.length === 0 ? (
                    <div className="text-sm text-navy-500 text-center py-8">
                      스크랩한 게시글이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scraps.map((scrap) => {
                        const runData = scrap.runData || {};
                        const photos = runData.photos || [];
                        const firstPhoto = photos[0] || null;
                        const memo = runData.memo || '';
                        const memoLines = memo.split('\n').filter(Boolean);
                        const displayMemo = memoLines.slice(0, 2).join(' ');
                        const hasMoreMemo = memoLines.length > 2 || memo.length > 100;

                        // 작성일시 포맷팅
                        let createdAtStr = '';
                        if (runData.createdAt) {
                          let date = null;
                          if (runData.createdAt && typeof runData.createdAt.toDate === 'function') {
                            date = runData.createdAt.toDate();
                          } else if (runData.createdAt instanceof Timestamp) {
                            date = runData.createdAt.toDate();
                          } else if (runData.createdAt.seconds) {
                            date = new Date(runData.createdAt.seconds * 1000);
                          } else if (runData.createdAt._seconds) {
                            date = new Date(runData.createdAt._seconds * 1000);
                          }
                          if (date && !isNaN(date.getTime())) {
                            createdAtStr = date.toLocaleString('ko-KR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            });
                          }
                        }

                        return (
                          <div
                            key={scrap.id}
                            className="p-3 bg-navy-50 rounded-xl border border-navy-100 flex gap-3 hover:bg-navy-100 transition-colors cursor-pointer"
                            onClick={() => {
                              if (onViewUserProfile && scrap.authorId) {
                                onViewUserProfile(scrap.authorId);
                              }
                            }}
                          >
                            {/* 사진 */}
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-navy-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              {firstPhoto ? (
                                <img
                                  src={firstPhoto}
                                  alt="게시글 사진"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-2xl text-navy-400">🏃</span>
                              )}
                            </div>

                            {/* 내용 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-navy-900 truncate">
                                  {scrap.authorNickname || '익명'}
                                </span>
                                {scrap.relationshipLabel && (
                                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-semibold whitespace-nowrap">
                                    {scrap.relationshipLabel}
                                  </span>
                                )}
                              </div>
                              {createdAtStr && (
                                <p className="text-[11px] text-navy-500 mb-1.5">{createdAtStr}</p>
                              )}
                              {displayMemo && (
                                <p className="text-xs sm:text-sm text-navy-700 line-clamp-2">
                                  {displayMemo}
                                  {hasMoreMemo && '...'}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 크루 탭 */}
              {myActivityTab === 'crew' && (
                <div>
                  {/* 크루 메인 화면: 내가 속한 크루 + 검색/개설 + 리스트 */}
                  {myActivityCrewView === 'main' && (
                    <>
                    <div className="space-y-4">
                      {/* 내가 속한 크루 */}
                      {myCrew ? (
                        <div className="p-3 sm:p-4 bg-navy-50 rounded-xl border border-navy-100 space-y-3">
                          <div className="flex items-start gap-3">
                            {/* 크루 앰블럼 */}
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-navy-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                              {myCrew.emblemUrl ? (
                                <img
                                  src={myCrew.emblemUrl}
                                  alt={myCrew.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-lg sm:text-xl font-bold text-navy-700">
                                  {myCrew.name?.[0] || 'C'}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm sm:text-base font-semibold text-navy-900 truncate">
                                    {myCrew.name || myCrew.crewName}
                                  </p>
                                  {myCrew.region && (
                                    <p className="text-xs sm:text-sm text-navy-600 mt-0.5">
                                      {myCrew.region}
                                    </p>
                                  )}
                                  <p className="text-xs text-navy-500 mt-0.5">
                                    인원 {myCrewMemberCount.toLocaleString()}명
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  {myCrewRole === 'owner' && (
                                    <>
                                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold">
                                        크루장
                                      </span>
                                      <button
                                        onClick={() => setMyActivityCrewView('manage')}
                                        className="px-3 py-1.5 bg-navy-700 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-navy-800 transition-colors"
                                      >
                                        크루 관리
                                      </button>
                                    </>
                                  )}
                                  {myCrewRole !== 'owner' && myCrew && (
                                    <button
                                      onClick={() => {
                                        setConfirmModal({
                                          message: '크루에서 탈퇴하시겠습니까?',
                                          onConfirm: async () => {
                                            if (!user?.uid || !myCrew?.id) {
                                              setConfirmModal(null);
                                              return;
                                            }
                                            try {
                                              // 내 멤버십 찾기
                                              const membersQuery = query(
                                                collection(db, 'crewMembers'),
                                                where('crewId', '==', myCrew.id),
                                                where('userId', '==', user.uid),
                                              );
                                              const membersSnapshot = await getDocs(membersQuery);
                                              
                                              if (!membersSnapshot.empty) {
                                                const myMembership = membersSnapshot.docs[0];
                                                await deleteDoc(myMembership.ref);
                                              }

                                              // 사용자 정보에서 크루 정보 제거
                                              await updateDoc(doc(db, 'users', user.uid), {
                                                crewId: null,
                                                crewName: null,
                                              });

                                              // 상태 업데이트
                                              setMyCrew(null);
                                              setMyCrewRole(null);
                                              setMyCrewMemberCount(0);
                                              setMyCrewNotices([]);
                                              setMyCrewLatestNotice(null);

                                              showToast('크루에서 탈퇴했습니다.');
                                              setConfirmModal(null);
                                            } catch (error) {
                                              console.error('크루 탈퇴 실패:', error);
                                              showToast('크루 탈퇴에 실패했습니다.', 'error');
                                              setConfirmModal(null);
                                            }
                                          },
                                          onCancel: () => setConfirmModal(null),
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs sm:text-sm font-semibold rounded-lg hover:bg-red-200 transition-colors"
                                    >
                                      크루 탈퇴
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {myCrew.description && (
                            <p className="text-xs sm:text-sm text-navy-700">{myCrew.description}</p>
                          )}
                          {Array.isArray(myCrew.tags) && myCrew.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {myCrew.tags.map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-navy-100 text-navy-700"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="pt-2 border-t border-navy-100">
                            {(() => {
                              // 일주일 이내 공지사항만 필터링 (최대 3개)
                              const oneWeekAgo = new Date();
                              oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                              const recentNotices = myCrewNotices
                                .filter((notice) => {
                                  if (!notice.createdAt) return false;
                                  const noticeDate = notice.createdAt.toDate
                                    ? notice.createdAt.toDate()
                                    : new Date(notice.createdAt);
                                  return noticeDate >= oneWeekAgo;
                                })
                                .slice(0, 3);

                              if (recentNotices.length === 0) {
                                return (
                                  <p className="text-[11px] sm:text-xs text-navy-500">
                                    곧 다가올 행사 및 공지가 이곳에 표시됩니다.
                                  </p>
                                );
                              }

                              return (
                                <div className="space-y-1.5">
                                  {recentNotices.map((notice) => {
                                    const noticeDate = notice.createdAt?.toDate
                                      ? notice.createdAt.toDate()
                                      : notice.createdAt
                                      ? new Date(notice.createdAt)
                                      : null;
                                    const dateTimeStr = noticeDate
                                      ? noticeDate.toLocaleString('ko-KR', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : '';
                                    return (
                                      <button
                                        key={notice.id}
                                        type="button"
                                        onClick={() => {
                                          setActiveNotice(notice);
                                          setShowNoticeDetailModal(true);
                                        }}
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-navy-50 hover:bg-navy-100 border border-navy-200 transition-colors flex items-center gap-2"
                                      >
                                        <span className="text-[11px] sm:text-xs text-navy-700 truncate flex-1 min-w-0 text-left">
                                          {notice.title}
                                        </span>
                                        <span className="text-[10px] text-navy-500 whitespace-nowrap flex-shrink-0">
                                          {dateTimeStr}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : null}

                      {/* 크루 검색 + 개설 버튼 (소속된 크루가 없을 때만 표시) */}
                      {!myCrew && (
                        <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={crewSearchQuery}
                            onChange={(e) => setCrewSearchQuery(e.target.value)}
                            placeholder="크루명, 지역, 태그로 검색"
                            className="flex-1 px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                          />
                          <button
                            onClick={async () => {
                              if (!crewSearchQuery.trim()) return;
                              setCrewSearchLoading(true);
                              try {
                                const crewsSnap = await getDocs(collection(db, 'crews'));
                                const qLower = crewSearchQuery.trim().toLowerCase();
                                const results = crewsSnap.docs
                                  .map((d) => ({ id: d.id, ...d.data() }))
                                  .filter((crew) => {
                                    const name = (crew.name || '').toLowerCase();
                                    const region = (crew.region || '').toLowerCase();
                                    const desc = (crew.description || '').toLowerCase();
                                    const tags = Array.isArray(crew.tags)
                                      ? crew.tags.join(',').toLowerCase()
                                      : '';
                                    return (
                                      name.includes(qLower) ||
                                      region.includes(qLower) ||
                                      desc.includes(qLower) ||
                                      tags.includes(qLower)
                                    );
                                  });
                                setCrewSearchResults(results);
                              } catch (error) {
                                console.error('크루 검색 실패:', error);
                                showToast('크루 검색에 실패했습니다.', 'error');
                              } finally {
                                setCrewSearchLoading(false);
                              }
                            }}
                            className="px-3 py-2 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors"
                          >
                            검색
                          </button>
                        </div>

                        {/* 크루 개설 버튼 */}
                        <button
                          onClick={() => setMyActivityCrewView('create')}
                          className="w-full px-4 py-2 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors"
                        >
                          크루 개설
                        </button>
                      </div>
                      )}

                      {/* 검색/추천 리스트 (소속된 크루가 없을 때만 표시) */}
                      {!myCrew && (
                        <div className="max-h-64 overflow-y-auto space-y-3">
                        {crewSearchLoading && (
                          <div className="text-sm text-navy-500 text-center py-4">
                            검색 중입니다...
                          </div>
                        )}
                        {!crewSearchLoading &&
                          crewSearchQuery &&
                          crewSearchResults.length === 0 && (
                            <div className="text-sm text-navy-500 text-center py-4">
                              검색 결과가 없습니다.
                            </div>
                          )}

                        {/* 검색어 없을 때: 추천 크루 */}
                        {!crewSearchLoading &&
                          !crewSearchQuery &&
                          recommendedCrews.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs text-navy-500 mb-1">추천 크루</p>
                              {recommendedCrews.map((crew) => {
                                const isMyCrew = myCrew && myCrew.id === crew.id;
                                const isOwner = crew.ownerId === user?.uid;
                                const memberCount =
                                  typeof crewMemberCounts[crew.id] === 'number'
                                    ? crewMemberCounts[crew.id]
                                    : 0;
                                return (
                                  <div
                                    key={crew.id}
                                    className="p-3 bg-navy-50 rounded-xl border border-navy-100 space-y-2"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="w-10 h-10 rounded-2xl bg-navy-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                        {crew.emblemUrl ? (
                                          <img
                                            src={crew.emblemUrl}
                                            alt={crew.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <span className="text-sm font-bold text-navy-700">
                                            {crew.name?.[0] || 'C'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-navy-900 truncate">
                                              {crew.name}
                                            </p>
                                            {crew.region && (
                                              <p className="text-xs text-navy-600 mt-0.5">
                                                {crew.region}
                                              </p>
                                            )}
                                          </div>
                                          {isOwner && (
                                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold">
                                              내가 개설
                                            </span>
                                          )}
                                        </div>
                                        {crew.description && (
                                          <p className="mt-1 text-xs text-navy-700 line-clamp-2">
                                            {crew.description}
                                          </p>
                                        )}
                                        {Array.isArray(crew.tags) && crew.tags.length > 0 && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            {crew.tags.map((tag, idx) => (
                                              <span
                                                key={idx}
                                                className="text-[10px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-700"
                                              >
                                                #{tag}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                        <div className="flex justify-between items-center mt-2">
                                          <span className="text-[11px] text-navy-500">
                                            인원 {memberCount.toLocaleString()}명
                                          </span>
                                          {isMyCrew || isOwner ? (
                                            <span className="text-[11px] text-navy-600 font-semibold">
                                              내 크루
                                            </span>
                                          ) : pendingCrewMemberships[crew.id] ? (
                                            <button
                                              onClick={async () => {
                                                const membership = pendingCrewMemberships[crew.id];
                                                if (!membership?.membershipId) return;
                                                try {
                                                  await deleteDoc(doc(db, 'crewMembers', membership.membershipId));
                                                  setPendingCrewMemberships((prev) => {
                                                    const next = { ...prev };
                                                    delete next[crew.id];
                                                    return next;
                                                  });
                                                  showToast('가입 신청을 취소했습니다.');
                                                } catch (error) {
                                                  console.error('가입 신청 취소 실패:', error);
                                                  showToast('가입 신청 취소에 실패했습니다.', 'error');
                                                }
                                              }}
                                              className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                                            >
                                              가입 취소하기
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => setCrewActionModal({ type: 'join', crew })}
                                              className="px-3 py-1.5 bg-navy-700 text-white text-xs font-semibold rounded-lg hover:bg-navy-800 transition-colors"
                                            >
                                              가입하기
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        {/* 검색 결과 목록 */}
                        {crewSearchQuery &&
                          crewSearchResults.map((crew) => {
                            const isMyCrew = myCrew && myCrew.id === crew.id;
                            const isOwner = crew.ownerId === user?.uid;
                            const memberCount =
                              typeof crewMemberCounts[crew.id] === 'number'
                                ? crewMemberCounts[crew.id]
                                : 0;
                            return (
                              <div
                                key={crew.id}
                                className="p-3 bg-navy-50 rounded-xl border border-navy-100 space-y-2"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-navy-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                    {crew.emblemUrl ? (
                                      <img
                                        src={crew.emblemUrl}
                                        alt={crew.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-sm font-bold text-navy-700">
                                        {crew.name?.[0] || 'C'}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-navy-900 truncate">
                                          {crew.name}
                                        </p>
                                        {crew.region && (
                                          <p className="text-xs text-navy-600 mt-0.5">
                                            {crew.region}
                                          </p>
                                        )}
                                      </div>
                                      {isOwner && (
                                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px] font-semibold">
                                          내가 개설
                                        </span>
                                      )}
                                    </div>
                                    {crew.description && (
                                      <p className="mt-1 text-xs text-navy-700 line-clamp-2">
                                        {crew.description}
                                      </p>
                                    )}
                                    {Array.isArray(crew.tags) && crew.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {crew.tags.map((tag, idx) => (
                                          <span
                                            key={idx}
                                            className="text-[10px] px-2 py-0.5 rounded-full bg-navy-100 text-navy-700"
                                          >
                                            #{tag}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center mt-2">
                                      <span className="text-[11px] text-navy-500">
                                        인원 {memberCount.toLocaleString()}명
                                      </span>
                                      {isMyCrew || isOwner ? (
                                        <span className="text-[11px] text-navy-600 font-semibold">
                                          내 크루
                                        </span>
                                      ) : pendingCrewMemberships[crew.id] ? (
                                        <button
                                          onClick={async () => {
                                            const membership = pendingCrewMemberships[crew.id];
                                            if (!membership?.membershipId) return;
                                            try {
                                              await deleteDoc(doc(db, 'crewMembers', membership.membershipId));
                                              setPendingCrewMemberships((prev) => {
                                                const next = { ...prev };
                                                delete next[crew.id];
                                                return next;
                                              });
                                              showToast('가입 신청을 취소했습니다.');
                                            } catch (error) {
                                              console.error('가입 신청 취소 실패:', error);
                                              showToast('가입 신청 취소에 실패했습니다.', 'error');
                                            }
                                          }}
                                          className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                                        >
                                          가입 취소하기
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() => setCrewActionModal({ type: 'join', crew })}
                                          className="px-3 py-1.5 bg-navy-700 text-white text-xs font-semibold rounded-lg hover:bg-navy-800 transition-colors"
                                        >
                                          가입하기
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    </>
                  )}

                  {/* 크루 관리 화면 */}
                  {myActivityCrewView === 'manage' && myCrew && (
                    <div className="space-y-3">
                      <div className="p-3 bg-navy-50 rounded-xl border border-navy-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-navy-200 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {myCrew.emblemUrl ? (
                            <img
                              src={myCrew.emblemUrl}
                              alt={myCrew.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-navy-700">
                              {myCrew.name?.[0] || 'C'}
                            </span>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-navy-900">{myCrew.name}</p>
                          {myCrew.region && (
                            <p className="text-xs text-navy-600">{myCrew.region}</p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2 mt-2">
                        <button
                          onClick={() => setShowCrewNoticeModal(true)}
                          className="w-full px-4 py-2 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 transition-colors"
                        >
                          공지사항 등록
                        </button>
                        <button
                          onClick={() => {
                            setCrewEditForm({
                              name: myCrew.name || '',
                              region: myCrew.region || '',
                              description: myCrew.description || '',
                              tagsText: Array.isArray(myCrew.tags) ? myCrew.tags.join(',') : '',
                            });
                            setShowCrewEditModal(true);
                          }}
                          className="w-full px-4 py-2 bg-navy-100 text-navy-700 rounded-lg text-sm font-semibold hover:bg-navy-200 transition-colors"
                        >
                          크루 정보 수정
                        </button>
                        <button
                          onClick={async () => {
                            if (!myCrew?.id) return;
                            setCrewMembersLoading(true);
                            try {
                              const membersSnap = await getDocs(
                                query(
                                  collection(db, 'crewMembers'),
                                  where('crewId', '==', myCrew.id),
                                ),
                              );
                              const memberDocs = membersSnap.docs.map((d) => ({
                                id: d.id,
                                ...d.data(),
                              }));

                              const usersData = await Promise.all(
                                memberDocs.map(async (m) => {
                                  try {
                                    const uDoc = await getDoc(doc(db, 'users', m.userId));
                                    if (uDoc.exists()) {
                                      return { userId: m.userId, ...uDoc.data() };
                                    }
                                  } catch (error) {
                                    console.error('멤버 사용자 정보 로드 실패:', error);
                                  }
                                  return { userId: m.userId, nickname: '알 수 없음' };
                                }),
                              );

                              const usersMap = {};
                              usersData.forEach((u) => {
                                usersMap[u.userId] = u;
                              });

                              const merged = memberDocs.map((m) => ({
                                ...m,
                                nickname: usersMap[m.userId]?.nickname || '알 수 없음',
                              }));

                              setCrewMembers(merged);
                              setShowCrewMembersModal(true);
                            } catch (error) {
                              console.error('크루 멤버 로드 실패:', error);
                              showToast('크루 멤버를 불러오지 못했습니다.', 'error');
                            } finally {
                              setCrewMembersLoading(false);
                            }
                          }}
                          className="w-full px-4 py-2 bg-navy-100 text-navy-700 rounded-lg text-sm font-semibold hover:bg-navy-200 transition-colors"
                        >
                          멤버 관리
                        </button>
                        <button
                          onClick={() => setShowCrewDisbandModal(true)}
                          className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors"
                        >
                          크루 해체
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 크루 개설 화면 */}
                  {myActivityCrewView === 'create' && (
                    <CrewCreateSection
                      user={user}
                      setMyCrew={setMyCrew}
                      setMyCrewRole={setMyCrewRole}
                      setMyActivityCrewView={setMyActivityCrewView}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 크루 가입 확인 팝업 */}
      {crewActionModal && crewActionModal.type === 'join' && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => setCrewActionModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 text-center mb-3">
              크루 가입
            </h3>
            <p className="text-sm sm:text-base text-navy-700 text-center mb-6">
              크루에 가입하시겠습니까?
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleConfirmJoinCrew}
                className="w-full bg-navy-700 text-white py-3 sm:py-3.5 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-800 active:bg-navy-900 transition-colors"
              >
                가입하기
              </button>
              <button
                type="button"
                onClick={() => setCrewActionModal(null)}
                className="w-full bg-navy-100 text-navy-700 py-3 sm:py-3.5 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 크루 공지사항 등록 모달 */}
      {showCrewNoticeModal && myCrew && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowCrewNoticeModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-3 text-center">
              크루 공지사항 등록
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-navy-600 mb-1">제목</label>
                <input
                  type="text"
                  value={crewNoticeTitle}
                  onChange={(e) => setCrewNoticeTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                  placeholder="공지 제목을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">내용</label>
                <textarea
                  rows={4}
                  value={crewNoticeContent}
                  onChange={(e) => setCrewNoticeContent(e.target.value)}
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
                  placeholder="크루원에게 전달할 공지 내용을 입력하세요"
                />
              </div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!user?.uid || !myCrew?.id) return;
                    const title = crewNoticeTitle.trim();
                    const content = crewNoticeContent.trim();
                    if (!title || !content) {
                      showToast('제목과 내용을 모두 입력해 주세요.', 'info');
                      return;
                    }
                    try {
                      const createdAt = Timestamp.now();
                      const docRef = await addDoc(collection(db, 'crewNotices'), {
                        crewId: myCrew.id,
                        title,
                        content,
                        authorId: user.uid,
                        authorNickname: userData?.nickname || user.displayName || '',
                        createdAt,
                      });
                      
                      // 모든 크루 멤버에게 알림 생성
                      try {
                        const membersSnap = await getDocs(
                          query(
                            collection(db, 'crewMembers'),
                            where('crewId', '==', myCrew.id),
                          ),
                        );
                        const approvedMembers = membersSnap.docs.filter(
                          (m) => !m.data().status || m.data().status === 'approved',
                        );
                        // 작성자 제외하고 알림 전송
                        const notificationPromises = approvedMembers
                          .filter((m) => m.data().userId !== user.uid)
                          .map((m) =>
                            createNotification(m.data().userId, 'crewNotice', {
                              crewId: myCrew.id,
                              crewName: myCrew.name,
                              noticeId: docRef.id,
                            }),
                          );
                        await Promise.all(notificationPromises);
                      } catch (notifError) {
                        console.error('알림 생성 실패:', notifError);
                      }
                      
                      showToast('공지사항을 등록했습니다.');

                      // 공지사항 목록 다시 로드
                      try {
                        const noticesSnap = await getDocs(
                          query(collection(db, 'crewNotices'), where('crewId', '==', myCrew.id)),
                        );
                        const allNotices = noticesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                        allNotices.sort((a, b) => {
                          const ta =
                            a.createdAt && typeof a.createdAt.toMillis === 'function'
                              ? a.createdAt.toMillis()
                              : 0;
                          const tb =
                            b.createdAt && typeof b.createdAt.toMillis === 'function'
                              ? b.createdAt.toMillis()
                              : 0;
                          return tb - ta;
                        });
                        setMyCrewNotices(allNotices);
                        setMyCrewLatestNotice(allNotices[0] || null);
                      } catch (reloadError) {
                        console.error('공지사항 재로드 실패:', reloadError);
                      }

                      setCrewNoticeTitle('');
                      setCrewNoticeContent('');
                      setShowCrewNoticeModal(false);
                      setMyActivityTab('crew');
                      setMyActivityCrewView('main');
                    } catch (error) {
                      console.error('공지사항 등록 실패:', error);
                      showToast('공지사항 등록에 실패했습니다.', 'error');
                    }
                  }}
                  className="w-full bg-navy-700 text-white py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-800 active:bg-navy-900 transition-colors"
                >
                  등록하기
                </button>
                <button
                  type="button"
                  onClick={() => setShowCrewNoticeModal(false)}
                  className="w-full bg-navy-100 text-navy-700 py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 크루 정보 수정 모달 */}
      {showCrewEditModal && myCrew && crewEditForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowCrewEditModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 mb-3 text-center">
              크루 정보 수정
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-navy-600 mb-1">크루 이름</label>
                <input
                  type="text"
                  value={crewEditForm.name}
                  onChange={(e) =>
                    setCrewEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">지역</label>
                <input
                  type="text"
                  value={crewEditForm.region}
                  onChange={(e) =>
                    setCrewEditForm((prev) => ({ ...prev, region: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">크루 소개</label>
                <textarea
                  rows={3}
                  value={crewEditForm.description}
                  onChange={(e) =>
                    setCrewEditForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">
                  태그 (쉼표로 구분, 최대 5개)
                </label>
                <input
                  type="text"
                  value={crewEditForm.tagsText}
                  onChange={(e) => {
                    const next = e.target.value;
                    const commaCount = (next.match(/,/g) || []).length;
                    if (commaCount > 4) {
                      showToast('태그는 최대 5개까지만 등록 가능합니다.', 'info');
                      return;
                    }
                    setCrewEditForm((prev) => ({ ...prev, tagsText: next }));
                  }}
                  className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy-400"
                />
              </div>
              <div>
                <label className="block text-xs text-navy-600 mb-1">크루 앰블럼</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-navy-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {emblemChangePreview || myCrew.emblemUrl ? (
                      <img
                        src={emblemChangePreview || myCrew.emblemUrl}
                        alt="크루 앰블럼"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-navy-400 px-1 text-center">
                        이미지 없음
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center px-3 py-1.5 bg-navy-700 text-white rounded-lg text-xs font-semibold cursor-pointer hover:bg-navy-800 transition-colors">
                      이미지 선택
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setEmblemChangeFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setEmblemChangePreview(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    <p className="mt-1 text-[11px] text-navy-500">
                      정사각형 이미지를 권장합니다. (최대 5MB)
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    if (!user?.uid || !myCrew?.id) return;
                    const trimmedName = crewEditForm.name.trim();
                    if (!trimmedName) {
                      showToast('크루 이름을 입력해 주세요.', 'info');
                      return;
                    }
                    const rawTags = crewEditForm.tagsText
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean);
                    const uniqueTags = Array.from(new Set(rawTags)).slice(0, 5);
                    try {
                      let emblemUrl = myCrew.emblemUrl;

                      // 앰블럼 이미지가 변경되었으면 업로드
                      if (emblemChangeFile) {
                        try {
                          const compressed = await compressImage(emblemChangeFile);
                          const emblemRef = ref(storage, `crewEmblems/${myCrew.id}`);
                          await uploadBytes(emblemRef, compressed);
                          emblemUrl = await getDownloadURL(emblemRef);
                        } catch (error) {
                          console.error('크루 앰블럼 업로드 실패:', error);
                          showToast('크루 앰블럼 업로드에 실패했습니다.', 'error');
                          return;
                        }
                      }

                      await updateDoc(doc(db, 'crews', myCrew.id), {
                        name: trimmedName,
                        region: crewEditForm.region.trim(),
                        description: crewEditForm.description.trim(),
                        tags: uniqueTags,
                        ...(emblemUrl ? { emblemUrl } : {}),
                      });

                      // 현재 화면의 크루 카드 정보 갱신
                      setMyCrew((prev) =>
                        prev
                          ? {
                              ...prev,
                              name: trimmedName,
                              region: crewEditForm.region.trim(),
                              description: crewEditForm.description.trim(),
                              tags: uniqueTags,
                              ...(emblemUrl ? { emblemUrl } : {}),
                            }
                          : prev,
                      );

                      // 내 프로필의 crewName 도 최신 이름으로 업데이트
                      await updateDoc(doc(db, 'users', user.uid), {
                        crewName: trimmedName,
                      });

                      showToast('크루 정보를 수정했습니다.');
                      setShowCrewEditModal(false);
                      setCrewEditForm(null);
                      setEmblemChangeFile(null);
                      setEmblemChangePreview(null);
                    } catch (error) {
                      console.error('크루 정보 수정 실패:', error);
                      showToast('크루 정보 수정에 실패했습니다.', 'error');
                    }
                  }}
                  className="w-full bg-navy-700 text-white py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-800 active:bg-navy-900 transition-colors"
                >
                  저장하기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCrewEditModal(false);
                    setCrewEditForm(null);
                    setEmblemChangeFile(null);
                    setEmblemChangePreview(null);
                  }}
                  className="w-full bg-navy-100 text-navy-700 py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 크루 멤버 관리 모달 */}
      {showCrewMembersModal && myCrew && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowCrewMembersModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-navy-200">
              <h3 className="text-lg font-bold text-navy-900">멤버 관리</h3>
              <button
                onClick={() => setShowCrewMembersModal(false)}
                className="text-navy-400 hover:text-navy-600 transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {crewMembersLoading ? (
                <div className="text-sm text-navy-500 text-center py-4">불러오는 중...</div>
              ) : crewMembers.length === 0 ? (
                <div className="text-sm text-navy-500 text-center py-4">
                  등록된 멤버가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 승인 대기 중인 멤버 */}
                  {crewMembers.filter((m) => m.status === 'pending').length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-navy-700 mb-2">승인 대기</p>
                      <div className="space-y-2">
                        {crewMembers
                          .filter((m) => m.status === 'pending')
                          .map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                            >
                              <div>
                                <p className="text-sm font-semibold text-navy-900">{m.nickname}</p>
                                <p className="text-[11px] text-navy-500">가입 신청 대기 중</p>
                              </div>
                              {(myCrewRole === 'owner' || myCrewRole === 'admin') && (
                                <div className="flex gap-1">
                                  <button
                                    className="px-2 py-1 text-[11px] bg-navy-700 text-white rounded-lg hover:bg-navy-800"
                                    onClick={async () => {
                                      try {
                                        await updateDoc(doc(db, 'crewMembers', m.id), {
                                          status: 'approved',
                                        });
                                        await updateDoc(doc(db, 'users', m.userId), {
                                          crewId: myCrew.id,
                                          crewName: myCrew.name,
                                        });
                                        
                                        // 알림 생성
                                        await createNotification(m.userId, 'crewApproved', {
                                          crewId: myCrew.id,
                                          crewName: myCrew.name,
                                        });
                                        
                                        setCrewMembers((prev) =>
                                          prev.map((cm) =>
                                            cm.id === m.id ? { ...cm, status: 'approved' } : cm,
                                          ),
                                        );
                                        setMyCrewMemberCount((prev) => prev + 1);
                                        showToast('멤버 가입을 승인했습니다.');
                                      } catch (error) {
                                        console.error('멤버 승인 실패:', error);
                                        showToast('멤버 승인에 실패했습니다.', 'error');
                                      }
                                    }}
                                  >
                                    승인
                                  </button>
                                  <button
                                    className="px-2 py-1 text-[11px] bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                    onClick={() => {
                                      setConfirmModal({
                                        message: `${m.nickname}님의 가입 신청을 거부하시겠습니까?`,
                                        onConfirm: async () => {
                                          try {
                                            await deleteDoc(doc(db, 'crewMembers', m.id));
                                            setCrewMembers((prev) =>
                                              prev.filter((cm) => cm.id !== m.id),
                                            );
                                            showToast('가입 신청을 거부했습니다.');
                                            setConfirmModal(null);
                                          } catch (error) {
                                            console.error('가입 신청 거부 실패:', error);
                                            showToast('가입 신청 거부에 실패했습니다.', 'error');
                                            setConfirmModal(null);
                                          }
                                        },
                                        onCancel: () => setConfirmModal(null),
                                      });
                                    }}
                                  >
                                    거부
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 승인된 멤버 */}
                  {crewMembers.filter((m) => m.status !== 'pending').length > 0 && (
                    <div>
                      {crewMembers.filter((m) => m.status === 'pending').length > 0 && (
                        <p className="text-xs font-semibold text-navy-700 mb-2 mt-4">멤버</p>
                      )}
                      <div className="space-y-2">
                        {crewMembers
                          .filter((m) => m.status !== 'pending')
                          .sort((a, b) => {
                            // 크루장, 관리자, 크루원 순으로 정렬
                            const roleOrder = { owner: 0, admin: 1, member: 2 };
                            const aOrder = roleOrder[a.role] ?? 2;
                            const bOrder = roleOrder[b.role] ?? 2;
                            return aOrder - bOrder;
                          })
                          .map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between p-3 bg-navy-50 rounded-lg"
                            >
                              <div>
                                <p className="text-sm font-semibold text-navy-900">{m.nickname}</p>
                                <p className="text-[11px] text-navy-500">
                                  {m.role === 'owner'
                                    ? '크루장'
                                    : m.role === 'admin'
                                    ? '관리자'
                                    : '멤버'}
                                </p>
                              </div>
                              {m.userId !== user.uid &&
                                (myCrewRole === 'owner' ||
                                  (myCrewRole === 'admin' && m.role === 'member')) && (
                                  <div className="flex gap-1">
                                    {m.role !== 'admin' && myCrewRole === 'owner' && (
                                      <button
                                        className="px-2 py-1 text-[11px] bg-navy-100 text-navy-700 rounded-lg hover:bg-navy-200"
                                        onClick={() => {
                                          setConfirmModal({
                                            message: `${m.nickname}님을 관리자로 임명하시겠습니까?`,
                                            onConfirm: async () => {
                                              try {
                                                await updateDoc(doc(db, 'crewMembers', m.id), {
                                                  role: 'admin',
                                                });
                                                
                                                // 알림 생성
                                                await createNotification(m.userId, 'crewAdmin', {
                                                  crewId: myCrew.id,
                                                  crewName: myCrew.name,
                                                });
                                                
                                                setCrewMembers((prev) =>
                                                  prev.map((cm) =>
                                                    cm.id === m.id ? { ...cm, role: 'admin' } : cm,
                                                  ),
                                                );
                                                showToast('관리자로 임명했습니다.');
                                                setConfirmModal(null);
                                              } catch (error) {
                                                console.error('관리자 임명 실패:', error);
                                                showToast('관리자 임명에 실패했습니다.', 'error');
                                                setConfirmModal(null);
                                              }
                                            },
                                            onCancel: () => setConfirmModal(null),
                                          });
                                        }}
                                      >
                                        관리자 임명
                                      </button>
                                    )}
                                    {myCrewRole === 'owner' && (
                                      <button
                                        className="px-2 py-1 text-[11px] bg-navy-100 text-navy-700 rounded-lg hover:bg-navy-200"
                                        onClick={() => {
                                          setConfirmModal({
                                            message: `${m.nickname}님께 크루장을 위임하시겠습니까?`,
                                            onConfirm: async () => {
                                              try {
                                                // 새 크루장 설정
                                                await updateDoc(doc(db, 'crews', myCrew.id), {
                                                  ownerId: m.userId,
                                                });

                                                // 멤버십 역할 변경
                                                const myMemberDoc = crewMembers.find(
                                                  (cm) => cm.userId === user.uid,
                                                );
                                                if (myMemberDoc) {
                                                  await updateDoc(
                                                    doc(db, 'crewMembers', myMemberDoc.id),
                                                    {
                                                      role: 'member',
                                                      crewOwnerId: m.userId,
                                                    },
                                                  );
                                                }
                                                await updateDoc(doc(db, 'crewMembers', m.id), {
                                                  role: 'owner',
                                                  crewOwnerId: m.userId,
                                                });

                                                // 알림 생성
                                                await createNotification(m.userId, 'crewOwner', {
                                                  crewId: myCrew.id,
                                                  crewName: myCrew.name,
                                                });

                                                setMyCrew((prev) =>
                                                  prev ? { ...prev, ownerId: m.userId } : prev,
                                                );
                                                setMyCrewRole('member');
                                                setCrewMembers((prev) =>
                                                  prev.map((cm) => {
                                                    if (cm.id === m.id) {
                                                      return {
                                                        ...cm,
                                                        role: 'owner',
                                                        crewOwnerId: m.userId,
                                                      };
                                                    }
                                                    if (cm.userId === user.uid) {
                                                      return {
                                                        ...cm,
                                                        role: 'member',
                                                        crewOwnerId: m.userId,
                                                      };
                                                    }
                                                    return { ...cm, crewOwnerId: m.userId };
                                                  }),
                                                );

                                                showToast('크루장을 위임했습니다.');
                                                setShowCrewMembersModal(false);
                                                setMyActivityCrewView('main');
                                                setConfirmModal(null);
                                              } catch (error) {
                                                console.error('크루장 위임 실패:', error);
                                                showToast('크루장 위임에 실패했습니다.', 'error');
                                                setConfirmModal(null);
                                              }
                                            },
                                            onCancel: () => setConfirmModal(null),
                                          });
                                        }}
                                      >
                                        크루장 위임
                                      </button>
                                    )}
                                    <button
                                      className="px-2 py-1 text-[11px] bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                      onClick={() => {
                                        setConfirmModal({
                                          message: `${m.nickname}님을 크루에서 강퇴하시겠습니까?`,
                                          onConfirm: async () => {
                                            try {
                                              await deleteDoc(doc(db, 'crewMembers', m.id));
                                              await updateDoc(doc(db, 'users', m.userId), {
                                                crewId: null,
                                                crewName: null,
                                              });
                                              
                                              // 알림 생성
                                              await createNotification(m.userId, 'crewKicked', {
                                                crewId: myCrew.id,
                                                crewName: myCrew.name,
                                              });
                                              
                                              setCrewMembers((prev) =>
                                                prev.filter((cm) => cm.id !== m.id),
                                              );
                                              setMyCrewMemberCount((prev) =>
                                                Math.max(0, prev - 1),
                                              );
                                              showToast('멤버를 강퇴했습니다.');
                                              setConfirmModal(null);
                                            } catch (error) {
                                              console.error('멤버 강퇴 실패:', error);
                                              showToast('멤버 강퇴에 실패했습니다.', 'error');
                                              setConfirmModal(null);
                                            }
                                          },
                                          onCancel: () => setConfirmModal(null),
                                        });
                                      }}
                                    >
                                      강퇴
                                    </button>
                                  </div>
                                )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* 크루 해체 모달 */}
      {showCrewDisbandModal && myCrew && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setShowCrewDisbandModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-red-600 mb-3 text-center">
              크루 해체
            </h3>
            <p className="text-sm sm:text-base text-navy-700 mb-4 text-center">
              정말로 크루를 해체하시겠어요? 아래에{' '}
              <span className="font-semibold text-red-600">{myCrew.name}</span> 을(를)
              정확히 입력해 주세요.
            </p>
            <input
              type="text"
              value={crewDisbandNameInput}
              onChange={(e) => setCrewDisbandNameInput(e.target.value)}
              className="w-full px-3 py-2 border border-navy-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 mb-3"
              placeholder="크루 이름을 입력하세요"
            />
            <div className="space-y-2">
              <button
                type="button"
                onClick={async () => {
                  if (!user?.uid || !myCrew?.id) return;
                  if (crewDisbandNameInput.trim() !== (myCrew.name || '').trim()) {
                    showToast('크루 이름이 일치하지 않습니다.', 'info');
                    return;
                  }
                  setConfirmModal({
                    message: '정말로 크루를 해체하시겠습니까? 되돌릴 수 없습니다.',
                    onConfirm: async () => {
                      try {
                        // 멤버십 모두 삭제 및 사용자 crew 정보 초기화
                        const membersSnap = await getDocs(
                          query(collection(db, 'crewMembers'), where('crewId', '==', myCrew.id)),
                        );
                        const batchMembers = membersSnap.docs;
                        for (const m of batchMembers) {
                          const data = m.data();
                          await deleteDoc(m.ref);
                          if (data.userId) {
                            await updateDoc(doc(db, 'users', data.userId), {
                              crewId: null,
                              crewName: null,
                            });
                          }
                        }

                        // 크루 문서 삭제
                        await deleteDoc(doc(db, 'crews', myCrew.id));

                        setMyCrew(null);
                        setMyCrewRole(null);
                        setMyCrewMemberCount(0);
                        setShowCrewDisbandModal(false);
                        setMyActivityCrewView('main');
                        showToast('크루를 해체했습니다.');
                        setConfirmModal(null);
                      } catch (error) {
                        console.error('크루 해체 실패:', error);
                        showToast('크루 해체에 실패했습니다.', 'error');
                        setConfirmModal(null);
                      }
                    },
                    onCancel: () => setConfirmModal(null),
                  });
                }}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-red-700 active:bg-red-800 transition-colors"
              >
                크루 해체하기
              </button>
              <button
                type="button"
                onClick={() => setShowCrewDisbandModal(false)}
                className="w-full bg-navy-100 text-navy-700 py-3 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팔로워/팔로잉 목록 모달 */}
      {showFollowListModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowFollowListModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단: 러닝 버디 제목 + 팔로워/팔로잉 탭 (내 활동 스타일 버튼) */}
            <div className="border-b border-navy-200">
              <div className="flex items-center justify-between px-4 sm:px-6 pt-4 pb-2">
                <h3 className="text-lg font-bold text-navy-900">러닝 버디</h3>
                <button
                  onClick={() => setShowFollowListModal(null)}
                  className="text-navy-400 hover:text-navy-600 transition-colors p-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="px-4 sm:px-6 pb-3">
                <div className="flex gap-2 bg-navy-100 rounded-xl p-1">
                  <button
                    onClick={() =>
                      setShowFollowListModal({
                        type: 'followers',
                        users: followersList,
                      })
                    }
                    className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg ${
                      showFollowListModal.type === 'followers'
                        ? 'bg-white text-navy-900 shadow-sm'
                        : 'bg-transparent text-navy-500'
                    }`}
                  >
                    팔로워 {followCounts.followers.toLocaleString()}
                  </button>
                  <button
                    onClick={() =>
                      setShowFollowListModal({
                        type: 'following',
                        users: followingList,
                      })
                    }
                    className={`flex-1 py-1.5 text-xs sm:text-sm font-semibold rounded-lg ${
                      showFollowListModal.type === 'following'
                        ? 'bg-white text-navy-900 shadow-sm'
                        : 'bg-transparent text-navy-500'
                    }`}
                  >
                    팔로잉 {followCounts.following.toLocaleString()}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {showFollowListModal.users.length === 0 ? (
                <div className="text-center py-8 text-sm text-navy-500">
                  {showFollowListModal.type === 'followers'
                    ? '팔로워가 없습니다.'
                    : '팔로잉 중인 사용자가 없습니다.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {showFollowListModal.users.map((userItem) => {
                    const rel =
                      followRelationships[userItem.id] || {
                        iAmFollowing: false,
                        followingMe: false,
                        isFriend: false,
                      };
                    const isMutualFollow = rel.iAmFollowing && rel.followingMe;

                    return (
                      <div
                        key={userItem.id}
                        className="flex items-center gap-3 p-3 bg-navy-50 rounded-lg hover:bg-navy-100 transition-colors"
                      >
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            if (onViewUserProfile && userItem.id) {
                              onViewUserProfile(userItem.id);
                              setShowFollowListModal(null);
                            }
                          }}
                        >
                          <div className="w-10 h-10 rounded-2xl bg-navy-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {userItem.photoURL ? (
                              <img
                                src={userItem.photoURL}
                                alt={userItem.nickname}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-navy-600 text-sm font-semibold">
                                {userItem.nickname?.[0]?.toUpperCase() || '?'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-navy-900 truncate text-sm">
                              {userItem.nickname || '이름 없음'}
                            </p>
                          </div>
                        </div>

                        <div className="flex-shrink-0">
                          {showFollowListModal.type === 'followers' ? (
                            <>
                              {!rel.iAmFollowing && rel.followingMe && (
                                <div className="px-2 py-1 bg-navy-700 text-white text-xs font-semibold rounded-lg whitespace-nowrap">
                                  맞팔로우
                                </div>
                              )}
                              {isMutualFollow && (
                                <div className="mt-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg whitespace-nowrap">
                                  러닝 버디
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              {rel.iAmFollowing && !rel.followingMe && (
                                <div className="px-2 py-1 bg-navy-100 text-navy-700 text-xs font-semibold rounded-lg whitespace-nowrap">
                                  팔로잉 중
                                </div>
                              )}
                              {isMutualFollow && (
                                <div className="mt-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg whitespace-nowrap">
                                  러닝 버디
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 확인 팝업 모달 */}
      {confirmModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={() => setConfirmModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg sm:text-xl font-bold text-navy-900 text-center mb-3">
              확인
            </h3>
            <p className="text-sm sm:text-base text-navy-700 text-center mb-6">
              {confirmModal.message}
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                }}
                className="w-full bg-navy-700 text-white py-3 sm:py-3.5 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-800 active:bg-navy-900 transition-colors"
              >
                확인
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.onCancel) confirmModal.onCancel();
                  else setConfirmModal(null);
                }}
                className="w-full bg-navy-100 text-navy-700 py-3 sm:py-3.5 rounded-lg font-semibold text-sm sm:text-base hover:bg-navy-200 active:bg-navy-300 transition-colors"
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

export default Profile;

