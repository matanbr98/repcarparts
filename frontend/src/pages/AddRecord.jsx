import { useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ServiceForm from "../components/ServiceForm";

export default function AddRecord() {
  const { id } = useParams();
  return (
    <div className="stack-lg narrow">
      <PageHeader back={{ to: `/car/${id}`, label: "Vehicle" }} title="Log a service" />
      <Card>
        <ServiceForm carId={id} />
      </Card>
    </div>
  );
}
