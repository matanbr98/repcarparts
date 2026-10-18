import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ErrorState from "../components/ui/ErrorState";
import { SkeletonCard } from "../components/ui/Skeleton";
import VehicleForm from "../components/VehicleForm";

export default function EditCar() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => api.getCar(id), [id]);

  return (
    <div className="stack-lg narrow">
      <PageHeader back={{ to: `/car/${id}`, label: "Vehicle" }} title="Edit vehicle" />
      {error ? (
        <ErrorState error={error} onRetry={error.status === 404 ? undefined : reload} />
      ) : loading || !data ? (
        <SkeletonCard lines={5} />
      ) : (
        <Card>
          <VehicleForm key={data.id} car={data} />
        </Card>
      )}
    </div>
  );
}
