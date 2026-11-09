import type { JobId, StatKey, TraitId } from './types';

/** 모험가 등급. 길드원 등급이자 퀘스트 등급 */
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'] as const;
/** 해당 등급에 오르는 데 필요한 누적 경험치 */
export const RANK_EXP = [0, 60, 180, 400, 800, 1500];

export const STAT_KEYS: StatKey[] = ['might', 'body', 'agility', 'insight', 'will'];
export const STAT_LABEL: Record<StatKey, string> = {
  might: '힘',
  body: '체력',
  agility: '민첩',
  insight: '지능',
  will: '의지',
};

export const TRAITS: Record<TraitId, { name: string; desc: string }> = {
  brave: { name: '용맹', desc: '공격이 강하고 위기의 동료 앞을 막아선다' },
  cautious: { name: '신중', desc: '적의 공격을 잘 피한다' },
  loyal: { name: '충직', desc: '쓰러지려는 동료를 감싼다' },
  greedy: { name: '탐욕', desc: '보상 금화를 더 챙겨온다' },
  cold: { name: '냉철', desc: '약한 적의 급소를 노린다' },
  curious: { name: '호기심', desc: '경험을 더 많이 얻는다' },
};
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];

export const GIVEN_NAMES = ['알렌', '리아나', '가레스', '에드윈', '세라', '롤랜드', '미리엘', '브란', '이졸데', '케이', '토비아스', '엘린', '하랄드', '로웨나', '퍼시벌', '마렌'];
export const SURNAMES = ['그레이', '애쉬포드', '블랙우드', '스톤', '헤일', '윈터', '모건', '브룩', '레이븐', '크로포드'];
export const ORIGINS = [
  '몰락한 기사 가문의 막내',
  '시골 대장장이의 자식',
  '이름 없는 떠돌이 용병',
  '수도원에서 쫓겨난 견습 수도사',
  '상단 호위 출신',
  '전쟁고아로 자란 사람',
  '마법학교를 중퇴한 학생',
  '숲 마을의 사냥꾼',
];

export const QUEST_TYPES = [
  { name: '산적 토벌', desc: '왕도로 가는 길을 막은 산적 무리를 소탕한다.', foes: ['산적', '산적 궁수'], boss: '산적 두목', drops: ['leather', 'iron'] },
  { name: '고블린 소탕', desc: '마을 창고를 털어 가는 고블린을 몰아낸다.', foes: ['고블린', '고블린 투척병'], boss: '고블린 족장', drops: ['iron', 'herb'] },
  { name: '폐광 조사', desc: '버려진 광산에서 들리는 소리의 정체를 밝힌다.', foes: ['스켈레톤', '구울'], boss: '망령 기사', drops: ['iron', 'manastone'], special: 'cleric' as JobId },
  { name: '상단 호위', desc: '향신료 상단을 이웃 영지까지 호위한다.', foes: ['복면 습격자', '도적'], boss: '도적단 두령', drops: ['herb', 'meat'] },
  { name: '던전 정찰', desc: '새로 발견된 던전 입구를 정찰한다.', foes: ['동굴 거미', '석상 골렘'], boss: '거미 여왕', drops: ['silk', 'manastone'], special: 'rogue' as JobId },
  { name: '마수 사냥', desc: '가축을 노리는 마수를 처치한다.', foes: ['다이어울프', '오크 척후병'], boss: '오크 전쟁군주', drops: ['meat', 'leather'], special: 'archer' as JobId },
];
