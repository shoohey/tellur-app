// ============================================================
// TELLUR 設定ファイル
// NBS Connect 介護施設向けAIシステム
// ============================================================

const TELLUR_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  APP_NAME: 'TELLUR',
  get DEMO_MODE() {
    return !this.SUPABASE_URL || !this.SUPABASE_ANON_KEY;
  }
};

// 法人・施設マスタ
const FACILITY_MASTER = {
  corporations: [
    { id: 1, name: 'タカハシライフサポート株式会社', code: 'takahashi', careSoftware: 'Quickけあ2', transmission: 'ケアネットメッセンジャー' },
    { id: 2, name: '一般社団法人日本地域福祉協会', code: 'sarasa', careSoftware: 'Quickけあ2', transmission: 'ケアネットメッセンジャー' },
    { id: 3, name: '株式会社WESTON', code: 'weston', careSoftware: 'ワイズマン', transmission: '北海道国保連合' }
  ],
  facilities: [
    { id: 1, corpId: 1, name: '花・水・木 二ツ岩', code: 'hmk-futsuiwa', city: '網走市', reportFormat: 'A', unit: '二ツ岩' },
    { id: 2, corpId: 1, name: '花・水・木 駒場', code: 'hmk-komaba', city: '網走市', reportFormat: 'A', unit: '駒場' },
    { id: 3, corpId: 2, name: 'さらさ富良野', code: 'sarasa-furano', city: '富良野市', reportFormat: 'B', unit: '' },
    { id: 4, corpId: 2, name: 'さらさ伊達', code: 'sarasa-date', city: '伊達市', reportFormat: 'B', unit: '' },
    { id: 5, corpId: 2, name: 'さらさ岩見沢', code: 'sarasa-iwamizawa', city: '岩見沢市', reportFormat: 'C', unit: '' },
    { id: 6, corpId: 3, name: 'WESTON旭川', code: 'weston-asahikawa', city: '旭川市', reportFormat: 'A', unit: '旭川' },
    { id: 7, corpId: 3, name: 'WESTON岩内', code: 'weston-iwanai', city: '岩内町', reportFormat: 'A', unit: '岩内' }
  ]
};
