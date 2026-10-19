// 出張報告書 新規作成（保存するまでデータベースには何も作らない）
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EMPTY_DOC } from "@/lib/reportContent";
import { loadSuggestions } from "@/lib/reportServer";
import ReportForm from "../ReportForm";

export default async function NewReport() {
  const me = await requireRole("applicant");
  const supabase = await createClient();
  const suggestions = await loadSuggestions(supabase);

  return (
    <ReportForm
      report={{
        id: crypto.randomUUID(),
        isNew: true,
        status: "draft",
        start_date: "",
        end_date: "",
        visits: [{ id: crypto.randomUUID(), visit_date: "", customer_name: "", contact_name: "", content: EMPTY_DOC }],
      }}
      applicantName={me.name}
      rejectComment={null}
      suggestions={suggestions}
    />
  );
}
