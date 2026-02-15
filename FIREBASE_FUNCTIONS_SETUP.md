# Firebase Cloud Functions 설정 가이드

EmailJS 없이 Gmail을 통해 이메일을 전송하는 방법입니다.

## 1. Firebase CLI 설치

```bash
npm install -g firebase-tools
```

## 2. Firebase 로그인

```bash
firebase login
```

## 3. Functions 디렉토리로 이동 및 의존성 설치

```bash
cd functions
npm install
cd ..
```

## 4. Gmail 앱 비밀번호 생성

1. Google 계정 설정으로 이동: https://myaccount.google.com/
2. 보안 > 2단계 인증 활성화
3. 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
4. "메일"과 "기타(맞춤 이름)" 선택 후 "RunLog" 입력
5. 생성된 16자리 비밀번호 복사

## 5. Firebase Functions 환경 변수 설정

### 방법 1: Firebase Secrets 사용 (권장)

```bash
# 이메일 설정
firebase functions:secrets:set GMAIL_EMAIL

# 비밀번호 설정 (입력 시 표시되지 않음)
firebase functions:secrets:set GMAIL_PASSWORD
```

각 명령어 실행 시 값을 입력하라는 프롬프트가 나타납니다.

### 방법 2: Firebase 콘솔에서 설정

1. Firebase 콘솔 접속: https://console.firebase.google.com/
2. 프로젝트 선택 > Functions > Secrets 탭
3. "Add secret" 클릭
4. `GMAIL_EMAIL`과 `GMAIL_PASSWORD` 추가

### 방법 3: 로컬 개발용 `.env` 파일

`functions/.env` 파일 생성:
```
GMAIL_EMAIL=your-email@gmail.com
GMAIL_PASSWORD=your-app-password
```

**주의**: `.env` 파일은 `.gitignore`에 포함되어 있어야 합니다.

## 6. Functions 배포

```bash
firebase deploy --only functions
```

## 7. 테스트

회원가입 페이지에서 이메일 인증 코드 전송을 테스트해보세요.

## 주의사항

- Gmail 앱 비밀번호는 일반 비밀번호가 아닙니다
- 2단계 인증이 활성화되어 있어야 앱 비밀번호를 생성할 수 있습니다
- 환경 변수는 Firebase 콘솔에서도 확인/수정할 수 있습니다
