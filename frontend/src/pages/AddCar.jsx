import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import VehicleForm from "../components/VehicleForm";
import { t } from "../i18n";

export default function AddCar() {
  return (
    <div className="stack-lg narrow">
      <PageHeader
        back={{ to: "/", label: t("Garage") }}
        title={t("Add a vehicle")}
        subtitle={t("Start tracking services, costs and upcoming maintenance.")}
      />
      <Card>
        <VehicleForm />
      </Card>
    </div>
  );
}
