/**
 * Google Sheets API Integration Service
 * 
 * 구글 Apps Script 웹앱 URL 혹은 구글 클라우드 콘솔의 API 설정을 활성화하여
 * 구글 스프레드시트에 평가 현황 및 결과를 실시간으로 전송할 수 있습니다.
 */

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
const spreadsheetId = import.meta.env.VITE_GOOGLE_SHEET_ID || '';
const webAppUrl = import.meta.env.VITE_GOOGLE_SHEET_URL || '';

export const isGoogleSheetsConfigured = () => {
  return webAppUrl !== '' || (apiKey !== '' && spreadsheetId !== '');
};

/**
 * 구글 시트에 행 추가 (평가 결과 행 전송)
 */
export const appendEvaluationToSheet = async (evaluationData: {
  evaluatorName: string;
  evaluateeName: string;
  answers: string[];
  submittedAt: string;
}) => {
  if (!isGoogleSheetsConfigured()) {
    console.warn('Google Sheets 연동 환경변수가 누락되어 로컬 전송 처리됩니다.');
    return false;
  }

  // 1. Google Apps Script Web App URL 방식 (권장: 익명 전송 지원 및 안전성 높음)
  // GAS 웹앱은 302 리다이렉트를 거치는데, POST로 보내면 리다이렉트 과정에서
  // 브라우저가 요청을 GET으로 바꾸며 body를 유실시켜 doPost가 아닌 doGet이 호출된다.
  // 리다이렉트에도 안전하도록 GET + 쿼리 파라미터 방식으로 전송한다.
  if (webAppUrl) {
    try {
      const url = `${webAppUrl}?data=${encodeURIComponent(JSON.stringify(evaluationData))}`;
      const response = await fetch(url, { method: 'GET' });
      return response.ok;
    } catch (error) {
      console.error('Google Sheets Apps Script 연동 실패:', error);
      return false;
    }
  }

  // 2. Google Sheets API Key 방식 (기존)
  try {
    const rowValues = [
      evaluationData.evaluatorName,
      evaluationData.evaluateeName,
      ...evaluationData.answers,
      evaluationData.submittedAt
    ];

    // Google Sheets Sheets.Spreadsheets.Values.Append REST API
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:append?valueInputOption=USER_ENTERED&key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Google Sheets API 연동 실패:', error);
    return false;
  }
};
