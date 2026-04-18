# TELLUR SaaS アーキテクチャ設計書

## 1. システム概要
介護施設AI支援システム「TELLUR」をSaaS化。複数介護法人に提供するマルチテナント型Webアプリケーション。

## 2. 技術スタック
| 項目 | 技術 |
|---|---|
| フレームワーク | Next.js 14 (App Router) + TypeScript strict |
| 認証 | Supabase Auth（メール/パスワード） |
| DB | Supabase PostgreSQL |
| ORM | Prisma |
| UI | Tailwind CSS + shadcn/ui |
| デプロイ | Vercel（tellur.site） |
| メール | Resend |
| エラー監視 | Sentry |
| Excel生成 | SheetJS (xlsx) |
| 音声認識 | Web Speech API |
| AI | Claude API + OpenAI API（デュアル対応） |

## 3. 権限設計（5階層マルチテナント）

### ロール定義
| ロール | 説明 | アクセス範囲 |
|---|---|---|
| super_admin | NBS Connect / セレン社 | 全法人・全施設を横断管理 |
| partner | 営業代理店 | 紹介法人のデータ閲覧のみ |
| org_admin | 介護法人本部 | 自法人の全施設・全スタッフ管理 |
| facility_admin | 施設長 | 自施設のスタッフ・データ管理 |
| staff | 一般スタッフ | 自分の業務データのみ |

### アクセスマトリクス
| 機能 | super_admin | partner | org_admin | facility_admin | staff |
|---|---|---|---|---|---|
| NBS管理コンソール | ✅ | ❌ | ❌ | ❌ | ❌ |
| 代理店ビュー | ✅ | ✅(紹介先のみ) | ❌ | ❌ | ❌ |
| 法人管理・請求管理 | ✅ | 👁(閲覧) | ❌ | ❌ | ❌ |
| 本部管理ダッシュボード | ✅ | 👁 | ✅ | ❌ | ❌ |
| ユーザー招待・管理 | ✅ | ❌ | ✅ | ✅(自施設) | ❌ |
| 施設統計・報告書集計 | ✅ | 👁 | ✅ | ✅(自施設) | ❌ |
| 事故報告書作成 | ✅ | ❌ | ✅ | ✅ | ✅ |
| ヒヤリハット作成 | ✅ | ❌ | ✅ | ✅ | ✅ |
| 入居検討 | ✅ | ❌ | ✅ | ✅ | ✅ |
| AI施設長相談 | ✅ | ❌ | ✅ | ✅ | ✅ |
| 加算アドバイザー | ✅ | ❌ | ✅ | ✅ | ✅ |
| ケア記録 | ✅ | ❌ | ✅ | ✅ | ✅ |
| 監査ログ | ✅ | ❌ | ✅ | ❌ | ❌ |
| お知らせ配信 | ✅ | ❌ | ✅ | ❌ | ❌ |

## 4. DBスキーマ設計

### テーブル一覧

