# 컴포넌트 분리 가이드

이 파일은 기존 index.html의 컴포넌트를 모듈화된 구조로 분리하는 작업을 안내합니다.

## 완료된 작업

✅ 기본 프로젝트 구조 생성
✅ 상수, 유틸리티, Firebase 설정 분리
✅ AuthForm 컴포넌트 생성
✅ Profile 컴포넌트 생성

## 진행 중인 작업

🔄 나머지 컴포넌트 분리:
- RunCard.jsx
- AddRunForm.jsx (드래그앤드롭, 글씨색 선택 포함)
- SettingsModal.jsx
- RunDetailModal.jsx
- Feed.jsx
- RecordsManagement.jsx
- PersonalRecords.jsx
- RaceHistory.jsx

## 다음 단계

1. 기존 index.html 파일의 컴포넌트 코드를 각 파일로 복사
2. import/export 문 추가
3. 의존성 확인 및 수정
4. 테스트

## 참고사항

- 모든 컴포넌트는 `src/components/` 폴더에 위치
- 유틸리티 함수는 `src/utils/`에서 import
- 상수는 `src/constants/`에서 import
- Firebase는 `src/config/firebase.js`에서 import
