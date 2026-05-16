import ReportDetail from "@/components/ReportDetail";

type Props = { params: { periodKey: string } };

export default function ReportDetailPage({ params }: Props) {
  return <ReportDetail periodKey={params.periodKey} />;
}
