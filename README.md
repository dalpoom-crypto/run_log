# RunLog - 러닝 기록 아카이브

러너를 위한 개인 기록 아카이브 웹앱입니다.

## 기능

- 🏃 개인 달리기 기록 관리
- 📊 거리별 최고 기록 추적
- 🏆 대회 기록 관리
- 📸 사진 업로드 및 관리
- 🔒 공개/비공개 설정
- 📱 PWA 지원 (앱처럼 설치 가능)

## 기술 스택

- React 18
- Vite
- Firebase (Authentication, Firestore, Storage)
- Tailwind CSS
- PWA (Progressive Web App)

## 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

## 환경 변수 (Vercel / 로컬 빌드)

메인 앱과 관리자 페이지(admin) 모두 다음 환경 변수를 사용합니다. **Git에 올리지 말고** 로컬은 `.env`, Vercel은 **Settings → Environment Variables**에 설정하세요.

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (선택)

`npm run build` 시 `public/admin-config.js`는 위 값으로 자동 생성되며, 저장소에는 포함되지 않습니다.

## 배포

### Vercel 배포

1. GitHub에 코드 푸시
2. Vercel에 프로젝트 연결
3. **Environment Variables**에 위 Firebase 변수 추가
4. 자동 배포 완료

### PWA 설치

- 모바일: 브라우저에서 "홈 화면에 추가" 선택
- 데스크톱: 브라우저 주소창의 설치 아이콘 클릭

## 앱 출시 준비

이 프로젝트는 다음 방법으로 네이티브 앱으로 변환할 수 있습니다:

1. **Capacitor** (권장)
   - 웹 코드를 그대로 사용
   - iOS/Android 네이티브 앱 생성
   - App Store / Play Store 배포 가능

2. **React Native**
   - 코드 재작성 필요
   - 완전한 네이티브 성능

## 프로젝트 구조

```
src/
├── components/      # React 컴포넌트
├── config/         # Firebase 설정
├── constants/       # 상수 데이터
├── utils/          # 유틸리티 함수
└── styles/         # 스타일 파일
```

## 라이선스

MIT