```sql
-- 法人
organizations (
  id UUID PK,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'standard', -- standard/premium/trial
  contract_status TEXT DEFAULT 'active', -- active/trial/inactive
  billing_amount INTEGER DEFAULT 0,
  billing_status TEXT DEFAULT 'pending', -- paid/pending/free
  partner_id UUID FK → partners.id,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- 営業代理店
partners (
  id UUID PK,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  created_at TIMESTAMPTZ
)

-- 施設
facilities (
  id UUID PK,
  org_id UUID FK → organizations.id NOT NULL,
  name TEXT NOT NULL,
  city TEXT,
  report_format TEXT DEFAULT 'A', -- A/B/C
  unit_count INTEGER DEFAULT 1,
  resident_count INTEGER DEFAULT 18,
  staff_count INTEGER DEFAULT 12,
  night_staff_count INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- ユーザー
users (
  id UUID PK (= auth.users.id),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL, -- super_admin/partner/org_admin/facility_admin/staff
  org_id UUID FK → organizations.id,
  facility_id UUID FK → facilities.id,
  partner_id UUID FK → partners.id,
  last_login_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- 事故報告書
accident_reports (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  user_id UUID FK → users.id NOT NULL,
  report_type TEXT DEFAULT 'accident', -- accident/incident
  resident_name TEXT,
  resident_age INTEGER,
  resident_gender TEXT,
  care_level TEXT,
  occurred_date DATE,
  occurred_time TIME,
  location TEXT,
  location_checks JSONB, -- Format C用
  cause_checks JSONB, -- Format C用
  situation TEXT,
  response TEXT,
  background TEXT,
  factors_and_measures TEXT,
  treatment_method JSONB, -- Format B用
  medical_institution TEXT, -- Format B用
  treatment_summary TEXT, -- Format B用
  reporter_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- ヒヤリハット報告書
hiyari_reports (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  user_id UUID FK → users.id NOT NULL,
  resident_name TEXT,
  occurred_date DATE,
  occurred_time TIME,
  location TEXT,
  content TEXT,
  improvement_measures JSONB,
  prevention_plan TEXT,
  reporter_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- 入居検討
admissions (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  user_id UUID FK → users.id NOT NULL,
  applicant_name TEXT,
  age INTEGER,
  gender TEXT,
  care_level TEXT,
  primary_disease TEXT,
  medical_treatments TEXT,
  adl_status TEXT,
  life_background TEXT,
  score INTEGER,
  ai_assessment TEXT,
  status TEXT DEFAULT 'reviewing', -- reviewing/accepted/declined
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- AI相談
ai_consultations (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  user_id UUID FK → users.id NOT NULL,
  user_name TEXT,
  category TEXT, -- dementia/refusal/emergency/other
  question TEXT,
  answer TEXT,
  resolved BOOLEAN,
  created_at TIMESTAMPTZ
)

-- ケア記録
care_records (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  user_id UUID FK → users.id NOT NULL,
  resident_name TEXT,
  content TEXT,
  recorder_name TEXT,
  created_at TIMESTAMPTZ
)

-- 加算管理
facility_kasans (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  kasan_type TEXT NOT NULL,
  is_acquired BOOLEAN DEFAULT false,
  progress INTEGER DEFAULT 0,
  specialist_config JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- 加算書類
kasan_documents (
  id UUID PK,
  facility_id UUID FK → facilities.id NOT NULL,
  kasan_type TEXT NOT NULL,
  template_id TEXT NOT NULL,
  document_name TEXT,
  generated_by UUID FK → users.id,
  file_url TEXT,
  created_at TIMESTAMPTZ
)

-- お知らせ
announcements (
  id UUID PK,
  title TEXT NOT NULL,
  body TEXT,
  target_org_id UUID FK → organizations.id, -- NULLなら全体
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID FK → users.id,
  created_at TIMESTAMPTZ
)

-- 監査ログ
audit_logs (
  id UUID PK,
  user_id UUID FK → users.id,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ
)

-- 資料請求
inquiries (
  id UUID PK,
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  facility_count INTEGER,
  message TEXT,
  status TEXT DEFAULT 'new', -- new/contacted/converted
  created_at TIMESTAMPTZ
)

-- 入金管理
payments (
  id UUID PK,
  org_id UUID FK → organizations.id NOT NULL,
  amount INTEGER NOT NULL,
  billing_month TEXT, -- 'YYYY-MM'
  status TEXT DEFAULT 'pending', -- pending/paid/overdue
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ
)
```

### RLSポリシー設計
```
-- staff: 自施設のデータのみ
WHERE facility_id = auth.jwt() → facility_id

-- facility_admin: 自施設のデータ
WHERE facility_id = auth.jwt() → facility_id

-- org_admin: 自法人の全施設データ
WHERE facility_id IN (SELECT id FROM facilities WHERE org_id = auth.jwt() → org_id)

-- partner: 紹介法人のデータ（閲覧のみ）
WHERE org_id IN (SELECT id FROM organizations WHERE partner_id = auth.jwt() → partner_id)

-- super_admin: 全データ
WHERE true
```

