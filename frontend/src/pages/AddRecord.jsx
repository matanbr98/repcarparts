import { useParams } from "react-router-dom";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { vehicleTitle } from "../lib/format";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import ServiceForm from "../components/ServiceForm";
import { t } from "../i18n";

export default function AddRecord() {
  const { id } = useParams();
  const car = useAsync(() => api.getCar(id), [id]);
  const name = car.data ? vehicleTitle(car.data) : "";
  return (
    <div className="stack-lg narrow">
      <PageHeader
        back={{ to: `/car/${id}`, label: name || t("Vehicle") }}
        title={t("Log a service")}
        subtitle={name ? t("Record work done on {name}.", { name }) : t("Record work done on this vehicle.")}
      />
      <Card>
        <ServiceForm carId={id} />
      </Card>
    </div>
  );
}
