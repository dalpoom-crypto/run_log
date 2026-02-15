# Firebase Functions 배포 체크리스트

## 1. Secrets 설정 확인

다음 명령어로 Secrets가 제대로 설정되었는지 확인:

```bash
firebase functions:secrets:access GMAIL_EMAIL
firebase functions:secrets:access GMAIL_PASSWORD
```

각 명령어 실행 시 값이 표시되면 정상입니다.

## 2. Functions 배포

```bash
firebase deploy --only functions
```

배포가 성공하면 다음과 같은 메시지가 표시됩니다:
```
✔  functions[sendVerificationCode(us-central1)] Successful create operation.
```

## 3. 배포 후 확인

배포 후 Functions 로그를 확인:

```bash
firebase functions:log
```

또는 Firebase 콘솔에서:
1. Firebase 콘솔 접속
2. Functions > Logs 탭
3. 최근 로그 확인

## 4. 테스트

회원가입 페이지에서:
1. 이메일 입력
2. "코드 전송" 버튼 클릭
3. 브라우저 콘솔(F12)에서 에러 확인
4. Functions 로그에서 에러 확인

## 문제 해결

### Secrets가 읽히지 않는 경우

1. Functions 재배포:
```bash
firebase deploy --only functions
```

2. Secrets 재설정:
```bash
firebase functions:secrets:set GMAIL_EMAIL
firebase functions:secrets:set GMAIL_PASSWORD
```

3. Functions 로그 확인:
```bash
firebase functions:log --limit 50
```
