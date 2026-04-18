import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SettingsPlaceholderPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ajustes</CardTitle>
        <CardDescription>
          Precisión GPS, descarga de mapas y preferencias: más adelante en el
          spec.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