## 5. 画面一覧

### 公開ページ
| パス | 画面 |
|---|---|
| / | LP（ランディングページ） |
| /inquiry | 資料請求フォーム |
| /login | ログイン |
| /reset-password | パスワードリセット |
| /invite/accept | 招待受諾・パスワード設定 |
| /terms | 利用規約 |
| /privacy | プライバシーポリシー |

### 認証後ページ（スタッフ以上）
| パス | 画面 |
|---|---|
| /dashboard | ホーム（メインメニュー） |
| /reports/accident/new | 事故報告書作成 |
| /reports/hiyari/new | ヒヤリハット作成 |
| /reports | 報告書一覧 |
| /reports/[id] | 報告書詳細 |
| /admission | 入居検討 |
| /ai-consult | AI施設長に相談 |
| /kasan | 加算アドバイザー |
| /kasan/documents | 加算書類作成 |
| /care-records | ケア記録 |

### 施設管理者以上
| パス | 画面 |
|---|---|
| /facility-admin | 施設管理 |
| /facility-admin/users | ユーザー管理（招待・ロール変更） |

### 法人本部以上
| パス | 画面 |
|---|---|
| /org-admin | 本部管理ダッシュボード |
| /org-admin/facilities | 施設一覧・統計 |
| /org-admin/reports | 報告書集計 |
| /org-admin/users | ユーザー管理 |
| /org-admin/activity | 活動ログ |
| /org-admin/consultations | AI相談ログ |
| /org-admin/announcements | お知らせ管理 |

### NBS管理（super_admin）
| パス | 画面 |
|---|---|
| /admin | NBS管理コンソール |
| /admin/organizations | 法人管理 |
| /admin/billing | 請求・入金管理 |
| /admin/usage | 利用状況 |
| /admin/inquiries | 資料請求管理 |
| /admin/users | 全ユーザー管理 |
| /admin/audit-logs | 監査ログ |
| /admin/security | セキュリティダッシュボード |
| /admin/maintenance | メンテナンスモード |

### 代理店（partner）
| パス | 画面 |
|---|---|
| /partner | 代理店ダッシュボード |
| /partner/organizations | 紹介法人一覧 |

## 6. API設計

### 認証
- POST /api/auth/login
- POST /api/auth/register（招待受諾時）
- POST /api/auth/reset-password
- POST /api/auth/invite（管理者がユーザー招待）

### 報告書
- GET /api/reports（一覧・フィルタ）
- POST /api/reports/accident（事故報告書作成）
- POST /api/reports/hiyari（ヒヤリハット作成）
- GET /api/reports/[id]
- PUT /api/reports/[id]
- DELETE /api/reports/[id]
- GET /api/reports/export/[id]（Excel生成）

### 入居検討
- GET /api/admissions
- POST /api/admissions
- PUT /api/admissions/[id]
- POST /api/admissions/[id]/assess（AI判定）

### AI相談
- GET /api/consultations
- POST /api/consultations（質問送信・AI回答生成）
- PUT /api/consultations/[id]/feedback

### ケア記録
- GET /api/care-records
- POST /api/care-records

### 加算
- GET /api/kasan/analyze（加算分析）
- POST /api/kasan/documents/generate（書類生成）
- GET /api/kasan/documents

### 管理系
- GET/POST/PUT /api/admin/organizations
- GET/POST /api/admin/facilities
- GET/POST /api/admin/users
- POST /api/admin/users/invite
- GET /api/admin/billing
- POST /api/admin/billing/[id]/mark-paid
- GET /api/admin/audit-logs
- GET/POST /api/admin/announcements
- POST /api/admin/maintenance/toggle
- GET /api/admin/inquiries
- PUT /api/admin/inquiries/[id]

