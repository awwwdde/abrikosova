import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Согласие на обработку персональных данных",
  description:
    "Кто обрабатывает ваши данные из форм заказа и заявки, какие, зачем, сколько хранит и как отозвать согласие.",
  path: "/consent",
});

export default function ConsentPage() {
  return <LegalPage document="consent" />;
}
