"use client";

/**
 * «Варианты» в карточке товара (005a): вес со своей ценой, порциями и размером.
 * «Медовик целый» — 1 кг и 2 кг, у пирожного вариант один («100 г»).
 *
 * Порядок — перетаскиванием за ручку или стрелками (клавиатурная альтернатива):
 * первый вариант — по умолчанию, его показывает карточка в каталоге.
 * Вариант, который уже есть в заказах, удалить нельзя — только выключить:
 * заказ должен ссылаться на то, что купили. Удаление последнего варианта
 * недоступно — товар без вариантов нечем купить.
 *
 * Сохраняется вместе с формой («Сохранить»), а не сразу, как фото: это поля
 * товара, и отмена правок должна откатывать и их.
 */

import { ArrowDown, ArrowUp, DotsSixVertical, Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import type { DragEvent } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import { Button, Card, CardHeader, Field, IconButton, Input, Switch } from "@/components/admin/ui";
import { EMPTY_VARIANT, type ProductFormValues } from "@/lib/product-form";

export function ProductVariants({
  control,
  register,
  errors,
  inscriptionPrice,
}: {
  control: Control<ProductFormValues>;
  register: UseFormRegister<ProductFormValues>;
  errors: FieldErrors<ProductFormValues>;
  /** Цена надписи из настроек — подсказка у переключателя; null — не загрузилась */
  inscriptionPrice: number | null;
}) {
  const { fields, append, move, remove } = useFieldArray({
    control,
    name: "variants",
    keyName: "key",
  });
  const [dragging, setDragging] = useState<number | null>(null);

  function onDrop(event: DragEvent, target: number) {
    event.preventDefault();
    if (dragging !== null && dragging !== target) move(dragging, target);
    setDragging(null);
  }

  const listError = errors.variants?.root?.message ?? errors.variants?.message;

  return (
    <Card aria-labelledby="variants-title" className="flex flex-col gap-[18px]">
      <div>
        <CardHeader
          id="variants-title"
          title="Варианты"
          action={
            <Button
              variant="outline"
              size="sm"
              icon={<Plus aria-hidden="true" size={16} />}
              onClick={() => append({ ...EMPTY_VARIANT }, { shouldFocus: true })}
            >
              Добавить вариант
            </Button>
          }
        />
        <p className="text-[12.5px] text-admin-muted">
          Вес со своей ценой и порциями. Первый — по умолчанию, его покажет карточка в каталоге
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {fields.map((field, index) => {
          const fieldErrors = errors.variants?.[index];
          const number = index + 1;
          return (
            <li
              key={field.key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onDrop(event, index)}
              className={`flex gap-2.5 rounded-admin-control border border-admin-field p-3 ${
                dragging === index ? "opacity-50" : ""
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span
                  draggable
                  onDragStart={() => setDragging(index)}
                  onDragEnd={() => setDragging(null)}
                  aria-hidden="true"
                  title="Перетащите, чтобы поменять порядок"
                  className="flex size-8 cursor-grab items-center justify-center text-admin-muted active:cursor-grabbing"
                >
                  <DotsSixVertical size={18} weight="bold" />
                </span>
                <IconButton
                  label={`Поднять вариант ${number}`}
                  size="sm"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={15} />
                </IconButton>
                <IconButton
                  label={`Опустить вариант ${number}`}
                  size="sm"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={15} />
                </IconButton>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 adm-sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
                  <Field label="Подпись" hint="«1 кг», «6 шт.»" error={fieldErrors?.label?.message}>
                    {(a11y) => (
                      <Input {...a11y} {...register(`variants.${index}.label`)} maxLength={50} />
                    )}
                  </Field>
                  <Field label="Цена" error={fieldErrors?.price?.message}>
                    {(a11y) => (
                      <Input
                        {...a11y}
                        {...register(`variants.${index}.price`)}
                        inputMode="decimal"
                        suffix="₽"
                      />
                    )}
                  </Field>
                  <Field label="Вес" error={fieldErrors?.weight_grams?.message}>
                    {(a11y) => (
                      <Input
                        {...a11y}
                        {...register(`variants.${index}.weight_grams`)}
                        inputMode="numeric"
                        suffix="г"
                      />
                    )}
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 adm-sm:grid-cols-[minmax(0,0.6fr)_minmax(0,0.6fr)_minmax(0,1.8fr)]">
                  <Field label="Порций от" error={fieldErrors?.portions_min?.message}>
                    {(a11y) => (
                      <Input
                        {...a11y}
                        {...register(`variants.${index}.portions_min`)}
                        inputMode="numeric"
                      />
                    )}
                  </Field>
                  <Field label="до" error={fieldErrors?.portions_max?.message}>
                    {(a11y) => (
                      <Input
                        {...a11y}
                        {...register(`variants.${index}.portions_max`)}
                        inputMode="numeric"
                      />
                    )}
                  </Field>
                  <Field
                    label="Размер"
                    hint="«диаметр 18 см, высота 8 см»"
                    error={fieldErrors?.size_note?.message}
                    className="col-span-2 adm-sm:col-span-1"
                  >
                    {(a11y) => (
                      <Input
                        {...a11y}
                        {...register(`variants.${index}.size_note`)}
                        maxLength={100}
                      />
                    )}
                  </Field>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Controller
                    control={control}
                    name={`variants.${index}.is_active`}
                    render={({ field: toggle }) => (
                      <Switch
                        checked={toggle.value}
                        onChange={toggle.onChange}
                        label={toggle.value ? "Продаётся" : "Выключен"}
                      />
                    )}
                  />
                  {field.in_orders ? (
                    <span className="text-[12.5px] text-admin-muted">
                      Есть в заказах — удалить нельзя, только выключить
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash aria-hidden="true" size={16} />}
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                    >
                      Удалить вариант
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      {listError ? (
        <p role="alert" className="text-[13px] font-semibold text-admin-side">
          {listError}
        </p>
      ) : null}

      <Controller
        control={control}
        name="allows_inscription"
        render={({ field }) => (
          <Switch
            checked={field.value}
            onChange={field.onChange}
            label="Можно надпись на шоколадной табличке"
            description={
              inscriptionPrice === null
                ? "Цена надписи — в «Настройках»"
                : `+${inscriptionPrice.toLocaleString("ru-RU")} ₽ к цене, меняется в «Настройках»`
            }
          />
        )}
      />
    </Card>
  );
}
