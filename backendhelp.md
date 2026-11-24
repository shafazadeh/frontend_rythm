# راهنمای جامع پیاده‌سازی بک‌اند و دیتابیس اپلیکیشن «ریتم» (Rhythm Backend & Database Spec)

این سند مرجع کامل برای پیاده‌سازی سرویس بک‌اند، احراز هویت، پایگاه‌داده رابطه‌ای (**PostgreSQL 16+**) و **REST API** اپلیکیشن «ریتم» است تا لایه فعلی `MockRhythmRepository` در فرانت‌اند بدون تغییر در UI یا منطق نمایش، به یک بک‌اند واقعی و چندکاربره متصل شود.

---

## ۱. معماری کلی، پیش‌نیازهای فنی و تصمیمات دیتابیس

### ۱.۱. پشته پیشنهادی سرور و دیتابیس
- **دیتابیس اصلی**: `PostgreSQL 16+` (رابطه‌ای با پشتیبانی بومی از `ENUM`، `JSONB`، `TIMESTAMPTZ`، `NUMERIC` و `Array` برای انعطاف در اسنپ‌شات‌ها و ساختارهای تو در تو).
- **ORM / Migration**: `Drizzle ORM` یا `Prisma` (همراه با `node-postgres` / `pg`).
- **لایه API**: RESTful JSON API تحت پیشوند `/api/v1` (روی `Express` یا `Fastify` در `server.ts` یا میکروسرویس مستقل) با اعتبارسنجی ورودی از طریق همان قوانین **Zod** موجود در `src/shared/validation/schemas.ts` و `src/shared/validation/workoutSchemas.ts`.
- **احراز هویت و چندکاربره‌بودن (Multi-Tenancy)**: در نسخه Mock فعلی داده‌ها تک‌کاربره هستند، اما در دیتابیس واقعی تمام جداول داده‌ای باید ستون `user_id` (کلید خارجی به `users.id` با `ON DELETE CASCADE`) داشته باشند و تمام اندپوینت‌ها مالکیت رکورد را با توکن کاربر (`JWT` / `Session`) چک کنند.
- **زمان و منطقه زمانی**:
  - تمام ستون‌های زمانی سیستمی (`created_at`, `updated_at`, `started_at`, `ended_at`, `confirmed_at`) از نوع `TIMESTAMPTZ` (ذخیره به UTC) باشند.
  - تاریخ‌های تقویمی روز (`date_iso`, `week_start_iso`, `expiry_date_iso`) از نوع `DATE` (یا `CHAR(10)` با فرمت `YYYY-MM-DD` میلادی) ذخیره شوند؛ تبدیل به تاریخ شمسی بر اساس منطقه زمانی پروفایل کاربر (`timezone`، پیش‌فرض `Asia/Tehran`) انجام می‌شود.
  - ساعت‌های روزانه (`start_time`, `end_time`, `time_of_day`, `suggested_time`) به فرمت ۲۴ ساعته `HH:mm` (`VARCHAR(5)` با قید regex `^([01]\d|2[0-3]):([0-5]\d)$`) ذخیره شوند.
  - قرارداد روزهای هفته شمسی (`day_index` / `day_of_week`): عدد صحیح `0` تا `6` که **`0 = شنبه`** و **`6 = جمعه`** است.
- **پوشش ماژول‌های آینده در دیتابیس**:
  - جداول `external_connections` (برای اتصال آینده **Google Calendar OAuth** و **Telegram Bot**) و `notification_delivery_logs` (برای جلوگیری از ارسال تکراری اعلان‌ها توسط Worker) از همین ابتدا در اسکیما پیش‌بینی شده‌اند تا در فاز بعدی نیازی به بازطراحی جداول پایه نباشد.

---

## ۲. فهرست کامل Enumها (PostgreSQL ENUM & TypeScript Unions)

تمام `Enum`های زیر باید دقیقاً با همین مقادیر رشته‌ای در دیتابیس و قرارداد API تعریف شوند (تغییر حروف بزرگ/کوچک با فرانت‌اند ناسازگار خواهد بود):

### ۲.۱. Enumهای هسته، تغذیه، موجودی و خرید
| نام Enum | مقادیر دقیق | توضیح |
|---|---|---|
| `unit_type` | `'g'`, `'kg'`, `'ml'`, `'l'`, `'piece'`, `'tbsp'`, `'tsp'`, `'cup'`, `'slice'`, `'pack'` | واحدهای اندازه‌گیری مواد غذایی و خرید |
| `meal_slot_type` | `'BREAKFAST'`, `'MORNING_SNACK'`, `'LUNCH'`, `'AFTERNOON_SNACK'`, `'DINNER'` | اسلات‌های وعده و میان‌وعده روزانه |
| `weekly_plan_status` | `'DRAFT'`, `'REVIEWING'`, `'CONFIRMED'`, `'ARCHIVED'` | وضعیت برنامه غذایی هفتگی |
| `daily_plan_status` | `'UNPLANNED'`, `'DRAFT'`, `'IN_REVIEW'`, `'CONFIRMED'` | وضعیت برنامه غذایی هر روز |
| `activity_level` | `'SEDENTARY'`, `'LIGHT'`, `'MODERATE'`, `'ACTIVE'`, `'VERY_ACTIVE'` | سطح فعالیت فیزیکی کاربر |
| `sex_for_calculation` | `'FEMALE'`, `'MALE'` | جنسیت برای فرمول‌های تخمینی تغذیه |
| `allergen_type` | `'DAIRY'`, `'GLUTEN'`, `'NUTS'`, `'EGGS'`, `'SEAFOOD'`, `'SOY'`, `'SESAME'` | آلرژن‌های غذایی استاندارد |
| `planning_style` | `'BALANCED'`, `'HIGH_PROTEIN'`, `'BUDGET_FRIENDLY'`, `'QUICK_PREP'` | سبک برنامه‌ریزی هوشمند تغذیه |
| `variety_level` | `'LOW'`, `'MEDIUM'`, `'HIGH'` | سطح تنوع غذایی در هفته |
| `budget_level` | `'ECONOMIC'`, `'MODERATE'`, `'FLEXIBLE'` | سطح بودجه پیشنهادی خرید |
| `food_item_category` | `'FRUIT'`, `'NUTS_SEEDS'`, `'DAIRY_SNACK'`, `'HEALTHY_SNACK'` | دسته‌بندی میان‌وعده‌های آماده (`FoodItem`) |
| `meal_item_kind` | `'RECIPE'`, `'FOOD_ITEM'` | نوع آیتم داخل وعده (رسپی یا میان‌وعده ساده) |
| `shopping_item_source` | `'AUTO'`, `'MANUAL'` | منشأ آیتم لیست خرید (تولید خودکار از برنامه یا دستی) |

### ۲.۲. Enumهای ماژول برنامه ورزشی
| نام Enum | مقادیر دقیق | توضیح |
|---|---|---|
| `exercise_type` | `'STRENGTH'`, `'CARDIO'`, `'STRETCHING'`, `'MOBILITY'`, `'BALANCE'` | نوع حرکت/جلسه تمرینی |
| `difficulty_level` | `'BEGINNER'`, `'INTERMEDIATE'`, `'ADVANCED'` | سطح دشواری حرکت، قالب یا برنامه |
| `workout_goal` | `'STRENGTH_GAIN'`, `'MUSCLE_GAIN'`, `'ENDURANCE'`, `'GENERAL_FITNESS'`, `'MOBILITY_FLEXIBILITY'`, `'WEIGHT_MANAGEMENT'` | هدف اصلی برنامه تمرینی |
| `workout_session_status` | `'PLANNED'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'MISSED'`, `'CANCELLED'` | وضعیت جلسه ورزشی زمان‌بندی‌شده |
| `cardio_intensity` | `'LIGHT'`, `'MODERATE'`, `'VIGOROUS'` | شدت تمرین هوازی (برای مرجع MET) |
| `workout_activity_log_status` | `'IN_PROGRESS'`, `'COMPLETED'`, `'PARTIAL'`, `'CANCELLED'` | وضعیت لاگ اجرای واقعی جلسه |

### ۲.۳. Enumهای ماژول تقویم یکپارچه، اعلان‌ها و همگام‌سازی
| نام Enum | مقادیر دقیق | توضیح |
|---|---|---|
| `calendar_source_module` | `'nutrition'`, `'workout'`, `'supplement'`, `'system'` | ماژول مبدأ تولید رویداد تقویم |
| `calendar_activity_kind` | `'meal'`, `'snack'`, `'supplement'`, `'workout'`, `'weekly_planning_reminder'` | نوع فعالیت در تقویم و دسته‌بندی اعلان (`NotificationCategoryKey`) |
| `calendar_event_status` | `'CONFIRMED'`, `'DRAFT'`, `'IN_REVIEW'`, `'PLANNED'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'MISSED'`, `'CANCELLED'`, `'TAKEN'`, `'SYSTEM'` | وضعیت نمایشی یکپارچه رویداد تقویم |
| `notification_channel` | `'in_app'`, `'browser_preview'`, `'telegram_coming_soon'` | کانال ارسال یادآور |
| `calendar_sync_provider` | `'google_calendar_future'` | ارائه‌دهنده تقویم خارجی |
| `calendar_sync_direction` | `'one_way_export'` | جهت همگام‌سازی (فعلاً ارسال یک‌طرفه) |

