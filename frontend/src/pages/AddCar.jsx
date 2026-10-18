import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import VehicleForm from "../components/VehicleForm";

export default function AddCar() {
  return (
    <div className="stack-lg narrow">
      <PageHeader back={{ to: "/", label: "Garage" }} title="Add a vehicle" />
      <Card>
        <VehicleForm />
      </Card>
    </div>
  );
}
