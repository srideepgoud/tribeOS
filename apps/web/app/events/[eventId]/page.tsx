import { redirect } from "next/navigation";

interface EventIndexPageProps {
  params: Promise<{ eventId: string }>;
}

export default async function EventIndexPage({ params }: EventIndexPageProps) {
  const { eventId } = await params;
  redirect(`/events/${eventId}/overview`);
}