---

## ۳. طراحی کامل جداول دیتابیس (PostgreSQL Tables & Columns)

> **نکته کلیدی**: در تمام جداول زیر، `id` از نوع `VARCHAR(64)` یا `UUID` است (در Mock فعلی پیشوندهایی مثل `rec_...`, `ing_...`, `ws_...` استفاده می‌شود؛ استفاده از `VARCHAR(64)` هم با `UUID` سازگار است و هم امکان Import داده‌های Seed اولیه را بدون خطا می‌دهد).

---

### ۳.۱. کاربران، پروفایل، اهداف تغذیه و تنظیمات هوشمند

#### جدول `users`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | `gen_random_uuid()::text` | `PK` | شناسه یکتای کاربر |
| `email` | `VARCHAR(255)` | `NULL` | `NULL` | `UNIQUE` | ایمیل کاربر (اختیاری در ورود با موبایل) |
| `phone` | `VARCHAR(20)` | `NULL` | `NULL` | `UNIQUE` | شماره موبایل استاندارد |
| `password_hash` | `TEXT` | `NULL` | `NULL` | — | هش رمز عبور (Argon2id/bcrypt) |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن حساب |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ساخت |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان آخرین ویرایش |

#### جدول `user_profiles` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه پروفایل |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)`, `UNIQUE` | مالک پروفایل |
| `display_name` | `VARCHAR(120)` | `NOT NULL` | — | `CHECK (length(trim(display_name)) >= 2)` | نام نمایشی |
| `age` | `SMALLINT` | `NOT NULL` | — | `CHECK (age BETWEEN 12 AND 110)` | سن |
| `height_cm` | `NUMERIC(5,1)` | `NOT NULL` | — | `CHECK (height_cm BETWEEN 100 AND 240)` | قد (سانتی‌متر) |
| `weight_kg` | `NUMERIC(5,1)` | `NOT NULL` | — | `CHECK (weight_kg BETWEEN 30 AND 250)` | وزن (کیلوگرم) — مرجع مشترک تغذیه و محاسبه MET ورزش |
| `sex_for_calculation` | `sex_for_calculation` | `NOT NULL` | — | — | جنسیت محاسباتی |
| `activity_level` | `activity_level` | `NOT NULL` | — | — | سطح فعالیت روزانه |
| `timezone` | `VARCHAR(64)` | `NOT NULL` | `'Asia/Tehran'` | — | منطقه زمانی کاربر |
| `has_special_medical_condition` | `BOOLEAN` | `NOT NULL` | `false` | — | دارای شرایط پزشکی خاص |
| `avatar_url` | `TEXT` | `NULL` | `NULL` | — | لینک تصویر آواتار |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان آخرین بروزرسانی |

#### جدول `nutrition_targets` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `PK`, `FK -> users(id)` | شناسه کاربر |
| `daily_calories` | `INTEGER` | `NOT NULL` | — | `CHECK (daily_calories BETWEEN 900 AND 5500)` | هدف کالری روزانه |
| `protein_grams` | `NUMERIC(6,1)` | `NOT NULL` | — | `CHECK (protein_grams BETWEEN 20 AND 350)` | هدف پروتئین (گرم) |
| `carbs_grams` | `NUMERIC(6,1)` | `NOT NULL` | — | `CHECK (carbs_grams BETWEEN 20 AND 700)` | هدف کربوهیدرات (گرم) |
| `fat_grams` | `NUMERIC(6,1)` | `NOT NULL` | — | `CHECK (fat_grams BETWEEN 15 AND 250)` | هدف چربی (گرم) |
| `fiber_grams` | `NUMERIC(5,1)` | `NULL` | `NULL` | `CHECK (fiber_grams BETWEEN 0 AND 120)` | هدف فیبر اختیاری (گرم) |
| `meals_per_day` | `SMALLINT` | `NOT NULL` | `4` | `CHECK (meals_per_day BETWEEN 2 AND 6)` | تعداد وعده‌های روزانه |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان آخرین بروزرسانی |

#### جدول `nutrition_preferences` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `PK`, `FK -> users(id)` | شناسه کاربر |
| `favorite_recipe_ids` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `string[]` | آرایه ID غذاهای مورد علاقه |
| `disliked_recipe_ids` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `string[]` | آرایه ID غذاهای نامحبوب |
| `allergies` | `allergen_type[]` | `NOT NULL` | `'{}'` | — | فهرست آلرژی‌های کاربر |
| `dietary_restrictions` | `TEXT[]` | `NOT NULL` | `'{}'` | — | محدودیت‌های رژیمی (مثل گیاهخواری، کم‌نمک) |
| `disliked_ingredient_ids` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `string[]` | آرایه ID مواد اولیه نامحبوب |
| `meal_timings` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `MealTimingPreference[]` | `{slot, label, defaultTime, enabled}` برای هر اسلات |
| `variety_preference` | `variety_level` | `NOT NULL` | `'MEDIUM'` | — | ترجیح تنوع |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

#### جدول `agent_preferences` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `PK`, `FK -> users(id)` | شناسه کاربر |
| `planning_style` | `planning_style` | `NOT NULL` | `'BALANCED'` | — | سبک برنامه‌ریزی |
| `variety_level` | `variety_level` | `NOT NULL` | `'MEDIUM'` | — | سطح تنوع |
| `prefer_quick_meals` | `BOOLEAN` | `NOT NULL` | `false` | — | اولویت غذاهای سریع |
| `budget_level` | `budget_level` | `NOT NULL` | `'MODERATE'` | — | سطح بودجه |
| `prioritize_pantry` | `BOOLEAN` | `NOT NULL` | `true` | — | اولویت استفاده از موجودی خانه |
| `forbidden_food_notes` | `TEXT` | `NOT NULL` | `''` | — | یادداشت غذاهای ممنوعه |
| `max_recipe_repeats_per_week` | `SMALLINT` | `NOT NULL` | `2` | `CHECK (max_recipe_repeats_per_week BETWEEN 1 AND 7)` | حداکثر تکرار هر رسپی در هفته |
| `custom_instructions` | `TEXT` | `NOT NULL` | `''` | `CHECK (length(custom_instructions) <= 1200)` | دستورالعمل اختصاصی برای عامل هوشمند |
| `reminder_config` | `JSONB` | `NOT NULL` | `'{"enabled":true,"dayOfWeek":5,"time24h":"10:00"}'` | `PlanningReminderConfig` | تنظیم یادآور هفتگی برنامه‌ریزی |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

---

### ۳.۲. بانک مواد اولیه، دسته‌بندی‌ها، رسپی‌ها و میان‌وعده‌ها

#### جدول `ingredient_categories`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه دسته‌بندی ماده اولیه |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | `NULL` برای دسته‌های پایه سیستمی یا ID کاربر |
| `name` | `VARCHAR(100)` | `NOT NULL` | — | `CHECK (length(trim(name)) >= 2)` | عنوان دسته |
| `description` | `TEXT` | `NULL` | `NULL` | — | توضیح |
| `color` | `VARCHAR(32)` | `NOT NULL` | — | — | کد رنگ یا کلاس رنگ |
| `icon` | `VARCHAR(64)` | `NOT NULL` | — | — | نام آیکن Lucide |
| `sort_order` | `SMALLINT` | `NOT NULL` | `1` | `CHECK (sort_order BETWEEN 1 AND 100)` | ترتیب نمایش (`order` در API) |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن |

#### جدول `shopping_categories`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه دسته‌بندی خرید (مثلاً `shop_cat_other`) |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | مالک دسته (`NULL` = پیش‌فرض سیستم) |
| `title` | `VARCHAR(100)` | `NOT NULL` | — | `CHECK (length(trim(title)) >= 2)` | عنوان دسته‌بندی خرید |
| `color` | `VARCHAR(32)` | `NOT NULL` | — | — | رنگ |
| `icon` | `VARCHAR(64)` | `NOT NULL` | — | — | نام آیکن |
| `sort_order` | `SMALLINT` | `NOT NULL` | `1` | `CHECK (sort_order BETWEEN 1 AND 100)` | ترتیب (`order` در API) |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | وضعیت |

