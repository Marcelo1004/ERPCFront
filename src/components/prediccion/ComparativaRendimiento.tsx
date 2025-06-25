import React from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ComparativoRendimiento } from '@/types/academic';
import { Loader2, BarChart3 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ComparativaRendimientoProps {
  data: ComparativoRendimiento | undefined;
  isLoading: boolean;
}


const getDiferenciaColor = (diferencia: number) => {
  if (diferencia > 5) return 'text-green-600';
  if (diferencia < -5) return 'text-red-600';
  return 'text-amber-500'; // Diferencia pequeña
};

// Función para obtener el color de la insignia basado en el nivel predicho
const getNivelColor = (nivel: string) => {
  switch (nivel.toUpperCase()) {
    case 'ALTO':
      return 'bg-green-100 text-green-800';
    case 'MEDIO':
      return 'bg-yellow-100 text-yellow-800';
    case 'BAJO':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const ComparativaRendimiento: React.FC<ComparativaRendimientoProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-academic-purple" />
        <span className="ml-2">Cargando datos de comparativa...</span>
      </div>
    );
  }

  if (!data || !data.comparaciones || data.comparaciones.length === 0) {
    return (
      <Alert className="bg-blue-50 border-blue-200">
        <BarChart3 className="h-5 w-5 text-blue-500" />
        <AlertTitle>No hay datos de comparativa disponibles</AlertTitle>
        <AlertDescription>
          Aún no hay suficientes datos para mostrar una comparativa entre notas reales y notas predichas.
          Se requieren predicciones que ya tengan notas reales registradas para generar esta comparativa.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center">
          <div>
            <CardTitle className="text-2xl font-bold">Comparativa de Rendimiento</CardTitle>
            <CardDescription>
              Análisis comparativo entre las notas predichas por el modelo y las notas reales
            </CardDescription>
          </div>
          <div className="flex flex-col mt-4 md:mt-0 md:items-end">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 mr-2">Precisión del modelo:</span>
              <Badge variant="outline" className="bg-academic-purple/10 border-academic-purple text-academic-purple">
                {data.precision_modelo.toFixed(2)}%
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Basado en {data.total_predicciones} predicciones completadas
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableCaption>
              Comparativa de {data.comparaciones.length} predicciones con notas reales registradas
            </TableCaption>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Estudiante</TableHead>
                <TableHead>Materia</TableHead>
                <TableHead className="text-center">Nota Predicha</TableHead>
                <TableHead className="text-center">Nota Real</TableHead>
                <TableHead className="text-center">Diferencia</TableHead>
                <TableHead>Nivel Predicho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.comparaciones.map((comp, index) => (
                <TableRow key={`${comp.estudiante_id}-${comp.materia_id}-${index}`}>
                  <TableCell className="font-medium">{comp.estudiante_nombre}</TableCell>
                  <TableCell>{comp.materia_nombre}</TableCell>
                  <TableCell className="text-center">{comp.nota_predicha.toFixed(2)}</TableCell>
                  <TableCell className="text-center font-medium">{comp.nota_real.toFixed(2)}</TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${getDiferenciaColor(comp.diferencia)}`}>
                      {comp.diferencia > 0 && "+"}{comp.diferencia.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${getNivelColor(comp.nivel_predicho)}`}>
                      {comp.nivel_predicho}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg border text-sm">
          <h4 className="font-medium mb-1">¿Cómo interpretar esta comparativa?</h4>
          <ul className="list-disc pl-5 space-y-1">
            <li>La <b>diferencia</b> muestra cuánto varía la nota real de la predicción (positivo significa que la nota real fue mayor).</li>
            <li>Un modelo de alta precisión tendrá diferencias cercanas a cero.</li>
            <li>La precisión global del modelo indica qué tan acertadas son las predicciones en general.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ComparativaRendimiento;
