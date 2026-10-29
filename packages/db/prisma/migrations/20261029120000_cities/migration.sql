-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- Oblast centres outside the occupied territories + the largest cities of each oblast.
INSERT INTO "City" ("id", "name", "region") VALUES
  ('kyiv', 'Київ', 'Київ'),
  ('bila-tserkva', 'Біла Церква', 'Київська'),
  ('brovary', 'Бровари', 'Київська'),
  ('boryspil', 'Бориспіль', 'Київська'),
  ('irpin', 'Ірпінь', 'Київська'),
  ('vinnytsia', 'Вінниця', 'Вінницька'),
  ('lutsk', 'Луцьк', 'Волинська'),
  ('kovel', 'Ковель', 'Волинська'),
  ('dnipro', 'Дніпро', 'Дніпропетровська'),
  ('kryvyi-rih', 'Кривий Ріг', 'Дніпропетровська'),
  ('kamianske', 'Кам''янське', 'Дніпропетровська'),
  ('nikopol', 'Нікополь', 'Дніпропетровська'),
  ('pavlohrad', 'Павлоград', 'Дніпропетровська'),
  ('kramatorsk', 'Краматорськ', 'Донецька'),
  ('sloviansk', 'Слов''янськ', 'Донецька'),
  ('zhytomyr', 'Житомир', 'Житомирська'),
  ('berdychiv', 'Бердичів', 'Житомирська'),
  ('uzhhorod', 'Ужгород', 'Закарпатська'),
  ('mukachevo', 'Мукачево', 'Закарпатська'),
  ('zaporizhzhia', 'Запоріжжя', 'Запорізька'),
  ('ivano-frankivsk', 'Івано-Франківськ', 'Івано-Франківська'),
  ('kalush', 'Калуш', 'Івано-Франківська'),
  ('kolomyia', 'Коломия', 'Івано-Франківська'),
  ('kropyvnytskyi', 'Кропивницький', 'Кіровоградська'),
  ('oleksandriia', 'Олександрія', 'Кіровоградська'),
  ('lviv', 'Львів', 'Львівська'),
  ('drohobych', 'Дрогобич', 'Львівська'),
  ('sheptytskyi', 'Шептицький', 'Львівська'),
  ('mykolaiv', 'Миколаїв', 'Миколаївська'),
  ('pervomaisk', 'Первомайськ', 'Миколаївська'),
  ('odesa', 'Одеса', 'Одеська'),
  ('izmail', 'Ізмаїл', 'Одеська'),
  ('chornomorsk', 'Чорноморськ', 'Одеська'),
  ('bilhorod-dnistrovskyi', 'Білгород-Дністровський', 'Одеська'),
  ('poltava', 'Полтава', 'Полтавська'),
  ('kremenchuk', 'Кременчук', 'Полтавська'),
  ('rivne', 'Рівне', 'Рівненська'),
  ('sumy', 'Суми', 'Сумська'),
  ('konotop', 'Конотоп', 'Сумська'),
  ('shostka', 'Шостка', 'Сумська'),
  ('ternopil', 'Тернопіль', 'Тернопільська'),
  ('kharkiv', 'Харків', 'Харківська'),
  ('lozova', 'Лозова', 'Харківська'),
  ('kherson', 'Херсон', 'Херсонська'),
  ('khmelnytskyi', 'Хмельницький', 'Хмельницька'),
  ('kamianets-podilskyi', 'Кам''янець-Подільський', 'Хмельницька'),
  ('cherkasy', 'Черкаси', 'Черкаська'),
  ('uman', 'Умань', 'Черкаська'),
  ('chernivtsi', 'Чернівці', 'Чернівецька'),
  ('chernihiv', 'Чернігів', 'Чернігівська'),
  ('nizhyn', 'Ніжин', 'Чернігівська');

-- Users: everyone (existing and new) is based in Kyiv until they change it.
ALTER TABLE "User" ADD COLUMN "cityId" TEXT NOT NULL DEFAULT 'kyiv';

-- Venues: free-text city -> City. Match by name (or the old English "Kyiv"),
-- anything unrecognised falls back to Kyiv.
ALTER TABLE "Venue" ADD COLUMN "cityId" TEXT;
UPDATE "Venue" v SET "cityId" = c."id"
  FROM "City" c WHERE lower(trim(v."city")) = lower(c."name");
UPDATE "Venue" SET "cityId" = 'kyiv'
  WHERE "cityId" IS NULL OR lower(trim("city")) IN ('kyiv', 'kiev', 'киев');
ALTER TABLE "Venue" ALTER COLUMN "cityId" SET NOT NULL;
ALTER TABLE "Venue" DROP COLUMN "city";

-- CreateIndex
CREATE INDEX "User_cityId_idx" ON "User"("cityId");

-- CreateIndex
CREATE INDEX "Venue_cityId_idx" ON "Venue"("cityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Venue" ADD CONSTRAINT "Venue_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