#### جدول `ingredients`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه ماده اولیه |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | `NULL` = بانک عمومی، مقداردار = اختصاصی کاربر |
| `name` | `VARCHAR(150)` | `NOT NULL` | — | `CHECK (length(trim(name)) >= 2)` | نام ماده اولیه |
| `category_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> ingredient_categories(id)` | دسته‌بندی ماده اولیه |
| `shopping_category_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> shopping_categories(id)` | دسته‌بندی پیش‌فرض در لیست خرید |
| `default_unit` | `unit_type` | `NOT NULL` | — | — | واحد پیش‌فرض مصرف و خرید |
| `reference_amount` | `NUMERIC(8,2)` | `NOT NULL` | `100` | `CHECK (reference_amount > 0)` | مقدار مرجع ارزش غذایی (مثلاً 100 گرم) |
| `reference_unit` | `unit_type` | `NOT NULL` | — | — | واحد مقدار مرجع |
| `grams_per_unit` | `NUMERIC(8,2)` | `NULL` | `NULL` | `CHECK (grams_per_unit > 0)` | ضریب تبدیل واحدهایی مثل `piece`/`tbsp`/`cup` به گرم |
| `nutrition_per_reference` | `JSONB` | `NULL` | `NULL` | `NutritionValues \| null` | `{calories, protein, carbs, fat, fiber?}`؛ اگر `NULL` باشد یعنی داده ناقص است (`hasIncompleteData=true`) |
| `allergens` | `allergen_type[]` | `NOT NULL` | `'{}'` | — | آلرژن‌های ماده اولیه |
| `compatible_substitute_ids` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `string[]` | جایگزین‌های سازگار برای ویرایش روزانه |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*ایندکس‌ها*: `INDEX idx_ingredients_user_active ON ingredients(user_id, is_active)`, `INDEX idx_ingredients_shop_cat ON ingredients(shopping_category_id)`.

#### جدول `recipe_categories`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه دسته‌بندی غذا |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | مالک یا سیستمی |
| `name` | `VARCHAR(100)` | `NOT NULL` | — | — | عنوان دسته‌بندی |
| `description` | `TEXT` | `NULL` | `NULL` | — | توضیح |
| `color` | `VARCHAR(32)` | `NOT NULL` | — | — | رنگ |
| `icon` | `VARCHAR(64)` | `NOT NULL` | — | — | نام آیکن |
| `sort_order` | `SMALLINT` | `NOT NULL` | `1` | `CHECK (sort_order BETWEEN 1 AND 100)` | ترتیب |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن |

#### جدول `recipes`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه رسپی |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | مالک یا سیستمی |
| `name` | `VARCHAR(180)` | `NOT NULL` | — | `CHECK (length(trim(name)) >= 2)` | نام غذا |
| `category_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> recipe_categories(id)` | دسته‌بندی غذا |
| `description` | `TEXT` | `NULL` | `NULL` | — | توضیح کوتاه |
| `image_url` | `TEXT` | `NULL` | `NULL` | — | لینک تصویر |
| `servings` | `SMALLINT` | `NOT NULL` | `1` | `CHECK (servings BETWEEN 1 AND 20)` | تعداد پرس (سروینگ) |
| `prep_time_minutes` | `SMALLINT` | `NOT NULL` | `0` | `CHECK (prep_time_minutes BETWEEN 0 AND 360)` | زمان آماده‌سازی |
| `cook_time_minutes` | `SMALLINT` | `NOT NULL` | `0` | `CHECK (cook_time_minutes BETWEEN 0 AND 480)` | زمان پخت |
| `ingredients_json` | `JSONB` | `NOT NULL` | — | `RecipeIngredient[]` (min 1) | `[{id, ingredientId, amount, unit, notes?, isOptional?}]` (یا جدول واسط `recipe_ingredients`) |
| `steps_json` | `JSONB` | `NOT NULL` | — | `RecipeStep[]` (min 1) | `[{id, stepNumber, instruction}]` |
| `manual_nutrition_per_serving` | `JSONB` | `NULL` | `NULL` | `NutritionValues \| null` | `{calories, protein, carbs, fat, fiber?}` |
| `use_manual_nutrition` | `BOOLEAN` | `NOT NULL` | `false` | — | اگر `true` باشد جایگزین محاسبه از مواد اولیه می‌شود |
| `tags` | `TEXT[]` | `NOT NULL` | `'{}'` | — | برچسب‌ها |
| `suitable_slots` | `meal_slot_type[]` | `NOT NULL` | — | `CHECK (cardinality(suitable_slots) >= 1)` | وعده‌های مناسب |
| `allergens` | `allergen_type[]` | `NOT NULL` | `'{}'` | — | آلرژن‌ها |
| `is_favorite` | `BOOLEAN` | `NOT NULL` | `false` | — | علاقه‌مندی کاربر |
| `is_disliked` | `BOOLEAN` | `NOT NULL` | `false` | — | عدم تمایل |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال در برنامه‌ریزی |
| `notes` | `TEXT` | `NULL` | `NULL` | — | یادداشت |
| `version` | `INTEGER` | `NOT NULL` | `1` | — | نسخه رسپی (با هر ویرایش `+1`) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*توصیه*: در کنار یا به جای `ingredients_json` می‌توان جدول نرمال‌شده `recipe_ingredients (id, recipe_id, ingredient_id, amount, unit, notes, is_optional)` با `FK` به `ingredients(id)` داشت تا Integrity در زمان حذف ماده اولیه حفظ شود.

#### جدول `food_items` (میان‌وعده‌ها و اقلام ساده آماده)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه میان‌وعده |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | مالک یا سیستمی |
| `name` | `VARCHAR(150)` | `NOT NULL` | — | — | نام آیتم (مثل سیب، بادام خام) |
| `category` | `food_item_category` | `NOT NULL` | — | — | نوع میان‌وعده |
| `serving_size` | `NUMERIC(8,2)` | `NOT NULL` | — | `CHECK (serving_size > 0)` | اندازه یک سروینگ |
| `unit` | `unit_type` | `NOT NULL` | — | — | واحد |
| `nutrition_per_serving` | `JSONB` | `NULL` | `NULL` | `NutritionValues \| null` | ارزش غذایی هر سروینگ |
| `allergens` | `allergen_type[]` | `NOT NULL` | `'{}'` | — | آلرژن‌ها |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن |

---

### ۳.۳. مکمل‌ها، موجودی خانه و لیست خرید

#### جدول `supplements`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه مکمل |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک مکمل |
| `name` | `VARCHAR(150)` | `NOT NULL` | — | `CHECK (length(trim(name)) >= 2)` | نام مکمل/ویتامین |
| `form` | `VARCHAR(80)` | `NOT NULL` | — | `CHECK (length(trim(form)) >= 2)` | شکل مصرف (کپسول، قرص، پودر، قطره...) |
| `dosage_amount` | `NUMERIC(8,2)` | `NULL` | `NULL` | — | مقدار دوز |
| `dosage_unit` | `VARCHAR(40)` | `NULL` | `NULL` | — | واحد دوز (mg, IU, عدد...) |
| `active_days` | `SMALLINT[]` | `NOT NULL` | `'{}'` | عناصر `0..6` (شنبه تا جمعه) | روزهای فعال در هفته |
| `time_of_day` | `VARCHAR(5)` | `NULL` | `NULL` | `HH:mm` 24h | ساعت مصرف (برای نمایش در تقویم ضروری است) |
| `linked_meal_slot` | `meal_slot_type` | `NULL` | `NULL` | — | وعده مرتبط (اختیاری) |
| `doctor_or_pharmacist_note` | `TEXT` | `NULL` | `NULL` | — | توصیه پزشک یا داروساز |
| `user_note` | `TEXT` | `NULL` | `NULL` | — | یادداشت کاربر |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | وضعیت فعال بودن |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*ایندکس*: `INDEX idx_supplements_user_active ON supplements(user_id, is_active)`.

#### جدول `pantry_inventory`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه قلم موجودی |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `ingredient_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> ingredients(id)` | ماده اولیه مرتبط |
| `custom_name` | `VARCHAR(150)` | `NULL` | `NULL` | — | نام سفارشی اختیاری |
| `quantity` | `NUMERIC(10,2)` | `NOT NULL` | `0` | `CHECK (quantity >= 0)` | مقدار فعلی موجود در خانه |
| `unit` | `unit_type` | `NOT NULL` | — | — | واحد موجودی |
| `shopping_category_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> shopping_categories(id)` | دسته‌بندی خرید |
| `expiry_date_iso` | `DATE` | `NULL` | `NULL` | — | تاریخ انقضا (اختیاری) |
| `low_stock_threshold` | `NUMERIC(10,2)` | `NULL` | `NULL` | `CHECK (low_stock_threshold >= 0)` | آستانه هشدار کمبود |
| `note` | `TEXT` | `NULL` | `NULL` | — | یادداشت |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*ایندکس‌ها*: `INDEX idx_pantry_user_ingredient ON pantry_inventory(user_id, ingredient_id)`.