### 資料請求
- POST /api/inquiry

### ヘルス
- GET /api/health

## 7. セキュリティ設計
- データ分離: RLS（全テーブルにorg_id/facility_idフィルタ）
- 認証: Supabase Auth JWT
- API保護: Next.js Middleware + ロールチェック
- Rate Limiting: 認証エンドポイント（10回/分）
- 入力検証: zod（全APIでサーバーサイドバリデーション）
- XSS防御: React自動エスケープ + sanitize
- CSRF: Next.js Server Actions自動保護
- 監査ログ: 全API操作を記録
- 環境変数: シークレットはサーバーサイドのみ

## 8. ユーザー動線
```
LP → 資料請求フォーム送信
  → NBS管理者に通知メール
  → 管理者が法人・施設・ユーザーを作成
  → 招待メール送信（Resend）
  → ユーザーがパスワード設定
  → ログイン → ダッシュボード（ロール別メニュー表示）
```

## 9. 加算アドバイザー書類作成機能（新規追加）
現在のデモの書類テンプレートに加え、以下を完全なExcel書類として生成可能にする:
- 看取り関連: 指針・研修記録・同意書・計画書
- 口腔衛生: 管理計画書・連携協定書・ケアマニュアル
- リハビリ: 連携協定書・計画書・実施記録
- 認知症: 研修修了証台帳・ケア計画書
- 夜間支援: 勤務体制表・対応マニュアル
- 医療連携: 届出書・協定書
- サービス提供体制: 配置一覧表・研修計画
- 栄養管理: 届出書・ケア計画書

全書類をDB保存し、生成履歴の管理・再ダウンロードを可能にする。
**v2 以降は `generated_reports` テーブルに統一保存（§11 参照）。既存の `kasan_documents` はレガシー互換用に維持。**

---

## 10. Agentic L2 実行基盤（v2 / 2026-04-17 追加）

### 10.1 Agentic L2 の定義
**L2 = 承認ベース自律（Approval-gated Autonomy）**
- AIは提案まで自動生成
- 実行は必ず人間の明示的な承認が必要
- 承認後の副作用（通知送信・資料生成）はシステムが自動実行
- **例外: 家族コミュニケーションAIのみ「承認 + 手動送信ボタン」の二重ゲート**

### 10.2 6エージェント体制
| # | エージェント | agent_type | 目的 | 最低プラン |
|---|---|---|---|---|
| 1 | 加算発見AI | `kasan_discovery` | 未取得加算の発見と書類準備の提案 | Standard |
| 2 | 品質管理AI | `quality_management` | 事故・ヒヤリハットの傾向検出と対策提案 | Standard |
| 3 | 人員リスクAI | `staff_risk` | 離職リスクの予測と早期介入提案 | Enterprise |
| 4 | コンプライアンスAI | `compliance` | 法定書類の期限管理と見直し提案 | Standard |
| 5 | 家族コミュAI | `family_comm` | 家族連絡の下書き生成（送信は人間） | Standard |
| 6 | 経営AI | `management` | 施設横断KPI分析と改善提案 | Enterprise |

### 10.3 実行フロー（サマリ）
```
[日次Cron/オンデマンド]
    ↓
[6エージェントが ai_proposals INSERT (status=pending)]
    ↓
[通知配信: category=ai_proposal → facility_admin + org_admin]
    ↓
[承認UI (/dashboard 上部カード)]
    ↓
[承認] → [dispatcher] → [副作用実行] → [proposal_executions 記録]
    ↓              ↓
[通知送信]    [generated_reports 作成]
    ↓
[ai_proposals.status = executed]
```

### 10.4 家族コミュAI（二重ゲート）
他エージェントと異なり、**承認しても自動送信しない**:
```
提案生成 → [確認画面] → 本文編集 → 承認 → [送信ボタン押下] → Resendメール送信 + generated_reports(family_message_log)
```
送信記録は `proposal_executions.execution_mode = 'manual_send'` で区別。

