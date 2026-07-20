import { redirect } from "next/navigation";

/** Default landing page — Operations Dashboard. */
export default function HomePage() {
  redirect("/dashboard");
}