#### جدول `shopping_lists`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه لیست خرید |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک لیست |
| `weekly_plan_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> weekly_meal_plans(id)` | برنامه هفتگی مرتبط |
| `week_start_iso` | `DATE` | `NOT NULL` | — | — | شنبه شروع هفته |
| `week_end_iso` | `DATE` | `NOT NULL` | — | — | جمعه پایان هفته |
| `last_generated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | آخرین زمان تولید/بازتولید خودکار |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*قید یکتا*: `UNIQUE (user_id, week_start_iso)`.

#### جدول `shopping_list_items`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه قلم لیست خرید |
| `shopping_list_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> shopping_lists(id) ON DELETE CASCADE` | لیست خرید والد |
| `ingredient_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> ingredients(id)` | ماده اولیه (برای آیتم‌های `AUTO` مقدار دارد) |
| `name` | `VARCHAR(160)` | `NOT NULL` | — | — | نام کالا |
| `required_quantity` | `NUMERIC(10,2)` | `NOT NULL` | `0` | `CHECK (required_quantity >= 0)` | کل مقدار مورد نیاز برنامه |
| `pantry_quantity` | `NUMERIC(10,2)` | `NOT NULL` | `0` | `CHECK (pantry_quantity >= 0)` | مقدار کسرشده از موجودی خانه (فقط خواندنی) |
| `suggested_buy_quantity` | `NUMERIC(10,2)` | `NOT NULL` | — | `CHECK (suggested_buy_quantity >= 0)` | مقدار پیشنهادی خرید (`max(0, req - pantry)`) |
| `unit` | `unit_type` | `NOT NULL` | — | — | واحد نمایشی نرمال‌شده |
| `category_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> shopping_categories(id)` | دسته‌بندی خرید |
| `is_checked` | `BOOLEAN` | `NOT NULL` | `false` | — | وضعیت تیک‌خوردگی خریداری‌شده |
| `source` | `shopping_item_source` | `NOT NULL` | `'AUTO'` | — | `'AUTO'` یا `'MANUAL'` |
| `needs_unit_review` | `BOOLEAN` | `NOT NULL` | `false` | — | هشدار ناسازگاری واحد |
| `unit_review_message` | `TEXT` | `NULL` | `NULL` | — | توضیح خطای تبدیل واحد |
| `note` | `TEXT` | `NULL` | `NULL` | — | یادداشت کاربر |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*ایندکس*: `INDEX idx_shop_items_list_source ON shopping_list_items(shopping_list_id, source)`.

---

### ۳.۴. برنامه‌ریزی غذایی هفتگی و جلسات ویزارد

#### جدول `weekly_meal_plans`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه برنامه هفتگی |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `week_start_iso` | `DATE` | `NOT NULL` | — | — | شنبه شروع هفته |
| `week_end_iso` | `DATE` | `NOT NULL` | — | — | جمعه پایان هفته |
| `status` | `weekly_plan_status` | `NOT NULL` | `'DRAFT'` | — | وضعیت کلی هفته |
| `warnings` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `string[]` | هشدارهای تغذیه‌ای/آلرژی |
| `version` | `INTEGER` | `NOT NULL` | `1` | — | شماره نسخه |
| `snapshots` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `WeeklyPlanSnapshot[]` | تاریخچه نسخه‌های تأییدشده |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*قید یکتا*: `UNIQUE (user_id, week_start_iso)`.

#### جدول `daily_meal_plans`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه برنامه روزانه |
| `weekly_plan_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> weekly_meal_plans(id) ON DELETE CASCADE` | برنامه هفتگی والد |
| `day_index` | `SMALLINT` | `NOT NULL` | — | `CHECK (day_index BETWEEN 0 AND 6)` | `0 = شنبه .. 6 = جمعه` |
| `date_iso` | `DATE` | `NOT NULL` | — | — | تاریخ دقیق روز |
| `status` | `daily_plan_status` | `NOT NULL` | `'DRAFT'` | — | وضعیت تایید روز |
| `meals` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `Meal[]` | آرایه وعده‌ها شامل `items`, `ingredientOverrides`, `confirmedIngredientIds`, `suggestedTime` (برای گزارش‌گیری تحلیلی می‌توان جدول نرمال‌شده `meals` و `meal_items` هم ساخت، اما ساختار JSONB دقیقا منطبق با `DailyMealPlan` و کم‌ریسک‌ترین نگاشت برای ویرایش اتمیک یک روز است) |
| `supplement_schedules` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `SupplementSchedule[]` | وضعیت مصرف مکمل در این روز (`{id, supplementId, dayIndex, isTaken, takenAt?}`) |
| `notes` | `TEXT` | `NULL` | `NULL` | — | یادداشت روز |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*قید یکتا*: `UNIQUE (weekly_plan_id, day_index)` و `UNIQUE (weekly_plan_id, date_iso)`.

> **یادداشت معماری در مورد `meals` و `supplement_schedules`**: اگر نیاز به کوئری SQL مستقیم روی تک‌تک وعده‌ها (مثل «چند بار در ماه عدس‌پلو مصرف شد؟») دارید، علاوه بر ستون یا به جای JSONB می‌توان جداول `daily_meals (id, daily_plan_id, slot, label, suggested_time, is_confirmed)`، `daily_meal_items (id, meal_id, kind, recipe_id, food_item_id, portion_multiplier, amount, unit, ingredient_overrides, confirmed_ingredient_ids)` و `daily_supplement_logs (id, daily_plan_id, supplement_id, day_index, is_taken, taken_at)` را ایجاد کرد و در API خروجی یکسان `DailyMealPlan` را برگرداند.

#### جدول `planning_sessions`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه جلسه ویزارد برنامه‌ریزی |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)`, `UNIQUE` | کاربر (هر کاربر حداکثر یک جلسه فعال دارد) |
| `target_week_start_iso` | `DATE` | `NOT NULL` | — | — | شنبه هفته هدف |
| `target_week_end_iso` | `DATE` | `NOT NULL` | — | — | جمعه هفته هدف |
| `current_step` | `SMALLINT` | `NOT NULL` | `1` | `CHECK (current_step BETWEEN 1 AND 6)` | مرحله فعلی ویزارد (۱ تا ۶) |
| `active_day_index` | `SMALLINT` | `NOT NULL` | `0` | `CHECK (active_day_index BETWEEN 0 AND 6)` | روز انتخابی در مرور روزانه |
| `weekly_plan_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> weekly_meal_plans(id) ON DELETE SET NULL` | برنامه هفتگی متصل |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن ویزارد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

---

### ۳.۵. ماژول برنامه ورزشی (Workout Module)

#### جدول `exercise_categories`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه دسته‌بندی حرکت |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | `NULL` = سیستمی |
| `name` | `VARCHAR(100)` | `NOT NULL` | — | — | نام دسته |
| `type` | `exercise_type` | `NOT NULL` | — | — | نوع اصلی حرکت |
| `description` | `TEXT` | `NULL` | `NULL` | — | توضیح |
| `sort_order` | `SMALLINT` | `NOT NULL` | `1` | — | ترتیب (`order` در API) |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | وضعیت |

#### جدول `exercises` (بانک حرکات)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه حرکت |
| `user_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> users(id)` | `NULL` = بانک عمومی، مقداردار = اختصاصی کاربر |
| `persian_name` | `VARCHAR(160)` | `NOT NULL` | — | `CHECK (length(trim(persian_name)) >= 2)` | نام فارسی حرکت |
| `english_name` | `VARCHAR(160)` | `NULL` | `NULL` | — | نام انگلیسی (اختیاری) |
| `type` | `exercise_type` | `NOT NULL` | — | — | نوع حرکت |
| `category_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> exercise_categories(id)` | دسته‌بندی حرکت |
| `target_muscle_groups` | `TEXT[]` | `NOT NULL` | — | `CHECK (cardinality(target_muscle_groups) >= 1)` | عضلات درگیر |
| `difficulty` | `difficulty_level` | `NOT NULL` | — | — | سطح دشواری |
| `equipment` | `TEXT[]` | `NOT NULL` | — | `CHECK (cardinality(equipment) >= 1)` | تجهیزات مورد نیاز |
| `instructions` | `TEXT` | `NOT NULL` | — | `CHECK (length(trim(instructions)) >= 5)` | روش صحیح اجرا |
| `safety_notes` | `TEXT` | `NOT NULL` | — | `CHECK (length(trim(safety_notes)) >= 3)` | نکات ایمنی |
| `media_url` | `TEXT` | `NULL` | `NULL` | — | لینک تصویر/ویدئو آموزشی |
| `default_met` | `NUMERIC(4,1)` | `NOT NULL` | — | `CHECK (default_met BETWEEN 1.0 AND 20.0)` | ضریب MET پیش‌فرض حرکت |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | وضعیت فعال |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

#### جدول `met_reference_entries` (جدول مرجع MET قابل تنظیم کاربر)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه ردیف MET |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک تنظیمات MET |
| `exercise_type` | `exercise_type` | `NOT NULL` | — | — | نوع تمرین |
| `intensity` | `cardio_intensity` | `NOT NULL` | — | — | شدت تمرین |
| `label` | `VARCHAR(120)` | `NOT NULL` | — | — | عنوان نمایشی فارسی |
| `met_value` | `NUMERIC(4,1)` | `NOT NULL` | — | `CHECK (met_value BETWEEN 1.0 AND 20.0)` | مقدار MET |
| `description` | `TEXT` | `NOT NULL` | `''` | — | توضیح |
*قید یکتا*: `UNIQUE (user_id, exercise_type, intensity)`.

#### جدول `workout_programs`
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه برنامه ورزشی |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `title` | `VARCHAR(160)` | `NOT NULL` | — | `CHECK (length(trim(title)) >= 2)` | عنوان برنامه |
| `goal` | `workout_goal` | `NOT NULL` | — | — | هدف برنامه |
| `difficulty` | `difficulty_level` | `NOT NULL` | — | — | سطح برنامه |
| `sessions_per_week` | `SMALLINT` | `NOT NULL` | — | `CHECK (sessions_per_week BETWEEN 1 AND 7)` | تعداد جلسات در هفته |
| `start_date_iso` | `DATE` | `NOT NULL` | — | — | تاریخ شروع |
| `end_date_iso` | `DATE` | `NULL` | `NULL` | — | تاریخ پایان اختیاری |
| `description` | `TEXT` | `NULL` | `NULL` | — | توضیحات |
| `is_active` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن برنامه |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

