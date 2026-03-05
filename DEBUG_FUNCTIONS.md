# Functions 배포 에러 디버깅 가이드

## 1. 배포 시 전체 에러 메시지 확인

배포 시 나타나는 전체 에러 메시지를 복사해주세요. 특히:
- `Error:`로 시작하는 부분
- `Failed to deploy` 메시지
- 구체적인 에러 내용

## 2. Functions 로그 확인

```bash
firebase functions:log
```

또는 Firebase 콘솔에서:
1. https://console.firebase.google.com/ 접속
2. 프로젝트 선택
3. Functions > Logs 탭
4. 최근 에러 확인

## 3. Secrets 확인

```bash
firebase functions:secrets:access GMAIL_EMAIL
firebase functions:secrets:access GMAIL_PASSWORD
```

각 명령어 실행 시 값이 표시되면 정상입니다.

## 4. Functions 코드 문법 확인

```bash
cd functions
node -c index.js
```

문법 오류가 있으면 에러 메시지가 표시됩니다.

## 5. 배포 재시도

```bash
firebase deploy --only functions --debug
```

`--debug` 옵션으로 더 자세한 로그를 확인할 수 있습니다.
