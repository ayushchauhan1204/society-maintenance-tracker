import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getSlaMatrix, getOpenComplaintAges, getRecurrenceSettingsForAdmin } from "@/lib/settings/queries";
import { SlaMatrixEditor } from "@/components/admin/sla-matrix-editor";
import { RecurrenceSettingsForm } from "@/components/admin/recurrence-settings-form";

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  const [slaMatrix, openComplaintAges, recurrenceSettings] = await Promise.all([
    getSlaMatrix(session),
    getOpenComplaintAges(session),
    getRecurrenceSettingsForAdmin(session),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configurable thresholds — every open complaint is re-evaluated against these immediately, with no
          backfill.
        </p>
      </div>

      <SlaMatrixEditor initialMatrix={slaMatrix} openComplaintAges={openComplaintAges} />

      <RecurrenceSettingsForm
        initialWindowDays={recurrenceSettings.windowDays}
        initialThresholdCount={recurrenceSettings.thresholdCount}
      />
    </div>
  );
}