#### جدول `workout_templates` (قالب‌های جلسه زیرمجموعه برنامه)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه قالب جلسه |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `program_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> workout_programs(id) ON DELETE CASCADE` | برنامه والد |
| `title` | `VARCHAR(160)` | `NOT NULL` | — | `CHECK (length(trim(title)) >= 2)` | عنوان قالب (مثلاً روز بالاتنه) |
| `type` | `exercise_type` | `NOT NULL` | — | — | نوع غالب جلسه |
| `estimated_duration_minutes` | `SMALLINT` | `NOT NULL` | — | `CHECK (estimated_duration_minutes BETWEEN 5 AND 300)` | مدت تخمینی |
| `difficulty` | `difficulty_level` | `NOT NULL` | — | — | سطح |
| `exercises` | `JSONB` | `NOT NULL` | — | `WorkoutTemplateExercise[]` (min 1) | حرکات قالب (`sets, reps, targetWeightKg, restSeconds, durationMinutes, intensity, targetDistanceKm, targetSpeedKmh, holdSeconds, notes`) |
| `notes` | `TEXT` | `NULL` | `NULL` | — | یادداشت |
| `sort_order` | `SMALLINT` | `NOT NULL` | `0` | — | ترتیب در برنامه |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

#### جدول `workout_sessions` (جلسات واقعی زمان‌بندی‌شده در تقویم هفته — مستقل از تغییر قالب!)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه جلسه |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `program_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> workout_programs(id) ON DELETE SET NULL` | ارجاع تاریخی به برنامه |
| `template_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> workout_templates(id) ON DELETE SET NULL` | ارجاع تاریخی به قالب |
| `title` | `VARCHAR(160)` | `NOT NULL` | — | — | عنوان جلسه |
| `type` | `exercise_type` | `NOT NULL` | — | — | نوع جلسه |
| `date_iso` | `DATE` | `NOT NULL` | — | — | تاریخ دقیق جلسه |
| `day_index` | `SMALLINT` | `NOT NULL` | — | `CHECK (day_index BETWEEN 0 AND 6)` | اندیس روز هفته شمسی |
| `start_time` | `VARCHAR(5)` | `NOT NULL` | — | `HH:mm` | ساعت شروع |
| `end_time` | `VARCHAR(5)` | `NOT NULL` | — | `HH:mm` | ساعت پایان |
| `estimated_duration_minutes` | `SMALLINT` | `NOT NULL` | — | `CHECK (estimated_duration_minutes > 0)` | مدت تخمینی |
| `status` | `workout_session_status` | `NOT NULL` | `'PLANNED'` | — | وضعیت جلسه |
| `reminder_enabled` | `BOOLEAN` | `NOT NULL` | `true` | — | فعال بودن یادآور جلسه |
| `notes` | `TEXT` | `NULL` | `NULL` | — | یادداشت |
| `exercises` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `WorkoutSessionExercise[]` | کپی مستقل حرکات و ست‌ها (`sets[]`, `actualDurationMinutes`, `perceivedRpe`, ...) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان ایجاد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*ایندکس‌ها*: `INDEX idx_ws_user_date ON workout_sessions(user_id, date_iso)`, `INDEX idx_ws_user_status ON workout_sessions(user_id, status)`.

#### جدول `workout_activity_logs` (لاگ زمان واقعی اجرا، توقف‌ها و کالری MET)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه لاگ |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `session_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> workout_sessions(id) ON DELETE CASCADE`, `UNIQUE` | جلسه متناظر (یک لاگ فعال/نهایی به ازای هر جلسه) |
| `program_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> workout_programs(id) ON DELETE SET NULL` | ارجاع تاریخی |
| `template_id` | `VARCHAR(64)` | `NULL` | `NULL` | `FK -> workout_templates(id) ON DELETE SET NULL` | ارجاع تاریخی |
| `title` | `VARCHAR(160)` | `NOT NULL` | — | — | عنوان ثبت‌شده در زمان اجرا |
| `type` | `exercise_type` | `NOT NULL` | — | — | نوع جلسه |
| `date_iso` | `DATE` | `NOT NULL` | — | — | تاریخ جلسه |
| `started_at_iso` | `TIMESTAMPTZ` | `NOT NULL` | — | — | زمان واقعی شروع تمرین |
| `ended_at_iso` | `TIMESTAMPTZ` | `NULL` | `NULL` | — | زمان واقعی پایان تمرین |
| `pause_intervals` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `WorkoutPauseInterval[]` | `[{startedAtISO, resumedAtISO?}]` |
| `actual_duration_minutes` | `INTEGER` | `NOT NULL` | `0` | `CHECK (actual_duration_minutes >= 0)` | مدت واقعی فعال محاسبه‌شده از timestampها |
| `estimated_calories` | `INTEGER` | `NULL` | `NULL` | `CHECK (estimated_calories >= 0)` | کالری تخمینی MET؛ اگر وزن/مدت نامعتبر باشد حتماً `NULL` |
| `calories_formula_note` | `TEXT` | `NULL` | `NULL` | — | یادداشت فرمول و سلب مسئولیت |
| `completed_exercises_count` | `SMALLINT` | `NOT NULL` | `0` | — | تعداد حرکات تکمیل‌شده |
| `total_exercises_count` | `SMALLINT` | `NOT NULL` | `0` | — | کل حرکات |
| `completed_sets_count` | `SMALLINT` | `NOT NULL` | `0` | — | تعداد ست‌های تکمیل‌شده |
| `total_sets_count` | `SMALLINT` | `NOT NULL` | `0` | — | کل ست‌ها |
| `perceived_rpe` | `SMALLINT` | `NULL` | `NULL` | `CHECK (perceived_rpe BETWEEN 1 AND 10)` | شدت درک‌شده (RPE 1..10) |
| `user_notes` | `TEXT` | `NULL` | `NULL` | — | یادداشت کاربر پس از تمرین |
| `exercises_snapshot` | `JSONB` | `NOT NULL` | `'[]'::jsonb` | `WorkoutSessionExercise[]` | اسنپ‌شات عملکرد ست‌ها/وزنه‌ها/تکرارها |
| `status` | `workout_activity_log_status` | `NOT NULL` | — | — | `'IN_PROGRESS' \| 'COMPLETED' \| 'PARTIAL' \| 'CANCELLED'` |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*ایندکس*: `INDEX idx_wlog_user_date ON workout_activity_logs(user_id, date_iso DESC)`.

#### جدول `workout_preferences` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `PK`, `FK -> users(id)` | شناسه کاربر |
| `primary_goal` | `workout_goal` | `NOT NULL` | `'GENERAL_FITNESS'` | — | هدف اصلی ورزشی |
| `experience_level` | `difficulty_level` | `NOT NULL` | `'INTERMEDIATE'` | — | سطح تجربه |
| `preferred_sessions_per_week` | `SMALLINT` | `NOT NULL` | `3` | `CHECK (preferred_sessions_per_week BETWEEN 1 AND 7)` | جلسات ترجیحی در هفته |
| `preferred_duration_minutes` | `SMALLINT` | `NOT NULL` | `45` | `CHECK (preferred_duration_minutes BETWEEN 10 AND 240)` | مدت ترجیحی هر جلسه |
| `preferred_days` | `SMALLINT[]` | `NOT NULL` | `'{0,2,4}'` | عناصر `0..6` | روزهای ترجیحی |
| `preferred_time_start` | `VARCHAR(5)` | `NOT NULL` | `'17:30'` | `HH:mm` | شروع بازه ساعت مناسب |
| `preferred_time_end` | `VARCHAR(5)` | `NOT NULL` | `'20:30'` | `HH:mm` | پایان بازه ساعت مناسب |
| `favorite_types` | `exercise_type[]` | `NOT NULL` | `'{}'` | — | نوع تمرین‌های مورد علاقه |
| `available_equipment` | `TEXT[]` | `NOT NULL` | `'{}'` | — | تجهیزات در دسترس کاربر |
| `movement_limitations` | `TEXT` | `NOT NULL` | `''` | — | محدودیت‌های حرکتی/آسیب‌ها |
| `personal_notes` | `TEXT` | `NOT NULL` | `''` | — | یادداشت‌های شخصی |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

---

### ۳.۶. ماژول تقویم یکپارچه، تنظیمات اعلان و آمادگی همگام‌سازی خارجی

> **قاعده طلایی**: رویدادهای تقویم (`RhythmCalendarEvent`) **در جدول مستقلی ذخیره نمی‌شوند**، بلکه به‌صورت داینامیک از ۴ منبع اصلی (`daily_meal_plans`, `workout_sessions`, `supplements`, `notification_preferences.weekly_planning_reminder`) ساخته می‌شوند. فقط تنظیمات اعلان، تنظیمات همگام‌سازی و جدول نگاشت شناسه‌های خارجی (برای همگام‌سازی آینده) در دیتابیس ذخیره می‌شوند.

