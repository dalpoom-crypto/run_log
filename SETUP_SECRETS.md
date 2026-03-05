# Firebase Secrets 재설정 가이드

## Gmail 이메일 설정

터미널에서 다음 명령어를 실행하세요:

```bash
firebase functions:secrets:set GMAIL_EMAIL
```

**중요**: 프롬프트가 나타나면 Gmail 주소를 입력하세요 (예: `dalpoom@gmail.com`)

## Gmail 비밀번호 설정

터미널에서 다음 명령어를 실행하세요:

```bash
firebase functions:secrets:set GMAIL_PASSWORD
```

**중요**: 프롬프트가 나타나면 Gmail 앱 비밀번호(16자리)를 입력하세요

## Gmail 앱 비밀번호 생성 방법

1. Google 계정 설정: https://myaccount.google.com/
2. 보안 > 2단계 인증 활성화 (아직 안 했다면)
3. 앱 비밀번호 생성: https://myaccount.google.com/apppasswords
4. "메일" 선택
5. "기타(맞춤 이름)" 선택 후 "RunLog" 입력
6. 생성된 16자리 비밀번호 복사 (예: `abcd efgh ijkl mnop`)

## Secrets 확인

설정 후 다음 명령어로 확인:

```bash
firebase functions:secrets:access GMAIL_EMAIL
firebase functions:secrets:access GMAIL_PASSWORD
```

각 명령어 실행 시 값이 표시되면 정상입니다.

## Functions 배포

Secrets 설정 후 Functions를 배포:

```bash
firebase deploy --only functions
```
