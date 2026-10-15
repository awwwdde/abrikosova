import { describe, expect, it } from "vitest";
import {
  formatDayShort,
  formatDesignMeta,
  formatLongDate,
  telegramHandle,
  typograf,
} from "./format";

/** Для читаемости ожиданий: «~» в образце — неразрывный пробел. */
const nb = (s: string) => s.replaceAll("~", " ");

describe("typograf", () => {
  it("склеивает однобуквенный предлог со следующим словом", () => {
    expect(typograf("Поэтому в составе")).toBe(nb("Поэтому в~составе"));
  });

  it("склеивает двухбуквенные слова: на, по, не, от", () => {
    expect(typograf("торт на заказ по вашей дате не позже чем от трёх дней")).toBe(
      nb("торт на~заказ по~вашей дате не~позже чем от~трёх дней"),
    );
  });

  it("обрабатывает подряд идущие короткие слова", () => {
    expect(typograf("и в доме")).toBe(nb("и~в~доме"));
    expect(typograf("а у нас")).toBe(nb("а~у~нас"));
  });

  it("не зависит от регистра и начала строки", () => {
    expect(typograf("В составе и К чаю")).toBe(nb("В~составе и~К~чаю"));
  });

  it("срабатывает после «, скобки и тире", () => {
    expect(typograf("«Я готовлю")).toBe(nb("«Я~готовлю"));
    expect(typograf("(в наличии)")).toBe(nb("(в~наличии)"));
    expect(typograf("вкус—и цвет")).toBe(nb("вкус—и~цвет"));
  });

  it("приклеивает частицы ли, же, бы к предыдущему слову, но не к следующему", () => {
    expect(typograf("как готовила бы для своей")).toBe(nb("как готовила~бы для своей"));
    expect(typograf("Можно ли изменить")).toBe(nb("Можно~ли изменить"));
    expect(typograf("тот же день")).toBe(nb("тот~же день"));
  });

  it("частицы — только строчные: «Ли» в имени не частица", () => {
    // «Ли» — обычное короткое слово: клеится вперёд, а не к «Сказал»
    expect(typograf("Сказал Ли Мин")).toBe(nb("Сказал Ли~Мин"));
  });

  it("склеивает инициалы между собой и с фамилией", () => {
    expect(typograf("Е. О.")).toBe(nb("Е.~О."));
    expect(typograf("ИП Абрикосова Е. О., ОГРНИП")).toBe(nb("ИП~Абрикосова~Е.~О., ОГРНИП"));
    expect(typograf("Е. О. Абрикосова")).toBe(nb("Е.~О.~Абрикосова"));
  });

  it("склеивает имя с инициалом фамилии в подписи отзыва", () => {
    expect(typograf("Артём Б. · май 2026")).toBe(nb("Артём~Б. · май 2026"));
  });

  it("не принимает конец предложения за инициал", () => {
    // «В» — предлог следующего предложения: клеится вперёд, но не к «торт.»
    expect(typograf("Это торт. В составе мёд")).toBe(nb("Это торт. В~составе мёд"));
  });

  it("не считает часть слова через дефис коротким словом", () => {
    // «то» в «кто-то» — не отдельное слово; «из» — отдельное
    expect(typograf("кто-то из друзей")).toBe(nb("кто-то из~друзей"));
    expect(typograf("по-моему это вкусно")).toBe("по-моему это вкусно");
  });

  it("не отрывает число от слова", () => {
    expect(typograf("12 лет в профессии")).toBe(nb("12~лет в~профессии"));
    expect(typograf("вес 5 кг, срок 3 дня")).toBe(nb("вес 5~кг, срок 3~дня"));
  });

  it("не начинает строку с тире", () => {
    expect(typograf("Торт — это праздник")).toBe(nb("Торт~— это праздник"));
  });

  it("не трогает двойные и уже неразрывные пробелы", () => {
    expect(typograf("в  доме")).toBe("в  доме");
    expect(typograf(nb("в~доме"))).toBe(nb("в~доме"));
  });

  it("идемпотентна", () => {
    for (const text of [
      "И в доме, и на даче — 12 лет готовила бы от 3 дней",
      "как готовила бы для своей",
      "ИП Абрикосова Е. О., ОГРНИП",
      "Е. О. Абрикосова",
      "Артём Б. · май 2026",
      "Это торт. В составе мёд",
      "кто-то из друзей",
      "Сказал Ли Мин",
    ]) {
      expect(typograf(typograf(text))).toBe(typograf(text));
    }
  });

  it("не портит латиницу, e-mail и URL", () => {
    expect(typograf("a b to go")).toBe("a b to go");
    expect(typograf("пишите на a@b.ru или https://t.me/x")).toBe(
      nb("пишите на~a@b.ru или https://t.me/x"),
    );
  });

  it("не ломает телефон", () => {
    expect(typograf("+7 962 352-22-77")).toBe("+7 962 352-22-77");
  });

  it("не склеивает обычные длинные слова", () => {
    expect(typograf("Торт собирается к дате")).toBe(nb("Торт собирается к~дате"));
  });

  it("пропускает пустые значения", () => {
    expect(typograf("")).toBe("");
    expect(typograf(null)).toBeNull();
    expect(typograf(undefined)).toBeUndefined();
  });
});

describe("formatDayShort", () => {
  it("число, месяц и день недели без точек", () => {
    expect(formatDayShort("2026-10-02")).toBe("2 окт, пт");
    expect(formatDayShort("2026-05-15")).toBe("15 мая, пт");
  });
});

describe("formatLongDate", () => {
  it("дата редакции документа", () => {
    expect(formatLongDate("2026-10-01")).toBe("1 октября 2026 года");
    expect(formatLongDate("2026-12-31")).toBe("31 декабря 2026 года");
  });
  it("не дата — null, строка не показывается", () => {
    expect(formatLongDate(null)).toBeNull();
    expect(formatLongDate("2026-13-01")).toBeNull();
    expect(formatLongDate("01.10.2026")).toBeNull();
  });
});

describe("telegramHandle", () => {
  it("имя из ссылки", () => {
    expect(telegramHandle("https://t.me/abricosova_elena")).toBe("@abricosova_elena");
    expect(telegramHandle("https://t.me/abricosova_elena/")).toBe("@abricosova_elena");
    expect(telegramHandle(" https://telegram.me/Abricosova_Elena?start=1 ")).toBe(
      "@Abricosova_Elena",
    );
  });
  it("кривой адрес из админки не роняет страницу", () => {
    expect(telegramHandle("t.me/elena")).toBeNull();
    expect(telegramHandle("https://")).toBeNull();
    expect(telegramHandle("не ссылка")).toBeNull();
    expect(telegramHandle("https://example.com/elena")).toBeNull();
    expect(telegramHandle(null)).toBeNull();
  });
});

describe("formatDesignMeta (008b)", () => {
  it("ярусы и «от N гостей» в родительном падеже", () => {
    expect(formatDesignMeta(3, 40)).toBe("3 яруса · от 40 гостей");
    expect(formatDesignMeta(1, 21)).toBe("1 ярус · от 21 гостя");
    expect(formatDesignMeta(5, 13)).toBe("5 ярусов · от 13 гостей");
  });
});