#### جدول `notification_preferences` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `PK`, `FK -> users(id)` | شناسه کاربر |
| `categories` | `JSONB` | `NOT NULL` | پیش‌فرض ۵ دسته | `Record<NotificationCategoryKey, CategoryNotificationSetting>` | تنظیم هر دسته (`meal`, `snack`, `supplement`, `workout`, `weekly_planning_reminder`): `{category, label, enabled, leadTimeMinutes, channel}` |
| `event_overrides` | `JSONB` | `NOT NULL` | `'{}'::jsonb` | `Record<string, EventReminderOverride>` | کلید = `eventId` یکتای تقویم، مقدار = `{enabled?, leadTimeMinutes?}` |
| `weekly_planning_reminder` | `JSONB` | `NOT NULL` | `'{"enabled":true,"dayOfWeek":5,"time24h":"10:00","title":"زمان برنامه‌ریزی هفته آینده ریتم"}'` | `WeeklyPlanningReminderSetting` | یادآور هفتگی برنامه‌ریزی هفته بعد |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

#### جدول `calendar_sync_preferences` (رابطه ۱ به ۱ با `users`)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `PK`, `FK -> users(id)` | شناسه کاربر |
| `provider` | `calendar_sync_provider` | `NOT NULL` | `'google_calendar_future'` | — | ارائه‌دهنده |
| `sync_direction` | `calendar_sync_direction` | `NOT NULL` | `'one_way_export'` | — | جهت همگام‌سازی |
| `included_types` | `JSONB` | `NOT NULL` | `'{"meal":true,"snack":false,"supplement":true,"workout":true}'` | `{meal, snack, supplement, workout}` | انواع فعالیت مجاز برای خروجی |
| `only_confirmed_weeks` | `BOOLEAN` | `NOT NULL` | `true` | — | فقط هفته‌های تأییدشده غذا ارسال شوند |
| `sync_subsequent_changes` | `BOOLEAN` | `NOT NULL` | `true` | — | بروزرسانی خودکار تغییرات بعدی |
| `cancel_external_on_cancel` | `BOOLEAN` | `NOT NULL` | `true` | — | حذف/لغو رویداد خارجی در صورت لغو در ریتم |
| `prevent_duplicates` | `BOOLEAN` | `NOT NULL` | `true` | — | جلوگیری از ساخت رویداد تکراری با `dedupeKey` |
| `display_range` | `JSONB` | `NOT NULL` | `'{"startHour":6,"endHour":23}'` | `{startHour, endHour}` | بازه ساعت نمایشی گرید تقویم |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |

#### جدول `external_connections` (زیرساخت آماده برای Google Calendar OAuth و Telegram Bot)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه اتصال |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک اتصال |
| `provider` | `VARCHAR(40)` | `NOT NULL` | — | — | `'google_calendar'` یا `'telegram'` |
| `external_account_id` | `VARCHAR(255)` | `NULL` | `NULL` | — | ایمیل گوگل یا `telegram_chat_id` |
| `access_token_encrypted` | `TEXT` | `NULL` | `NULL` | — | توکن رمزنگاری‌شده |
| `refresh_token_encrypted` | `TEXT` | `NULL` | `NULL` | — | رفرش توکن رمزنگاری‌شده |
| `token_expires_at` | `TIMESTAMPTZ` | `NULL` | `NULL` | — | انقضای توکن |
| `is_connected` | `BOOLEAN` | `NOT NULL` | `false` | — | وضعیت اتصال فعال |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان بروزرسانی |
*قید یکتا*: `UNIQUE (user_id, provider)`.

#### جدول `calendar_sync_mappings` (جلوگیری از رویداد تکراری هنگام اتصال واقعی Google Calendar)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه نگاشت |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | مالک |
| `provider` | `VARCHAR(40)` | `NOT NULL` | `'google_calendar'` | — | سرویس مقصد |
| `dedupe_key` | `VARCHAR(255)` | `NOT NULL` | — | — | کلید یکتا مطابق فرانت (`nutrition:YYYY-MM-DD:SLOT`, `workout:sessionId`, `supplement:supId:YYYY-MM-DD`) |
| `external_event_id` | `VARCHAR(255)` | `NOT NULL` | — | — | شناسه رویداد در Google Calendar |
| `last_payload_hash` | `VARCHAR(64)` | `NOT NULL` | — | — | هش برای تشخیص نیاز به `PATCH` |
| `last_synced_at` | `TIMESTAMPTZ` | `NOT NULL` | `now()` | — | زمان آخرین همگام‌سازی |
*قید یکتا*: `UNIQUE (user_id, provider, dedupe_key)`.

#### جدول `notification_delivery_logs` (جلوگیری از ارسال تکراری نوتیفیکیشن توسط Cron/Worker)
| ستون | نوع دیتابیس | Null | Default | کلید / قید | توضیح |
|---|---|---|---|---|---|
| `id` | `VARCHAR(64)` | `NOT NULL` | — | `PK` | شناسه ارسال |
| `user_id` | `VARCHAR(64)` | `NOT NULL` | — | `FK -> users(id)` | گیرنده |
| `event_id` | `VARCHAR(160)` | `NOT NULL` | — | — | شناسه رویداد تقویم (`cal_nut_...` / `cal_wrk_...` / ...) |
| `channel` | `notification_channel` | `NOT NULL` | — | — | کانال ارسال |
| `scheduled_for_at` | `TIMESTAMPTZ` | `NOT NULL` | — | — | زمان هدف ارسال (`startAt - leadTimeMinutes`) |
| `sent_at` | `TIMESTAMPTZ` | `NULL` | `NULL` | — | زمان ارسال واقعی |
| `delivery_status` | `VARCHAR(24)` | `NOT NULL` | `'PENDING'` | `'PENDING' \| 'SENT' \| 'FAILED' \| 'SKIPPED'` | وضعیت ارسال |
*قید یکتا*: `UNIQUE (user_id, event_id, channel, scheduled_for_at)`.

---

## ۴. فهرست کامل اندپوینت‌های API و Schema داده‌ها

تمام مسیرها با پیشوند `/api/v1` هستند و فرمت خطای استاندارد به صورت زیر برمی‌گردد:
```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | FORBIDDEN | BUSINESS_RULE_ERROR",
    "message": "پیام خطای خوانا به فارسی برای نمایش در UI",
    "details": {}
  }
}
```

### ۴.۱. احراز هویت و بوت‌استرپ کل داده‌ها
| Method | Endpoint | توضیح | Request Body | Response (`200 OK`) |
|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | ثبت‌نام کاربر + ساخت رکوردهای پیش‌فرض پروفایل، دسته‌بندی‌ها و تنظیمات | `{ email?, phone?, password, displayName }` | `{ token, user, profile }` |
| `POST` | `/api/v1/auth/login` | ورود کاربر | `{ identifier, password }` | `{ token, user }` |
| `GET` | `/api/v1/auth/me` | دریافت کاربر جاری | — | `{ user }` |
| `GET` | `/api/v1/bootstrap` | معادل `getAllData()` در `IRhythmRepository`؛ بارگذاری یکجای کل کانتکست اپلیکیشن | — | شیء کامل `RhythmAppData` |
| `POST` | `/api/v1/demo/reset` | (فقط محیط دمو/تست) بازنشانی داده‌های نمونه کاربر | — | شیء کامل `RhythmAppData` |

---

### ۴.۲. پروفایل، اهداف تغذیه و تنظیمات هوشمند
| Method | Endpoint | توضیح | Request Body Schema | Response (`200 OK`) |
|---|---|---|---|---|
| `PUT` | `/api/v1/profile` | بروزرسانی `UserProfile` (نام، سن 12..110، قد 100..240، وزن 30..250، جنسیت، سطح فعالیت، timezone، شرایط خاص) | `UserProfile` (مطابق `profileSchema`) | `UserProfile` (با `updatedAt` سرور) |
| `PUT` | `/api/v1/nutrition/target` | بروزرسانی `NutritionTarget` (کالری 900..5500، پروتئین 20..350، کربوهیدرات 20..700، چربی 15..250، فیبر 0..120، وعده 2..6) | `NutritionTarget` (مطابق `nutritionTargetSchema`) | `NutritionTarget` |
| `PUT` | `/api/v1/nutrition/preferences` | بروزرسانی علایق، آلرژی‌ها، غذاهای نامحبوب و `mealTimings` | `NutritionPreferences` | `NutritionPreferences` |
| `PUT` | `/api/v1/agent/preferences` | بروزرسانی تنظیمات عامل برنامه‌ریز تغذیه و `reminderConfig` | `AgentPreferences` (مطابق `agentPreferencesSchema`) | `AgentPreferences` |

---

