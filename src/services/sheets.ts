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
  if (webAppUrl) {
    try {
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain', // GAS CORS 제한 우회를 위해 text/plain 권장
        },
        body: JSON.stringify(evaluationData),
      });

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
