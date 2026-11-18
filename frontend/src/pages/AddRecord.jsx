import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { vehicleTitle } from "../lib/format";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ServiceForm from "../components/ServiceForm";

export default function AddRecord() {
  const { id } = useParams();
  const car = useAsync(() => api.getCar(id), [id]);
  const name = car.data ? vehicleTitle(car.data) : "";
  return (
    <div className="stack-lg narrow">
      <PageHeader
        back={{ to: `/car/${id}`, label: name || "Vehicle" }}
        title="Log a service"
        subtitle={name ? `Record work done on ${name}.` : "Record work done on this vehicle."}
      />
      <Card>
        <ServiceForm carId={id} />
      </Card>
    </div>
  );
}
