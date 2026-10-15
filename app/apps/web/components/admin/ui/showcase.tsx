"use client";

/**
 * Витрина UI-кита админки для /dev/components (раздел «Админка»): все варианты
 * и состояния. Hover и нажатие видно живьём; «нажатое» и «загрузка» показаны
 * отдельными экземплярами.
 */

import { EnvelopeSimple, Plus, Trash, Tray, Truck, Storefront } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  ChipToggle,
  ConfirmDialog,
  Delta,
  EmptyState,
  Field,
  IconButton,
  Input,
  Notice,
  Pagination,
  Pill,
  RadioCard,
  SegmentedTabs,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Textarea,
  ToastProvider,
  useToast,
} from "@/components/admin/ui";

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11.5px] font-bold tracking-[0.1em] text-admin-muted uppercase">{title}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Toasts() {
  const toast = useToast();
  return (
    <>
      <Button variant="soft" onClick={() => toast.success("Отзыв опубликован на сайте")}>
        Тост: успех
      </Button>
      <Button
        variant="soft"
        onClick={() => toast.error("Не удалось сохранить. Попробуйте ещё раз")}
      >
        Тост: ошибка
      </Button>
    </>
  );
}

function Kit() {
  const [tab, setTab] = useState<"week" | "month">("week");
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [enabled, setEnabled] = useState(true);
  const [method, setMethod] = useState("pickup");
  const [chips, setChips] = useState<Record<string, boolean>>({ birthday: true, wedding: false });
  const [page, setPage] = useState(5);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex flex-col gap-8 rounded-admin-panel bg-admin-panel p-8 font-sans text-admin-ink">
      <Row title="Кнопки: варианты">
        <Button icon={<Plus aria-hidden="true" size={18} weight="bold" />}>Новый товар</Button>
        <Button variant="soft">Мягкая</Button>
        <Button variant="outline">Контурная</Button>
        <Button variant="ghost">Прозрачная</Button>
        <Button variant="danger" icon={<Trash aria-hidden="true" size={18} />}>
          Удалить
        </Button>
      </Row>
      <Row title="Кнопки: размеры и состояния">
        <Button size="sm">Маленькая</Button>
        <Button size="md">Средняя</Button>
        <Button size="lg">Большая</Button>
        <Button loading>Сохраняем</Button>
        <Button disabled>Недоступна</Button>
        <Button variant="outline" className="translate-y-px">
          Нажатая
        </Button>
        <IconButton label="Удалить фото">
          <Trash size={18} />
        </IconButton>
        <IconButton label="Удалить фото" tone="soft">
          <Trash size={18} />
        </IconButton>
      </Row>

      <div className="grid gap-5 adm-lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Поля" action={<Badge tone="green">Карточка</Badge>} />
          <Field label="E-mail" hint="На него придёт письмо о заказе">
            {(a11y) => (
              <Input {...a11y} icon={<EnvelopeSimple size={18} />} placeholder="name@example.com" />
            )}
          </Field>
          <Field label="Цена" error="Укажите цену больше нуля">
            {(a11y) => <Input {...a11y} defaultValue="0" suffix="₽" inputMode="numeric" />}
          </Field>
          <Field label="Раздел">
            {(a11y) => (
              <Select {...a11y} defaultValue="cakes">
                <option value="cakes">Торты</option>
                <option value="bento">Бенто</option>
              </Select>
            )}
          </Field>
          <Field label="Описание">
            {(a11y) => <Textarea {...a11y} defaultValue="Медовые коржи и сметанный крем" />}
          </Field>
          <Field label="Недоступное поле">
            {(a11y) => <Input {...a11y} disabled defaultValue="Только чтение" />}
          </Field>
        </Card>
        <Card className="flex flex-col gap-4">
          <CardHeader title="Выбор" />
          <Switch
            checked={enabled}
            onChange={setEnabled}
            label="Показывать на сайте"
            description="Выключенный товар виден только в админке"
          />
          <Switch checked={false} onChange={() => {}} label="Недоступный переключатель" disabled />
          <div
            className="grid gap-3 adm-sm:grid-cols-2"
            role="radiogroup"
            aria-label="Способ получения"
          >
            <RadioCard
              name="method"
              value="pickup"
              checked={method === "pickup"}
              onChange={setMethod}
              title="Самовывоз"
              description="Гжатская, 21"
              icon={<Storefront size={20} />}
            />
            <RadioCard
              name="method"
              value="delivery"
              checked={method === "delivery"}
              onChange={setMethod}
              title="Доставка"
              description="По Москве, от 500 ₽"
              icon={<Truck size={20} />}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries({ birthday: "День рождения", wedding: "Свадьба" }).map(
              ([key, label]) => (
                <ChipToggle
                  key={key}
                  pressed={Boolean(chips[key])}
                  onChange={(next) => setChips((current) => ({ ...current, [key]: next }))}
                >
                  {label}
                </ChipToggle>
              ),
            )}
            <ChipToggle pressed={false} onChange={() => {}} disabled>
              Недоступный
            </ChipToggle>
          </div>
          <Pill>Включён Caps Lock</Pill>
          <Notice role="note">Плашка ошибки или блокировки</Notice>
          <Notice tone="amber" role="note">
            Предупреждение: фото меньше 1200 px
          </Notice>
        </Card>
      </div>

      <Row title="Статусы заказа и заявки">
        {(["new", "confirmed", "in_progress", "ready", "completed", "cancelled"] as const).map(
          (status) => (
            <StatusBadge key={status} kind="order" status={status} />
          ),
        )}
        {(["new", "contacted", "completed"] as const).map((status) => (
          <StatusBadge key={status} kind="consultation" status={status} />
        ))}
      </Row>
      <Row title="Метки, изменения, аватары">
        <Badge tone="green">В наличии</Badge>
        <Badge tone="amber">Под заказ, 2 дня</Badge>
        <Badge tone="accent">Нет в наличии</Badge>
        <Delta value={12} suffix="%" label="на 12% больше" />
        <Delta value={-3} label="на 3 меньше" />
        <Delta value={2} positive="down" label="отмен на 2 больше" />
        <Delta value={0} />
        <Avatar name="Ирина Волкова" />
        <Avatar name="Елена Абрикосова" tone="side" />
        <Avatar name="Анна К" size="sm" />
      </Row>
      <Row title="Вкладки и пагинация">
        <SegmentedTabs
          label="Период"
          value={tab}
          onChange={setTab}
          options={[
            { value: "week", label: "Неделя" },
            { value: "month", label: "Месяц" },
          ]}
        />
        <SegmentedTabs
          label="День"
          surface="card"
          value={day}
          onChange={setDay}
          options={[
            { value: "today", label: "Сегодня · 5" },
            { value: "tomorrow", label: "Завтра · 3" },
          ]}
        />
        <Pagination page={page} pages={12} onChange={setPage} />
      </Row>

      <div className="grid gap-5 adm-lg:grid-cols-3">
        <Card padding="sm">
          <EmptyState
            icon={<Tray size={24} />}
            title="Сегодня выдач нет"
            text="Заказы с желаемой датой появятся здесь сами"
            action={
              <Button variant="outline" size="sm">
                Все заказы
              </Button>
            }
          />
        </Card>
        <Card className="flex flex-col gap-3" aria-label="Загрузка">
          <Skeleton className="h-11 w-11" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-16 w-full" />
        </Card>
        <Card className="flex flex-col items-start gap-3">
          <CardHeader title="Тосты и подтверждение" />
          <Toasts />
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Удалить товар
          </Button>
          <ConfirmDialog
            open={confirm}
            title="Удалить «Медовик»?"
            text="Товар пропадёт с сайта. Заказы с ним останутся в истории."
            onConfirm={() => setConfirm(false)}
            onClose={() => setConfirm(false)}
          />
        </Card>
      </div>
    </div>
  );
}

export function AdminKitShowcase() {
  return (
    <ToastProvider>
      <Kit />
    </ToastProvider>
  );
}