詳細フロー: `tellur-saas/docs/agentic-flow.md`

---

## 11. 新規DBテーブル（Agentic L2 v2）

完全なCREATE文 + RLS は `tellur-saas/docs/db-agentic-v2.md` 参照。本書では概要のみ記述:

### 11.1 `ai_proposals`（新規）
AIエージェントが生成する提案の統一ストア。
- agent_type, org_id, facility_id, target_user_id, target_resident_id
- title, content, severity, status(pending/approved/rejected/executed/expired)
- reviewed_by, reviewed_at, rejection_reason, expires_at
- meta JSONB（agent別の構造化ペイロード）
- related_insight_id（既存ai_insightsとの連携）

### 11.2 `notifications`（既存を拡張）
既存の `user_id/source/agent_type/is_read` を維持しつつ、以下のカラムを追加:
- recipient_user_id, sender_type(ai/human/system), sender_user_id
- category（ai_proposal / proposal_executed / family_message / 他）
- related_resource_type, related_resource_id
- deleted_at（論理削除）

### 11.3 `generated_reports`（新規）
議事録・加算書類・看取り方針・ケア計画等の成果物履歴。
- org_id, facility_id, report_type, title, description
- related_kasan_type, related_resident_id, related_proposal_id
- generation_source(manual/ai_agent/ai_proposal), created_by
- file_url, file_format, file_size_bytes
- meta JSONB, deleted_at

### 11.4 `proposal_executions`（新規）
承認→実行の結果ログ。副作用の逆参照（notifications_sent[], reports_generated[], tasks_created[]）を保持。
- proposal_id, executed_by, execution_mode(approved/manual_send/scheduled)
- execution_status(success/partial/failed), execution_result JSONB
- notifications_sent UUID[], reports_generated UUID[], tasks_created UUID[]
- トリガー: INSERT 時に ai_proposals.status を 'executed' に自動遷移

---

## 12. RLSポリシー（Agentic L2 新規テーブル）

全テーブルで以下のロール別ポリシーを設定（既存ヘルパー `get_user_role()` / `get_user_org_id()` / `get_user_facility_id()` を活用）:

| ロール | ai_proposals | notifications | generated_reports | proposal_executions |
|---|---|---|---|---|
| super_admin | 全件 ALL | 全件 ALL | 全件 ALL | 全件 ALL |
| org_admin | 自法人 ALL | 自分 ALL | 自法人 ALL | 自法人提案 SELECT |
| facility_admin | 自施設 ALL | 自分 ALL | 自施設 ALL | 自施設提案 SELECT + INSERT |
| staff | 自施設 SELECT | 自分 ALL | 自施設 SELECT(非削除) | ❌ |
| partner | 紹介法人 SELECT | ❌ | 紹介法人 SELECT | ❌ |

詳細SQLは `tellur-saas/docs/db-agentic-v2.md` §1-4 参照。

---

## 13. プラン機能マトリクス（v2）

料金体系を **Light / Standard / Enterprise** の3プランに再構成。詳細は `tellur-saas/docs/plan-matrix.md` 参照。

### 13.1 重要ルール
- 旧「Lite」→「Light」にUI表記変更（DB値 `plan='lite'` は互換のため維持）
- **Enterprise契約時、同法人のLight施設はStandardコア機能が自動開放**（料金据え置き）
- 加算書類44種生成は **Enterprise限定**
- 人員リスクAI・経営AI は **Enterprise限定**
- 離職リスク可視化は **facility_admin + org_admin のみ閲覧可**

### 13.2 UIラベル変更
| 旧 | 新 |
|---|---|
| 加算アーカイブ | 加算の候補 |
| Lite | Light |
| アドバイザー / ダッシュボード / 入居検討 | 維持 |

---

