// データベースのスキーマと表・関数の名前
//   研修中は at-kowa プロジェクトを他の人と共用するため、専用のスキーマ trip_report に作っている
//   （schema_at-kowa.sql と対応。接続は supabase/*.ts でこのスキーマを指定する。専用のプロジェクトへ移すときは "public" にする）
export const SCHEMA = "trip_report";

export const T = {
  profiles: "profiles",
  approvalRoutes: "approval_routes",
  reports: "reports",
  reportRouteSteps: "report_route_steps",
  visits: "visits",
  photos: "photos",
  approvalHistory: "approval_history",
} as const;

// 関数（supabase.rpc で呼ぶもの）
export const F = {
  myCounts: "my_counts",
  canEditReport: "can_edit_report",
  submitReport: "submit_report",
  withdrawReport: "withdraw_report",
  approveReport: "approve_report",
  rejectReport: "reject_report",
  suggestVisitNames: "suggest_visit_names",
  dashboardStats: "dashboard_stats",
  photoStorageUsage: "photo_storage_usage",
  adminImportRoutes: "admin_import_routes",
} as const;

// 写真の保存領域（Storage のバケット）
export const PHOTO_BUCKET = "s-seki-report-photos";
