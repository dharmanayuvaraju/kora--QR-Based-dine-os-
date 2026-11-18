import { CustomerDiningApp } from "@/components/CustomerDiningApp";

export default async function TableQrMenuPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <CustomerDiningApp qrToken={token} />;
}
