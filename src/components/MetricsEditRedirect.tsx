import { Navigate, useParams } from "react-router-dom";

export default function MetricsEditRedirect() {
  const { formId } = useParams<{ formId: string }>();
  return <Navigate to={`/metrics/edit/${formId}`} replace />;
}