### ۴.۳. مواد اولیه، دسته‌بندی‌ها، رسپی‌ها و میان‌وعده‌ها
| Method | Endpoint | توضیح | Request Body Schema | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/ingredients` | فهرست مواد اولیه کاربر + عمومی | Query: `search?`, `categoryId?`, `activeOnly?` | `Ingredient[]` |
| `PUT` | `/api/v1/ingredients/:id?` یا `POST /api/v1/ingredients` | ایجاد یا ویرایش ماده اولیه (`upsertIngredient`) | `Ingredient` (مطابق `ingredientFormSchema`) | `Ingredient` (`200`/`201`) |
| `DELETE` | `/api/v1/ingredients/:id` | حذف ماده اولیه (اگر در رسپی فعال یا موجودی استفاده شده باشد، خطای `409` یا `isActive=false`) | — | `204 No Content` |
| `GET` | `/api/v1/recipes` | فهرست رسپی‌ها | Query: `search?`, `categoryId?`, `slot?`, `activeOnly?` | `Recipe[]` |
| `POST` / `PUT` | `/api/v1/recipes` / `/api/v1/recipes/:id` | ایجاد یا ویرایش رسپی (`upsertRecipe`؛ هنگام ویرایش `version` باید `+1` شود) | `Recipe` (مطابق `recipeFormSchema`) | `Recipe` |
| `DELETE` | `/api/v1/recipes/:id` | حذف رسپی | — | `204 No Content` |
| `GET` | `/api/v1/food-items` | فهرست میان‌وعده‌های آماده | Query: `category?` | `FoodItem[]` |
| `POST` / `PUT` | `/api/v1/categories/recipes` (`/:id`) | ایجاد/ویرایش `RecipeCategory` | `RecipeCategory` (`categoryFormSchema`) | `RecipeCategory` |
| `DELETE` | `/api/v1/categories/recipes/:id` | حذف دسته‌بندی غذا | Query/Body: `{ replacementCategoryId? }` (در صورت داشتن رسپی وابسته الزامی است، وگرنه `400`) | `204 No Content` |
| `POST` / `PUT` | `/api/v1/categories/shopping` (`/:id`) | ایجاد/ویرایش `ShoppingCategory` | `ShoppingCategory` (`categoryFormSchema`) | `ShoppingCategory` |
| `DELETE` | `/api/v1/categories/shopping/:id` | حذف دسته خرید و انتقال خودکار به `replacementCategoryId` یا `'shop_cat_other'` | `{ replacementCategoryId? }` | `204 No Content` |

---

### ۴.۴. مکمل‌ها و ویتامین‌ها
| Method | Endpoint | توضیح | Request Body Schema | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/supplements` | لیست مکمل‌های کاربر | Query: `activeOnly?` | `Supplement[]` |
| `POST` / `PUT` | `/api/v1/supplements` (`/:id`) | ایجاد یا ویرایش مکمل (`upsertSupplement`) | `Supplement` (`supplementSchema`) | `Supplement` |
| `DELETE` | `/api/v1/supplements/:id` | حذف مکمل | — | `204 No Content` |

---

### ۴.۵. موجودی مواد غذایی خانه (Pantry) و لیست خرید (Shopping List)
| Method | Endpoint | توضیح | Request Body Schema | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/pantry` | دریافت موجودی خانه | — | `PantryInventory[]` |
| `POST` / `PUT` | `/api/v1/pantry` (`/:id`) | ایجاد یا ویرایش قلم موجودی (`upsertPantryItem`) | `PantryInventory` (`pantryItemFormSchema`) | `PantryInventory` |
| `PATCH` | `/api/v1/pantry/:id/adjust` | افزایش/کاهش سریع مقدار موجودی (`adjustPantryQuantity`، حداقل `0`) | `{ delta: number }` | `PantryInventory \| null` |
| `DELETE` | `/api/v1/pantry/:id` | حذف قلم از موجودی | — | `204 No Content` |
| `GET` | `/api/v1/shopping-lists` | دریافت لیست‌های خرید (یا فیلتر با `weekStartISO`) | Query: `weekStartISO?` | `ShoppingList[]` |
| `POST` | `/api/v1/shopping-lists/regenerate` | بازتولید هوشمند لیست خرید از برنامه هفتگی + کسر موجودی خانه (بدون تغییر موجودی خانه و با حفظ اقلام `MANUAL` و `isChecked`) | `{ weeklyPlanId: string, includeUnconfirmed?: boolean }` | `ShoppingList` |
| `POST` / `PUT` | `/api/v1/shopping-lists/:listId/items` (`/:itemId`) | افزودن قلم دستی یا ویرایش/تیک‌زدن قلم موجود (`upsertShoppingItem`) | `ShoppingListItem` (`shoppingItemFormSchema` + `isChecked`, `source`) | `ShoppingList` |
| `DELETE` | `/api/v1/shopping-lists/:listId/items/:itemId` | حذف قلم از لیست خرید | — | `ShoppingList` |

---

### ۴.۶. برنامه‌ریزی غذایی هفتگی و جلسات ویزارد
| Method | Endpoint | توضیح | Request Body Schema | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/planning-sessions/active` | دریافت جلسه فعال ویزارد | — | `PlanningSession \| null` |
| `POST` | `/api/v1/planning-sessions/start` | شروع یا ادامه جلسه ویزارد برای هفته جاری یا آینده | `{ weekType: 'CURRENT' \| 'NEXT' }` | `PlanningSession` |
| `PUT` | `/api/v1/planning-sessions/active` | بروزرسانی مرحله/روز فعال یا بستن (`null`) | `PlanningSession \| null` | `PlanningSession \| null` |
| `GET` | `/api/v1/weekly-plans` | دریافت برنامه‌های هفتگی | Query: `weekStartISO?` | `WeeklyMealPlan[]` |
| `POST` | `/api/v1/weekly-plans/generate` | تولید برنامه پیش‌نویس ۷ روزه برای هفته مشخص (با الگوریتم بک‌اند/AI بر اساس پروفایل، اهداف، ترجیحات، آلرژی‌ها و موجودی خانه) | `{ weekStartISO: string }` | `WeeklyMealPlan` |
| `PUT` | `/api/v1/weekly-plans/:planId` | ذخیره کامل یا تغییر وضعیت `WeeklyMealPlan` | `WeeklyMealPlan` | `WeeklyMealPlan` |
| `PUT` | `/api/v1/weekly-plans/:planId/days/:dayIndex` | ذخیره ویرایش‌های یک روز (وعده‌ها، جایگزینی مواد، تایید روز، وضعیت مصرف مکمل‌های روز) و آپدیت خودکار `WeeklyMealPlan.status` به `REVIEWING` | `DailyMealPlan` | `WeeklyMealPlan` |
| `POST` | `/api/v1/weekly-plans/:planId/confirm` | **تراکنش اتمیک تأیید نهایی هفته**: بررسی تایید همه ۷ روز، ثبت اسنپ‌شات نسخه جدید در `snapshots`، تغییر وضعیت به `CONFIRMED`، و تولید/همگام‌سازی `ShoppingList` | `{}` | `{ plan: WeeklyMealPlan, shoppingList: ShoppingList }` |

---

