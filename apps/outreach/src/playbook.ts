import { createHash } from 'node:crypto';
import type { Config, Contact } from './state.js';
import type { Decision } from './model.js';

export const PLAYBOOK_VERSION = 'activation-v2';
export function campaignFor(config: Config, contact?: Contact): string {
  return contact?.campaign ?? config.campaign;
}
export function actionUrl(config: Config, contact?: Contact, registered = false): string {
  const url = new URL(registered ? '/events/new' : '/login', config.siteUrl);
  if (!registered) {
    url.searchParams.set('mode', 'register');
    url.searchParams.set('next', '/events/new');
  }
  url.searchParams.set('utm_source', 'telegram');
  url.searchParams.set('utm_medium', 'outreach');
  url.searchParams.set('utm_campaign', campaignFor(config, contact));
  return url.href;
}
export function firstMessage(config: Config, contact?: Contact): string {
  return `Вітаю, я помічник команди Kopanka. У Kopanka ви створюєте футбольну гру й бачите склад, а гравці реєструються, записуються та обирають команду. Спробуйте для найближчого матчу: ${actionUrl(config, contact)} — після створення надішліть посилання у вашу Telegram-групу, щоб компанія записалась на гру.`;
}
export function trackedGameUrl(url: string, config: Config, contact: Contact): string {
  const tracked = new URL(url);
  tracked.searchParams.set('utm_source', 'telegram');
  tracked.searchParams.set('utm_medium', 'outreach');
  tracked.searchParams.set('utm_campaign', campaignFor(config, contact));
  return tracked.href;
}
export function groupInvitation(url: string): string {
  return `На наступну гру записуємось тут: ${url}\nЗареєструйтесь і займіть місце в команді — так усі бачитимуть склад.`;
}
export function eventUrlFrom(text: string, config: Config): string | undefined {
  for (const raw of text.match(/https:\/\/[^\s<>«»"\])]+/g) ?? []) {
    try {
      const url = new URL(raw.replace(/[.,!?;]+$/, ''));
      if (
        url.origin === new URL(config.siteUrl).origin &&
        /^\/events\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname)
      ) {
        url.search = '';
        url.hash = '';
        return url.href;
      }
    } catch {
      /* Untrusted text cannot supply arbitrary links. */
    }
  }
}
/** Cheap topic gate only rejects clear mismatches; qualification still verifies city/author. */
export function footballPost(text: string): boolean {
  return (
    /футбол|футзал|міні[-\s]?футбол|мини[-\s]?футбол|football|futsal/iu.test(text) &&
    /гравц|игрок|набір|набор|добир|доби[рр]|збира|собира|організ|организ|граємо|играем|місц|мест|команд|матч/iu.test(
      text,
    )
  );
}
export function leadPriority(text: string): number {
  let score = 1;
  if (/щотиж|кожн(?:ого|ої|ий)|регуляр|кажд|постій|постоян/iu.test(text)) score += 2;
  if (
    /наш(?:а|ій|у)?\s+(?:груп|компан)|сво[яєїю]+\s+(?:груп|компан)|груп[ауі]\s+(?:в|у)\s+телеграм|чат/iu.test(
      text,
    )
  )
    score += 2;
  return score;
}
export function replyKey(contact: Contact, config: Config): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: PLAYBOOK_VERSION,
        city: config.city,
        site: config.siteUrl,
        campaign: campaignFor(config, contact),
        model: process.env.OPENAI_MODEL ?? '',
        history: contact.messages.slice(-8),
        metrics: contact.metrics ? { ...contact.metrics, observedAt: undefined } : null,
      }),
    )
    .digest('hex');
}
export function shortReply(text: string): boolean {
  const withoutUrls = text.replace(/https:\/\/\S+/g, 'LINK');
  return (
    text.length <= 700 &&
    (withoutUrls.match(/[.!?](?=\s|$)/g)?.length ?? 1) <= 5 &&
    (withoutUrls.match(/\?/g)?.length ?? 0) <= 1
  );
}
/** Ambiguous/non-standard messages go to the model; no sales interrogation or invented context. */
export function templateReply(contact: Contact, config: Config): Decision | undefined {
  const inbound = contact.messages.filter(
    (m) => m.direction === 'in' && m.id > contact.handledInboundId,
  );
  if (inbound.length !== 1) return undefined;
  const raw = inbound[0]!.text.trim(),
    text = raw.toLocaleLowerCase('uk-UA');
  const result = (reply: string, interested = false): Decision => ({
    action: interested ? 'interested' : 'reply',
    text: reply,
    reason: 'Approved short playbook',
  });
  // Never route an instruction/complex question to a broad keyword template.
  if (
    text.length > 240 ||
    /ігнор|ignore|інструкц|prompt|system|api.?key|парол|password/iu.test(text)
  )
    return undefined;
  if (/^(?:добре[,.! ]*)?(?:дякую|спасибі|зрозуміло)[.!\s]*$/iu.test(text))
    return {
      action: 'handoff',
      text: '',
      reason: 'Conversation complete; no unsolicited sales follow-up',
    };
  const event = eventUrlFrom(raw, config);
  if (
    event &&
    !/\?/.test(raw.replace(/https:\/\/\S+/g, '')) &&
    /створ|готов|ось|^https/iu.test(text)
  )
    return result(
      `Надішліть у вашу групу готове запрошення:\n«${groupInvitation(trackedGameUrl(event, config, contact))}»`,
      true,
    );
  if (
    /^(?:так|да|цікаво|можна|добре|ок|окей|хочу|давайте|спроб[а-яіїєґ]*)(?:[\s,]+(?:можна|давайте|хочу|будемо|спроб[а-яіїєґ]*|цей|такий|варіант|вариант|підходить|цікаво)){0,8}[.!\s]*$/iu.test(
      text,
    )
  )
    return result(
      `Почніть тут: ${actionUrl(config, contact)} — зареєструйтесь, натисніть у профілі «Стати організатором» і створіть найближчу гру. Потім надішліть посилання у вашу групу: гравці зареєструються та запишуться на матч.`,
      true,
    );
  if (
    /^(?:я\s+)?(?:вже\s+|уже\s+)?зареєструва(?:в|лась|лася|вся|лись)|^акаунт\s+(?:є|створ)/iu.test(
      text,
    ) &&
    !/[?]/u.test(text)
  )
    return result(
      `У профілі натисніть «Стати організатором» і створіть гру: ${actionUrl(config, contact, true)}. Посилання на неї надішліть вашій компанії, щоб гравці зареєструвалися й зайняли місця.`,
      true,
    );
  if (
    /(?:є|маємо|есть|власн|сво[яю])[^.!?]{0,45}(?:груп|чат)|(?:груп|чат)[^.!?]{0,30}(?:телеграм|telegram)/iu.test(
      text,
    ) &&
    !/[?]/u.test(text)
  )
    return result(
      `Залишайте вашу Telegram-групу для спілкування, а в Kopanka можна спробувати збирати склад на одну гру. Створіть матч тут: ${actionUrl(config, contact)} — і надішліть посилання в групу, щоб гравці зареєструвалися та записалися.`,
      true,
    );
  if (
    /^(?:як|де)\s+(?:можна\s+)?(?:зареєстр|створити|створювати)|^з чого почати[?!.]*$/iu.test(text)
  )
    return result(
      `Зареєструйтесь тут: ${actionUrl(config, contact)}. У профілі натисніть «Стати організатором», створіть гру й надішліть її посилання у вашу групу — гравці зареєструються та запишуться.`,
      true,
    );
  if (/^(?:це\s+)?(?:бот|ти бот|ви бот|ти людина|ви людина|це ші|це ai)[?!.\s]*$/iu.test(text))
    return result(
      'Я помічник Kopanka на основі ШІ; допомагаю організаторам почати користуватися застосунком. За потреби передам ваше питання команді.',
    );
  return undefined;
}
