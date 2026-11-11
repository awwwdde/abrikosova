import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Политика конфиденциальности",
  description: "Какие данные собирает сайт кондитерской Елены Абрикосовой, зачем и как их удалить.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return <LegalPage document="privacy" />;
}