### ۴.۷. ماژول برنامه ورزشی (Workout Module)
| Method | Endpoint | توضیح | Request Body Schema | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/workout/exercises` | دریافت بانک حرکات + دسته‌بندی‌ها | Query: `type?`, `categoryId?`, `difficulty?`, `search?` | `Exercise[]` |
| `POST` / `PUT` | `/api/v1/workout/exercises` (`/:id`) | ایجاد یا ویرایش حرکت (`upsertExercise`) | `Exercise` (`exerciseFormSchema`) | `Exercise` |
| `DELETE` | `/api/v1/workout/exercises/:id` | حذف حرکت | — | `204 No Content` |
| `GET` | `/api/v1/workout/programs` | دریافت برنامه‌های ورزشی و قالب‌های متصل | — | `{ programs: WorkoutProgram[], templates: WorkoutTemplate[] }` |
| `POST` | `/api/v1/workout/programs/save-with-templates` | ذخیره اتمیک برنامه به همراه آرایه قالب‌هایش (بدون تغییر جلسات زمان‌بندی‌شده قبلی!) | `{ program: WorkoutProgram, templates: WorkoutTemplate[] }` (`workoutProgramFormSchema`) | `{ program: WorkoutProgram, templates: WorkoutTemplate[] }` |
| `POST` | `/api/v1/workout/programs/:id/duplicate` | کپی برنامه همراه با کپی تمام قالب‌های آن | `{}` | `WorkoutProgram` |
| `PATCH` | `/api/v1/workout/programs/:id/active` | فعال یا غیرفعال کردن برنامه | `{ isActive: boolean }` | `WorkoutProgram` |
| `DELETE` | `/api/v1/workout/programs/:id` | حذف برنامه و قالب‌هایش (`sessions` موجود با `programId=NULL` حفظ می‌شوند) | — | `204 No Content` |
| `GET` | `/api/v1/workout/sessions` | دریافت جلسات برنامه‌ریزی‌شده در بازه تاریخ | Query: `weekStartISO?`, `fromDateISO?`, `toDateISO?`, `status?` | `WorkoutSession[]` |
| `POST` / `PUT` | `/api/v1/workout/sessions` (`/:id`) | ایجاد یا ویرایش جلسه تمرینی (محاسبه خودکار `dayIndex` از `dateISO`) | `WorkoutSession` (`workoutSessionFormSchema` + `exercises`) | `WorkoutSession` |
| `DELETE` | `/api/v1/workout/sessions/:id` | حذف جلسه ورزشی | — | `204 No Content` |
| `POST` | `/api/v1/workout/sessions/generate-week` | تولید جلسات هفتگی از روی قالب‌های یک `WorkoutProgram` (بدون تکرار جلسه غیرلغوشده مشابه در همان روز) | `{ weekStartISO: string, programId: string, preferredDays?: number[], defaultStartTime?: string }` | `WorkoutSession[]` |
| `GET` | `/api/v1/workout/logs` | دریافت تاریخچه لاگ‌های تمرین | Query: `fromDateISO?`, `toDateISO?` | `WorkoutActivityLog[]` |
| `POST` | `/api/v1/workout/logs` | ثبت/بروزرسانی لاگ اجرای تمرین + آپدیت همزمان وضعیت و حرکات `WorkoutSession` در تراکنش واحد (محاسبه سمت سرور مدت واقعی و کالری MET) | `{ log: WorkoutActivityLog, nextSessionStatus?: WorkoutSessionStatus, updatedExercises?: WorkoutSessionExercise[] }` | `WorkoutActivityLog` |
| `PUT` | `/api/v1/workout/preferences` | بروزرسانی ترجیحات ورزشی کاربر | `WorkoutPreferences` (`workoutPreferencesSchema`) | `WorkoutPreferences` |
| `GET` / `PUT` | `/api/v1/workout/met-reference` | دریافت یا بروزرسانی جدول مرجع MET کاربر | `MetReferenceEntry[]` | `MetReferenceEntry[]` |

---

### ۴.۸. ماژول تقویم یکپارچه، اعلان‌ها و همگام‌سازی خارجی
| Method | Endpoint | توضیح | Request Body / Query | Response (`200 OK`) |
|---|---|---|---|---|
| `GET` | `/api/v1/calendar/events` | تجمیع یکپارچه رویدادهای تغذیه، مکمل، ورزش و یادآور هفتگی برای یک هفته شمسی (شنبه تا جمعه)، مرتب‌شده بر اساس تاریخ و ساعت و بدون تکرار | Query: `weekStartISO=YYYY-MM-DD` (الزامی) | `RhythmCalendarEvent[]` |
| `GET` | `/api/v1/calendar/notifications/preferences` | دریافت تنظیمات دسته‌بندی اعلان‌ها، override هر رویداد و یادآور برنامه‌ریزی هفتگی | — | `CalendarNotificationPreferences` |
| `PUT` | `/api/v1/calendar/notifications/preferences` | ذخیره تنظیمات اعلان‌ها و یادآور هفتگی | `CalendarNotificationPreferences` | `CalendarNotificationPreferences` |
| `GET` | `/api/v1/calendar/reminders/upcoming` | محاسبه یادآورهای پیش‌رو برای هفته مشخص (`startTime - leadTimeMinutes`) | Query: `weekStartISO=YYYY-MM-DD` | `UpcomingCalendarReminder[]` |
| `GET` | `/api/v1/calendar/sync/preferences` | دریافت تنظیمات همگام‌سازی تقویم خارجی | — | `CalendarSyncPreferences` |
| `PUT` | `/api/v1/calendar/sync/preferences` | ذخیره تنظیمات همگام‌سازی | `CalendarSyncPreferences` | `CalendarSyncPreferences` |
| `GET` | `/api/v1/calendar/sync/preview` | پیش‌نمایش Dry-Run ارسال به Google Calendar (رویدادهای واجد شرایط + رویدادهای فیلترشده با دلیل فارسی + تعداد موارد تکراری) | Query: `weekStartISO=YYYY-MM-DD` | `CalendarSyncPreviewResult` |
| `POST` | `/api/v1/integrations/google-calendar/connect` | *(فاز آینده)* شروع اتصال OAuth2 و ذخیره توکن | `{ code, redirectUri }` | `{ isConnected, externalAccountId }` |
| `POST` | `/api/v1/integrations/google-calendar/sync` | *(فاز آینده)* اجرای واقعی Export یک‌طرفه بر اساس `dedupeKey` و جدول `calendar_sync_mappings` | `{ weekStartISO }` | `{ created, updated, cancelled, skipped }` |

---

## ۵. قوانین کسب‌وکار حیاتی که Backend Agent باید عیناً رعایت کند

1. **منبع حقیقت واحد برای تقویم (Single Source of Truth)**:
   - اندپوینت `/api/v1/calendar/events` هرگز نباید داده مستقلی ذخیره کند؛ باید با الگوریتم دقیق `calendarAdapters.ts` داده‌ها را از ۴ منبع بخواند:
     - وعده‌ها (`meal` برای `BREAKFAST/LUNCH/DINNER` و `snack` برای `MORNING_SNACK/AFTERNOON_SNACK`): اگر `suggestedTime` معتبر (`HH:mm`) نباشد نادیده گرفته می‌شود؛ هرگز `endTime` یا `endAt` جعلی ساخته نمی‌شود (`isPointInTime: true`).
     - جلسات ورزشی (`workout`): اگر `endTime > startTime` معتبر باشد، بازه زمانی کامل (`startAt` تا `endAt`، `isPointInTime: false`) برگردانده می‌شود.
     - مکمل‌ها (`supplement`): فقط اگر `isActive === true`، `dayIndex` در `activeDays` باشد و `timeOfDay` معتبر باشد، به صورت رویداد لحظه‌ای (`isPointInTime: true`) تولید می‌شود.
     - یادآور برنامه‌ریزی هفتگی (`system` / `weekly_planning_reminder`): در روز `dayOfWeek` و ساعت `time24h` تولید می‌شود و `isConfirmedForSync: false` دارد تا وارد Google Calendar نشود.
2. **جداسازی کامل قالب برنامه ورزشی و جلسات زمان‌بندی‌شده (Template vs. Session Separation)**:
   - ویرایش یا حذف `WorkoutTemplate` یا `WorkoutProgram` به هیچ عنوان نباید `WorkoutSession`هایی که قبلاً در تقویم ساخته شده‌اند را تغییر دهد یا پاک کند. هر جلسه یک کپی مستقل از `exercises` خود دارد.
3. **محاسبه مدت واقعی تمرین از Timestampها**:
   - در سرور هنگام ثبت/بستن `WorkoutActivityLog`، `actualDurationMinutes` باید بر اساس `startedAtISO`، `endedAtISO` و تفاضل مجموع `pauseIntervals` محاسبه شود (فرمول `computeActualDurationSeconds`) تا رفرش یا بسته شدن مرورگر باعث خطای تایمر نشود.
4. **فرمول تخمین کالری ورزشی (MET Formula) و عدم دستکاری هدف غذایی**:
   - فرمول استاندارد: `Calories = round((MET × 3.5 × weightKg / 200) × durationMinutes)`.
   - اگر `user_profiles.weight_kg` یا مدت تمرین معتبر نباشد، `estimatedCalories` باید **`null`** ذخیره و برگردانده شود (هرگز عدد تخمینی یا `0` جعلی ساخته نشود).
   - ثبت کالری سوزانده‌شده در تمرین هرگز نباید به‌صورت خودکار `nutrition_targets.daily_calories` کاربر را تغییر دهد.
5. **قاعده کسر خواندنی موجودی خانه در لیست خرید (Read-Only Pantry Deduction)**:
   - در زمان تأیید برنامه هفتگی (`POST /api/v1/weekly-plans/:planId/confirm`) یا بازتولید لیست خرید (`regenerate`), مقدار موجود در `pantry_inventory` فقط به عنوان عدد مرجع کسر می‌شود و موجودی خانه را کم **نمی‌کند** (کم کردن واقعی از موجودی فقط با اقدام صریح کاربر روی انبار انجام می‌شود).
   - هنگام بازتولید لیست خرید، آیتم‌های با `source = 'MANUAL'` و وضعیت `isChecked` و `note` آیتم‌های قبلی باید حفظ شوند.
   - اگر واحد ماده اولیه در رسپی و انبار با `unitConverter` ناسازگار باشد، `needsUnitReview = true` و `unitReviewMessage` تنظیم شود و مقدار بدون حدس زدن علامت‌گذاری گردد.
6. **قوانین تأیید هفته غذایی**:
   - تأیید نهایی هفته (`confirmWeeklyPlan`) فقط زمانی مجاز است که همه ۷ روز هفته در وضعیت `DailyPlanStatus.CONFIRMED` باشند (در غیر این صورت `400 BUSINESS_RULE_ERROR`).
   - پس از تایید، نسخه اسنپ‌شات جدید به ابتدای آرایه `snapshots` اضافه شده و `version` افزایش می‌یابد.
7. **کلیدهای جلوگیری از تکرار در همگام‌سازی خارجی (`dedupeKey`)**:
   - وعده غذایی: `nutrition:{dateISO}:{slot}`
   - جلسه ورزشی: `workout:{sessionId}`
   - مکمل: `supplement:{supplementId}:{dateISO}`
   - یادآور سیستمی: `system:weekly-planning:{dateISO}`
   - فقط رویدادهای غیرسیستمی که در `includedTypes` فعال‌اند، وضعیتشان `CANCELLED` یا `MISSED` نیست، و برای تغذیه روز/هفته تاییدشده دارند (`onlyConfirmedWeeks`) واجد شرایط Export هستند.
