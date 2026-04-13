const { onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

// 2nd Gen Functions 전역 설정
setGlobalOptions({
  secrets: ['GMAIL_EMAIL', 'GMAIL_PASSWORD'],
  region: 'us-central1',
});

// 인증 코드 이메일 전송 Cloud Function (2nd Gen)
exports.sendVerificationCode = onCall(async (request) => {
  const { email, code } = request.data;

  if (!email || !code) {
    throw new Error('이메일과 인증 코드가 필요합니다.');
  }

    // Firebase Secrets에서 값 가져오기
    // Secrets는 process.env로 접근 가능하지만, 디버깅을 위해 로그 출력
    const gmailEmail = process.env.GMAIL_EMAIL || '';
    const gmailPassword = process.env.GMAIL_PASSWORD || '';

    console.log('Secrets 확인:', {
      hasEmail: !!gmailEmail,
      hasPassword: !!gmailPassword,
      emailLength: gmailEmail.length,
      passwordLength: gmailPassword.length
    });

    if (!gmailEmail || !gmailPassword) {
      console.error('Gmail 설정이 없습니다. Firebase Secrets를 설정해주세요.');
      console.error('GMAIL_EMAIL:', gmailEmail ? '설정됨' : '없음');
      console.error('GMAIL_PASSWORD:', gmailPassword ? '설정됨' : '없음');
      throw new Error('이메일 서비스가 설정되지 않았습니다. Firebase Secrets를 확인해주세요.');
    }

    // 이메일 전송 함수
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailEmail,
        pass: gmailPassword,
      },
    });

    try {
      const mailOptions = {
        from: gmailEmail,
        to: email,
        subject: 'RunLog 회원가입 인증 코드',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">RunLog 회원가입 인증</h2>
            <p>안녕하세요,</p>
            <p>RunLog 회원가입을 위한 인증 코드입니다:</p>
            <div style="background-color: #f0f4f8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #1e3a8a; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
            </div>
            <p>이 코드는 10분간 유효합니다.</p>
            <p>만약 본인이 요청하지 않았다면 이 이메일을 무시하세요.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">RunLog 팀</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error('이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다.');
    }
});

// 비밀번호 재설정 링크 이메일 전송 Cloud Function (2nd Gen)
exports.sendPasswordResetLink = onCall(async (request) => {
  const { email } = request.data;

  if (!email) {
    throw new Error('이메일이 필요합니다.');
  }

  const gmailEmail = process.env.GMAIL_EMAIL || '';
  const gmailPassword = process.env.GMAIL_PASSWORD || '';

  if (!gmailEmail || !gmailPassword) {
    console.error('Gmail 설정이 없습니다. Firebase Secrets를 확인해주세요.');
    throw new Error('이메일 서비스가 설정되지 않았습니다.');
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: gmailPassword,
    },
  });

  try {
    // Firebase가 발급한 재설정 링크에서 oobCode만 추출해서
    // 앱 도메인 링크로 재구성합니다.
    const firebaseLink = await admin.auth().generatePasswordResetLink(email, {
      url: 'https://runlog.vercel.app/?mode=resetPassword',
      handleCodeInApp: false,
    });

    const generatedUrl = new URL(firebaseLink);
    const oobCode = generatedUrl.searchParams.get('oobCode');

    if (!oobCode) {
      throw new Error('재설정 코드 생성에 실패했습니다.');
    }

    const appResetUrl = `https://runlog.vercel.app/?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;

    const mailOptions = {
      from: gmailEmail,
      to: email,
      subject: 'RunLog 비밀번호 재설정 안내',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">RunLog 비밀번호 재설정</h2>
          <p>안녕하세요.</p>
          <p>아래 버튼을 눌러 비밀번호를 재설정해주세요.</p>
          <div style="margin: 24px 0;">
            <a
              href="${appResetUrl}"
              style="display: inline-block; background-color: #1e3a8a; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600;"
            >
              비밀번호 변경하기
            </a>
          </div>
          <p style="color: #4b5563; font-size: 14px;">요청하지 않으셨다면 이 메일을 무시하셔도 됩니다.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">RunLog 팀</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('비밀번호 재설정 메일 전송 실패:', error);
    throw new Error('비밀번호 재설정 메일 전송에 실패했습니다.');
  }
});
