import Link from 'next/link';
import type { Metadata } from 'next';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarCheck,
  Compass,
  Flag,
  MousePointerClick,
  Play,
  PlusCircle,
  Share2,
  Star,
  User,
  UserPlus,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Як це працює — Football',
  description: 'Як знайти гру, зайняти позицію на полі, зіграти й оцінити гравців.',
};

type Step = { icon: LucideIcon; title: string; body: React.ReactNode };

const PLAYER_STEPS: Step[] = [
  {
    icon: UserPlus,
    title: 'Зареєструйся',
    body: (
      <>
        Натисни <b>Профіль → Увійти → Реєстрація</b>: ім&apos;я, email і пароль. Ім&apos;я бачать
        інші гравці на полі, тож пиши так, як тебе знають.
      </>
    ),
  },
  {
    icon: Compass,
    title: 'Знайди гру',
    body: (
      <>
        На вкладці <b>Пошук</b> — усі найближчі ігри: дата, час, поле, формат (наприклад 6 на 6) і
        скільки місць вільно. Натисни на картку, щоб відкрити гру.
      </>
    ),
  },
  {
    icon: MousePointerClick,
    title: 'Займи позицію на полі',
    body: (
      <>
        На сторінці гри намальоване поле з двома командами. Натисни <b>«+»</b> на вільному місці —
        воротар, захист, півзахист чи напад — і ти в грі. На телефоні гортай поле вбік, щоб побачити
        другу команду.
      </>
    ),
  },
  {
    icon: CalendarCheck,
    title: 'Приходь на гру',
    body: (
      <>
        Усі твої ігри — у вкладці <b>Мої ігри</b>. Якщо плани змінились, відкрий гру й натисни{' '}
        <b>«Вийти з гри»</b>, поки вона не почалась, — місце звільниться для іншого.
      </>
    ),
  },
  {
    icon: Star,
    title: 'Оціни гравців',
    body: (
      <>
        Після завершення гри на її сторінці з&apos;явиться кнопка <b>«Оцінити гравців»</b>. Постав
        кожному від 1 до 5 зірок за швидкість, дриблінг, пас, удар, захист і фізику. Себе оцінити не
        можна, кожного — лише раз за гру.
      </>
    ),
  },
  {
    icon: User,
    title: 'Дивись свій профіль',
    body: (
      <>
        У <b>Профілі</b> — твої навички (середнє з оцінок інших гравців), кількість матчів,
        відвідуваність та історія ігор. Натисни на аватар, щоб змінити його.
      </>
    ),
  },
];

const ORGANIZER_STEPS: Step[] = [
  {
    icon: PlusCircle,
    title: 'Створи гру',
    body: (
      <>
        Вкладка <b>Створити</b>: обери поле, дату й час, кількість гравців у команді та схему
        (наприклад 1-2-2 для 6 на 6). Гра одразу з&apos;явиться в пошуку.
      </>
    ),
  },
  {
    icon: Share2,
    title: 'Поклич гравців',
    body: (
      <>
        Скопіюй посилання на сторінку гри й кинь у свій чат. Нові ігри також автоматично
        публікуються в нашому Telegram-каналі.
      </>
    ),
  },
  {
    icon: Play,
    title: 'Почни гру',
    body: (
      <>
        На полі натисни <b>«Почати»</b> у блоці «Керування». Після старту гравці вже не можуть
        записатися чи вийти.
      </>
    ),
  },
  {
    icon: Flag,
    title: 'Заверши гру',
    body: (
      <>
        Після матчу натисни <b>«Завершити»</b>. Усі учасники отримають сповіщення, що можна ставити
        оцінки. Якщо гра не відбудеться — <b>«Скасувати»</b>, і гравці теж отримають сповіщення.
      </>
    ),
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Чому я не можу створити гру?',
    a: 'Створювати ігри можуть організатори (роль «менеджер»). Хочеш організовувати — напиши адміністратору, і тобі відкриють доступ. Грати можуть усі.',
  },
  {
    q: 'Чому не можу записатися на гру?',
    a: 'Гра вже повна, почалась, завершилась або скасована — або ти вже в ній записаний. Можна бути лише на одній позиції в грі.',
  },
  {
    q: 'Як змінити позицію?',
    a: 'Вийди з гри й займи інше вільне місце на полі — поки гра не почалась.',
  },
  {
    q: 'Чому немає кнопки «Оцінити гравців»?',
    a: 'Оцінювати можна тільки після того, як організатор завершить гру, і тільки тих, хто в ній грав.',
  },
  {
    q: 'Як рахуються мої навички?',
    a: 'Це середнє з оцінок, які тобі ставили інші гравці після ігор. Що більше ігор і оцінок — то точніша картина.',
  },
  {
    q: 'Де дивитися сповіщення?',
    a: (
      <>
        Вкладка <Bell className="inline size-3.5 align-[-2px]" /> <b>Сповіщення</b>: скасування
        ігор, запрошення, нагадування поставити оцінки. Червона цифра — кількість непрочитаних.
      </>
    ),
  },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <li key={s.title}>
            <Card className="h-full flex-row gap-4 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">
                  <span className="mr-1.5 tabular-nums text-muted-foreground">{i + 1}.</span>
                  {s.title}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Як це працює</h1>
        <p className="max-w-2xl text-muted-foreground">
          Знаходиш гру поруч → займаєш позицію на полі → граєш → оцінюєте одне одного → твій профіль
          показує, як ти граєш.
        </p>
        <nav className="flex flex-wrap gap-2 text-sm">
          <a href="#players" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Гравцям
          </a>
          <a href="#organizers" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Організаторам
          </a>
          <a href="#faq" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
            Питання
          </a>
        </nav>
      </div>

      <section id="players" className="scroll-mt-24 space-y-4">
        <h2 className="text-xl font-semibold">Гравцям</h2>
        <StepList steps={PLAYER_STEPS} />
      </section>

      <section id="organizers" className="scroll-mt-24 space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Організаторам</h2>
          <p className="text-sm text-muted-foreground">
            Якщо ти збираєш людей на гру — ось як вести її тут.
          </p>
        </div>
        <StepList steps={ORGANIZER_STEPS} />
      </section>

      <section id="faq" className="scroll-mt-24 space-y-4">
        <h2 className="text-xl font-semibold">Часті питання</h2>
        <div className="space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-xl border bg-card px-4 py-3">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="mr-2 inline-block text-muted-foreground transition-transform group-open:rotate-90">
                  ›
                </span>
                {f.q}
              </summary>
              <p className="mt-2 pl-5 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Card className="items-center gap-3 p-6 text-center">
        <p className="font-semibold">Готовий грати?</p>
        <Link href="/" className={cn(buttonVariants(), 'w-full sm:w-auto')}>
          Знайти гру
        </Link>
      </Card>
    </div>
  );
}