## 14. 承認フロー詳細

### 14.1 通常提案
```
POST /api/proposals/[id]/approve
  → ai_proposals.status = 'approved'
  → dispatcher.execute(proposal)
    → agent_type 別の副作用を実行
  → proposal_executions INSERT
  → トリガーで ai_proposals.status = 'executed'
```

### 14.2 家族コミュAI（二重承認）
```
PATCH /api/proposals/[id]
  Body: { meta: { draft_text: 編集後 }, status: 'approved' }
  → ai_proposals 更新のみ（送信しない）

POST /api/proposals/[id]/send-family-message
  → Resendでメール送信
  → generated_reports(family_message_log) INSERT
  → proposal_executions INSERT (execution_mode='manual_send')
```

### 14.3 却下
```
POST /api/proposals/[id]/reject
  Body: { reason: string }
  → ai_proposals.status = 'rejected'
  → reviewed_by, reviewed_at, rejection_reason を記録
  → 副作用なし
```

---

## 15. 通知システム設計（v2）

### 15.1 カテゴリと宛先
| category | 宛先 | link先 |
|---|---|---|
| ai_proposal | facility_admin + org_admin | /dashboard?proposal=<id> |
| proposal_executed | 実行者 + 該当staff | /proposals/<id> |
| family_message | 送信者 + org_admin | /reports/family/<id> |
| kasan_opportunity | facility_admin + org_admin | /kasan?opportunity=<id> |
| compliance_alert | facility_admin + org_admin | /compliance/<id> |
| staff_risk | **facility_admin + org_admin のみ** | /staff-risk |
| report_ready | 生成依頼者 | /reports/<id> |
| announcement | 対象組織全員 | /announcements/<id> |

### 15.2 staff_risk の権限制御
`notifyStaffRisk()` は送信前に role=facility_admin/org_admin に絞り込み。staffには一切通知しない。

---

## 16. 会議資料履歴設計（v2）

`generated_reports` テーブルで議事録・加算書類・看取り方針・ケア計画・月次レポート・家族送信ログを横串管理。

### 16.1 生成元トレーサビリティ
- `generation_source`: manual / ai_agent / ai_proposal
- `related_proposal_id`: どの提案から生成されたかを逆引き可能

### 16.2 ライフサイクル
```
生成 → Supabase Storage 保存 → (Drive連携時) Drive アップロード
    → generated_reports INSERT
    → /reports 一覧で閲覧
    → 削除時は deleted_at セット（論理削除）
```

---

## 17. プラン反映バグ修正方針

### 17.1 問題
プラン変更後、タブ切り替え時に画面が古いプランのまま。

### 17.2 修正
**クライアント**: `src/hooks/usePlan.ts` に以下を追加
- `document.addEventListener('visibilitychange', refresh)`: タブ可視化時に再取得
- `window.addEventListener('focus', refresh)`: ウィンドウフォーカス時に再取得
- `window.addEventListener('storage', refresh)`: 他タブからのプラン変更通知を検知

**サーバー**: `/api/me` のレスポンスに `Cache-Control: no-store, no-cache, must-revalidate` を設定

**プラン変更側**: プラン変更API呼び出し後に `localStorage.setItem('tellur:plan-updated', Date.now())` で他タブへ通知

詳細: `tellur-saas/docs/plan-matrix.md` §4

---

## 18. 設計書ファイル一覧（v2）

| ファイル | 内容 |
|---|---|
| `ARCHITECTURE.md`（本書） | 全体設計・v2追加事項 |
| `tellur-saas/docs/db-agentic-v2.md` | 4テーブルの完全なCREATE文 + RLS |
| `tellur-saas/docs/plan-matrix.md` | プラン×機能マトリクス + 料金計算 + プラン反映バグ修正 |
| `tellur-saas/docs/agentic-flow.md` | 6エージェント仕様 + 承認フロー + 実行ディスパッチャー |
