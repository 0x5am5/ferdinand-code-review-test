import { Redirect, useParams } from "wouter";

export default function ClientPage() {
  const { id } = useParams();
  return <Redirect to={`/client/${id}/logos`} />;
}