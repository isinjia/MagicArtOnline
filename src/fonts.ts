import g11 from 'galmuri/dist/Galmuri11.woff2?url';
import g11b from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import g9 from 'galmuri/dist/Galmuri9.woff2?url';

/** 도트 폰트를 먼저 불러와야 캔버스 글자도 도트로 그려진다 */
export async function loadFonts(): Promise<void> {
  const faces = [
    new FontFace('Galmuri11', `url(${g11})`, { weight: '400' }),
    new FontFace('Galmuri11', `url(${g11b})`, { weight: '700' }),
    new FontFace('Galmuri9', `url(${g9})`, { weight: '400' }),
  ];
  await Promise.all(
    faces.map(async (f) => {
      try {
        document.fonts.add(await f.load());
      } catch {
        // 폰트를 못 불러와도 기본 글꼴로 진행한다
      }
    }),
  );
}
