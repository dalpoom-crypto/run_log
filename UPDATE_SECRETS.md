# Firebase Secrets 업데이트 방법

## 방법 1: 기존 Secret 업데이트 (권장)

기존 Secret에 새 값을 설정하면 자동으로 새 버전이 생성됩니다:

```bash
firebase functions:secrets:set GMAIL_EMAIL
firebase functions:secrets:set GMAIL_PASSWORD
```

각 명령어 실행 시 프롬프트에 **새로운 값**을 입력하면 기존 값이 업데이트됩니다.

## 방법 2: Secret 삭제 후 재생성

### 1. 기존 Secret 삭제

```bash
firebase functions:secrets:destroy GMAIL_EMAIL
firebase functions:secrets:destroy GMAIL_PASSWORD
```

삭제 확인 프롬프트가 나타나면 `Y` 입력

### 2. 새로 생성

```bash
firebase functions:secrets:set GMAIL_EMAIL
firebase functions:secrets:set GMAIL_PASSWORD
```

각 명령어 실행 시 올바른 값을 입력하세요.

## 방법 3: Firebase 콘솔에서 수정

1. Firebase 콘솔 접속: https://console.firebase.google.com/
2. 프로젝트 선택
3. Functions > Secrets 탭
4. 수정할 Secret 클릭
5. "Add new version" 클릭
6. 새 값 입력

## 확인

설정 후 확인:

```bash
firebase functions:secrets:access GMAIL_EMAIL
firebase functions:secrets:access GMAIL_PASSWORD
```

## Functions 재배포

Secrets 업데이트 후 Functions를 재배포해야 합니다:

```bash
firebase deploy --only functions
```
