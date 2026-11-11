import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Пользовательское соглашение",
  description:
    "Условия заказа, оплаты, доставки и возврата на сайте кондитерской Елены Абрикосовой.",
  path: "/terms",
});

export default function TermsPage() {
  return <LegalPage document="terms" />;
}
