import { useLocation, useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ErrorState from "../components/ui/ErrorState";
import { SkeletonCard } from "../components/ui/Skeleton";
import ServiceForm from "../components/ServiceForm";

export default function EditRecord() {
  const { id, recordId } = useParams();
  const location = useLocation();
  const fromState = location.state?.rec && String(location.state.rec.id) === String(recordId) ? location.state.rec : null;

  const { data, error, loading, reload } = useAsync(async () => {
    if (fromState) return fromState;
    const records = await api.getRecords(id);
    const rec = records.find((r) => String(r.id) === String(recordId));
    if (!rec) {
      const e = new Error("Service record not found");
      e.status = 404;
      throw e;
    }
    return rec;
  }, [id, recordId]);

  return (
    <div className="stack-lg narrow">
      <PageHeader back={{ to: `/car/${id}`, label: "Vehicle" }} title="Edit service" />
      {error ? (
        <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
      ) : loading || !data ? (
        <SkeletonCard lines={6} />
      ) : (
        <Card>
          <ServiceForm key={data.id} carId={id} record={data} />
        </Card>
      )}
    </div>
  );
}
